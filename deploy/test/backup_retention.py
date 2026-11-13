#!/usr/bin/env python3
"""Hosted TEST: encrypted remote backups and manifest-gated local retention."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path('/srv/nhcemeteries')
CONFIG = Path('/etc/nhcemeteries-backup.env')
LEGACY = ('release-20261017-f927266', 'release-20261017-38eb15e', 'security-20260925T172451Z')
RELEASE = re.compile(r'^\d{8}T\d{6}Z-[a-f0-9]{12}-[a-f0-9]{8}$')
DUMP = re.compile(r'^test-\d{8}T\d{6}Z\.(?:dump|globals\.sql)$')
MAX_PROOF_AGE = 24 * 3600


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def save(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.partial')
    with temporary.open('wb') as stream:
        stream.write(encoded(value))
    temporary.chmod(0o600)
    temporary.replace(path)


def safe_root(root, relative):
    name = PurePosixPath(relative)
    pool_file = (len(name.parts) == 3 and name.parts[:2] == ('backups', 'media-snapshots')
                 and bool(re.fullmatch(r'[a-f0-9]{64}\.(?:tar\.gz|sha256)', name.name)))
    if name.is_absolute() or '..' in name.parts or not name.parts or name.parts[0] not in ('backups', 'staging') or not (len(name.parts) == 2 or pool_file):
        raise RuntimeError('Cleanup roots must be direct backup/staging children or named media-pool files.')
    path = root
    for part in name.parts:
        path = path / part
        if path.is_symlink():
            raise RuntimeError('Symlinks are not eligible for cleanup.')
    if not path.resolve().is_relative_to(root.resolve()):
        raise RuntimeError('Cleanup path escaped the hosted TEST root.')
    return path


def inventory(paths):
    """Hash plaintext; reject special files and symlinks; do not duplicate hard-link reads."""
    files, cache = {}, {}
    for root in paths:
        if not root.exists() or root.is_symlink():
            raise RuntimeError('A backup source is missing or is a symlink.')
        pending = [root]
        while pending:
            path = pending.pop()
            info = path.lstat()
            if stat.S_ISDIR(info.st_mode):
                pending.extend(path.iterdir())
            elif stat.S_ISREG(info.st_mode):
                key = (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
                if key not in cache:
                    cache[key] = digest(path)
                files[str(path)] = {'size': info.st_size, 'sha256': cache[key], 'mode': stat.S_IMODE(info.st_mode),
                                    'uid': info.st_uid, 'gid': info.st_gid}
                after = path.lstat()
                if (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns) != key:
                    raise RuntimeError('A source changed while it was being hashed.')
            else:
                raise RuntimeError('Special files and symlinks cannot be archived or removed.')
    return files


def reclaimable(paths):
    """Count blocks only when every hard link would be removed by this manifest."""
    nodes = {}
    for root in paths:
        for p in ([root] if root.is_file() else root.rglob('*')):
            s = p.lstat()
            if stat.S_ISREG(s.st_mode):
                item = nodes.setdefault((s.st_dev, s.st_ino), [s.st_blocks * 512, s.st_nlink, 0])
                item[2] += 1
    return sum(blocks for blocks, links, selected in nodes.values() if links == selected)


def candidates(root, now=None):
    now = time.time() if now is None else now
    policy_file = root / 'backup-retention/policy.json'
    holds = set(json.loads(policy_file.read_text()).get('holds', [])) if policy_file.exists() else set()
    for hold in holds:
        safe_root(root, hold)
    held_names = {PurePosixPath(hold).name for hold in holds}
    backups, staging = root / 'backups', root / 'staging'
    evidence_file = root / 'backup-retention/release-verifications.json'
    evidence = json.loads(evidence_file.read_text()) if evidence_file.exists() else {}
    releases = []
    for p in backups.iterdir():
        if not p.is_dir() or not RELEASE.fullmatch(p.name):
            continue
        report = staging / p.name / 'verification.json'
        data = json.loads(report.read_text()) if report.is_file() else evidence.get(p.name, {})
        if data.get('health', {}).get('status') == 'ok' and data.get('accountAndMediaPreservation') == 'passed':
            releases.append(p.name)
    keep = set(sorted(releases, reverse=True)[:4])
    selected = []
    for parent in (backups, staging):
        for p in parent.iterdir():
            relative = str(p.relative_to(root))
            if relative in holds or p.name in held_names or p.name in keep or p.is_symlink():
                continue
            age = now - p.stat().st_mtime
            eligible = (parent == backups and p.name in LEGACY)
            eligible |= parent == backups and p.is_file() and bool(DUMP.fullmatch(p.name)) and age > 14 * 86400
            eligible |= p.name in releases and age > (14 if parent == backups else 7) * 86400
            # Pool archives are handled only when they have no remaining release hard links.
            if eligible:
                selected.append(relative)
    pool = backups / 'media-snapshots'
    if pool.is_dir() and 'backups/media-snapshots' not in holds:
        referenced = set()
        for metadata in backups.glob('*/media-inventory.json'):
            if metadata.is_file():
                referenced.add(digest(metadata))
        for archive in pool.glob('*.tar.gz'):
            key = archive.name.removesuffix('.tar.gz')
            relative = str(archive.relative_to(root))
            if (re.fullmatch(r'[a-f0-9]{64}', key) and relative not in holds and key not in referenced
                    and archive.stat().st_nlink == 1 and now - archive.stat().st_mtime > 14 * 86400):
                selected.append(relative)
                checksum = pool / (key + '.sha256')
                if checksum.is_file() and str(checksum.relative_to(root)) not in holds:
                    selected.append(str(checksum.relative_to(root)))
    return sorted(selected), sorted(keep), sorted(holds)


class Restic:
    def __init__(self, env, log, require_remote=True):
        self.env = dict(os.environ, **env)
        self.log = log
        repository = env.get('RESTIC_REPOSITORY', '')
        if require_remote:
            match = re.match(r'^(s3:https://|rest:https://|sftp:)', repository)
            if not match or any(x in repository.lower() for x in ('localhost', '127.0.0.1', '[::1]', '67.205.168.195')):
                raise RuntimeError('Configure an encrypted remote S3/HTTPS, REST/HTTPS or SFTP repository first.')
        password = Path(env.get('RESTIC_PASSWORD_FILE', '/nonexistent'))
        if not password.is_file() or not password.read_bytes().strip():
            raise RuntimeError('A nonempty RESTIC_PASSWORD_FILE is required; escrow it separately.')
        if password.stat().st_mode & 0o077:
            raise RuntimeError('The restic password file must have mode 0600 or stricter.')
        self.repository = repository

    def run(self, *args):
        result = subprocess.run(['restic', *args], env=self.env, stdout=subprocess.PIPE, stderr=self.log)
        if result.returncode:
            raise RuntimeError('Offsite command failed; no local recovery copies were removed. Inspect the protected log.')
        return result.stdout

    def repository_id(self):
        return json.loads(self.run('cat', 'config'))['id']

    def backup(self, paths, tag):
        result = self.run('backup', '--json', '--tag', tag, '--', *(str(p) for p in paths)).decode()
        summaries = [json.loads(line) for line in result.splitlines() if line.startswith('{')]
        matches = [row for row in summaries if row.get('message_type') == 'summary' and row.get('snapshot_id')]
        if len(matches) != 1:
            raise RuntimeError('Offsite backup did not return one completed snapshot.')
        snapshots = json.loads(self.run('snapshots', '--json', matches[0]['snapshot_id']))
        if len(snapshots) != 1:
            raise RuntimeError('Cannot resolve the completed snapshot to one immutable ID.')
        return snapshots[0]['id']

    def verify(self, snapshot, paths, expected):
        self.run('check')
        seen = set()
        # One ancestor stream lets tar represent cross-root hard links once. The
        # snapshot contains only these sources; unexpected files still fail closed.
        dump_paths = paths if len(paths) == 1 else [Path(os.path.commonpath([str(p) for p in paths]))]
        for path in dump_paths:
            if path.is_file():
                command = ['restic', 'dump', snapshot, str(path)]
                with subprocess.Popen(command, env=self.env, stdout=subprocess.PIPE, stderr=self.log) as proc:
                    checksum = hashlib.file_digest(proc.stdout, 'sha256').hexdigest()
                    if proc.wait() or checksum != expected[str(path)]['sha256']:
                        raise RuntimeError('Offsite plaintext readback does not match the local file.')
                seen.add(str(path))
            else:
                command = ['restic', 'dump', snapshot, str(path), '--archive', 'tar']
                with subprocess.Popen(command, env=self.env, stdout=subprocess.PIPE, stderr=self.log) as proc:
                    try:
                        with tarfile.open(fileobj=proc.stdout, mode='r|') as archive:
                            for member in archive:
                                if member.isdir():
                                    continue
                                # Restic tar names retain the absolute source path without '/'.
                                name = PurePosixPath(member.name)
                                if name.is_absolute() or '..' in name.parts or not (member.isfile() or member.islnk()):
                                    raise RuntimeError('Unsafe or unsupported offsite archive entry.')
                                target = str(Path('/').joinpath(*name.parts))
                                if target in seen or target not in expected:
                                    raise RuntimeError('Unexpected or duplicate offsite archive entry.')
                                if member.islnk():
                                    link = PurePosixPath(member.linkname)
                                    source = str(Path('/').joinpath(*link.parts))
                                    if link.is_absolute() or '..' in link.parts or source not in seen or expected[source]['sha256'] != expected[target]['sha256']:
                                        raise RuntimeError('Unverified offsite hard-link target.')
                                    seen.add(target)
                                    continue
                                stream = archive.extractfile(member)
                                actual = hashlib.file_digest(stream, 'sha256').hexdigest()
                                record = expected[target]
                                if member.size != record['size'] or actual != record['sha256']:
                                    raise RuntimeError('Offsite readback hash/size mismatch.')
                                seen.add(target)
                    except BaseException:
                        proc.kill()
                        proc.wait()
                        raise
                    if proc.wait():
                        raise RuntimeError('Offsite directory readback failed.')
        if seen != set(expected):
            raise RuntimeError('Offsite readback omitted files; local recovery copies are retained.')


class Manager:
    def __init__(self, root, restic):
        self.root, self.restic = root, restic
        self.state = root / 'backup-retention'

    def plan(self):
        selected, keep, holds = candidates(self.root)
        paths = [safe_root(self.root, x) for x in selected]
        return {'version': 1, 'createdAt': time.time(), 'roots': selected, 'keepReleaseSets': keep,
                'holds': holds, 'files': inventory(paths), 'reclaimableBytes': reclaimable(paths)}

    def paths(self, plan):
        if plan.get('version') != 1 or len(set(plan['roots'])) != len(plan['roots']):
            raise RuntimeError('Invalid cleanup manifest.')
        paths = [safe_root(self.root, x) for x in plan['roots']]
        eligible, _, _ = candidates(self.root)
        if not set(plan['roots']) <= set(eligible):
            raise RuntimeError('A cleanup root is now held or no longer eligible.')
        return paths

    def archive(self, plan, tag='hosted-test-recovery-hold'):
        paths = self.paths(plan)
        if not paths:
            raise RuntimeError('Nothing is selected; no backup or cleanup was attempted.')
        if inventory(paths) != plan['files']:
            raise RuntimeError('Local files changed since planning; create a fresh manifest.')
        snapshot = self.restic.backup(paths, tag)
        self.restic.verify(snapshot, paths, plan['files'])
        if inventory(paths) != plan['files']:
            raise RuntimeError('Local files changed during offsite verification.')
        return {'manifestSha256': hashlib.sha256(encoded(plan)).hexdigest(), 'snapshot': snapshot,
                'repositoryId': self.restic.repository_id(), 'verifiedAt': time.time()}

    def apply(self, plan, proof):
        if not re.fullmatch(r'[a-f0-9]{64}', proof.get('snapshot', '')):
            raise RuntimeError('Verification requires one immutable full snapshot ID.')
        if proof.get('manifestSha256') != hashlib.sha256(encoded(plan)).hexdigest():
            raise RuntimeError('Verification proof does not match this manifest.')
        age = time.time() - proof.get('verifiedAt', 0)
        if age < 0 or age > MAX_PROOF_AGE:
            raise RuntimeError('Offsite verification is expired; verify again before cleanup.')
        if proof.get('repositoryId') != self.restic.repository_id():
            raise RuntimeError('Offsite repository changed.')
        snapshots = json.loads(self.restic.run('snapshots', '--json', proof['snapshot']))
        if len(snapshots) != 1 or snapshots[0]['id'] != proof['snapshot']:
            raise RuntimeError('Verified snapshot is unavailable.')
        paths = self.paths(plan)
        if inventory(paths) != plan['files']:
            raise RuntimeError('Local recovery files changed; no cleanup was performed.')
        # Staging expires before its paired backup. Preserve verified release
        # evidence first so deleting staging does not orphan the 14-day policy.
        evidence_file = self.state / 'release-verifications.json'
        evidence = json.loads(evidence_file.read_text()) if evidence_file.exists() else {}
        changed = False
        for path in paths:
            if path.parent != self.root / 'staging' or not RELEASE.fullmatch(path.name):
                continue
            backup = self.root / 'backups' / path.name
            if not backup.is_dir() or str(backup.relative_to(self.root)) in plan['roots']:
                continue
            report = json.loads((path / 'verification.json').read_text())
            if report.get('health', {}).get('status') != 'ok' or report.get('accountAndMediaPreservation') != 'passed':
                raise RuntimeError('Release verification evidence is no longer successful.')
            evidence[path.name] = {'health': {'status': 'ok'}, 'accountAndMediaPreservation': 'passed',
                                   'snapshot': proof['snapshot']}
            changed = True
        if changed:
            save(evidence_file, evidence)
        # Recheck all sources before any removal; current media/app/volumes cannot be roots.
        for path in paths:
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
        return {'removed': plan['roots'], 'estimatedReclaimedBytes': plan['reclaimableBytes'], 'snapshot': proof['snapshot']}


@contextmanager
def locked(root):
    with (root / 'deploy-test.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def configuration():
    if not CONFIG.is_file() or CONFIG.stat().st_mode & 0o077 or CONFIG.stat().st_uid != 0:
        raise RuntimeError('Create root-owned mode-0600 /etc/nhcemeteries-backup.env first.')
    values = {}
    for line in CONFIG.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            if not re.fullmatch(r'[A-Z][A-Z0-9_]*', key.strip()):
                raise RuntimeError('Invalid backup environment key.')
            values[key.strip()] = value.strip().strip('\"\'')
    return values



def create_database_backup(root, log):
    backup_dir = root / 'backups'
    backup_dir.mkdir(mode=0o700, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    prefix = backup_dir / ('test-' + stamp)
    compose = ['docker', 'compose', 'exec', '-T', 'db']
    cwd = root / 'app/deploy/test'
    files = []
    try:
        dump = Path(str(prefix) + '.dump')
        partial = Path(str(dump) + '.partial')
        files.append(partial)
        with partial.open('xb') as output:
            subprocess.run([*compose, 'pg_dump', '-U', 'cemetery_app', '-d', 'cemetery_mapping_test',
                            '--format=custom', '--no-owner', '--no-privileges'], cwd=cwd, stdout=output, stderr=log, check=True)
        with partial.open('rb') as source:
            subprocess.run([*compose, 'pg_restore', '--list'], cwd=cwd, stdin=source, stdout=log, stderr=log, check=True)
        partial.chmod(0o600)
        partial.replace(dump)
        globals_file = Path(str(prefix) + '.globals.sql')
        partial_globals = Path(str(globals_file) + '.partial')
        files.append(partial_globals)
        with partial_globals.open('xb') as output:
            subprocess.run([*compose, 'pg_dumpall', '-U', 'cemetery_app', '--globals-only'], cwd=cwd,
                           stdout=output, stderr=log, check=True)
        partial_globals.chmod(0o600)
        partial_globals.replace(globals_file)
        return dump, globals_file
    finally:
        for path in files:
            path.unlink(missing_ok=True)


def backup_status(root):
    verification = root / 'backup-retention/daily-verification.json'
    proof = json.loads(verification.read_text()) if verification.is_file() else {}
    age = time.time() - proof.get('verifiedAt', 0)
    free = shutil.disk_usage(root).free
    return {'freeBytes': free, 'warningFreeBytes': 15 * 1024**3, 'criticalFreeBytes': 10 * 1024**3,
            'offsiteDailyVerifiedAt': proof.get('verifiedAt'), 'offsiteDailyAgeHours': round(age / 3600, 1) if proof else None,
            'warning': free < 15 * 1024**3, 'critical': free < 10 * 1024**3 or not proof or age > 26 * 3600}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'plan', 'archive', 'apply', 'maintain', 'daily', 'expire', 'check', 'status'])
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--proof', type=Path)
    parser.add_argument('--apply', action='store_true', help='Apply offsite retention; otherwise dry run.')
    args = parser.parse_args()
    state = ROOT / 'backup-retention'
    state.mkdir(mode=0o700, exist_ok=True)
    with locked(ROOT), (state / 'commands.log').open('ab') as log:
        if args.command == 'plan':
            plan = Manager(ROOT, None).plan()
            target = args.manifest or state / 'plan.json'
            save(target, plan)
            print(json.dumps({k: v for k, v in plan.items() if k != 'files'}))
            return
        if args.command == 'daily':
            create_database_backup(ROOT, log)
        if args.command == 'status':
            status = backup_status(ROOT)
            print(json.dumps(status))
            if status['critical']:
                sys.exit(2)
            return
        restic = Restic(configuration(), log)
        manager = Manager(ROOT, restic)
        if args.command == 'init':
            restic.run('init')
            print('Encrypted remote repository initialized; escrow its password separately.')
        elif args.command == 'check':
            restic.run('check', '--read-data')
            print('Offsite repository full-data check passed.')
        elif args.command == 'expire':
            options = [] if args.apply else ['--dry-run']
            restic.run('forget', '--tag', 'hosted-test-daily', '--group-by', 'host,tags', '--keep-daily', '30',
                       '--keep-weekly', '8', '--keep-monthly', '6', '--keep-tag', 'hold', '--prune', *options)
            if args.apply:
                restic.run('check')
            print('Offsite daily retention applied.' if args.apply else 'Offsite retention dry run passed; no snapshots removed.')
        elif args.command == 'daily':
            dumps = [p for p in (ROOT / 'backups').iterdir() if p.is_file() and DUMP.fullmatch(p.name)]
            if not dumps:
                raise RuntimeError('No database dumps exist; no retention was attempted.')
            paths = [ROOT / 'app', ROOT / 'media', *dumps]
            paths.extend(p for p in (state / 'policy.json', state / 'release-verifications.json') if p.is_file())
            before = inventory(paths)
            snapshot = restic.backup(paths, 'hosted-test-daily')
            restic.verify(snapshot, paths, before)
            if inventory(paths) != before:
                raise RuntimeError('Daily backup sources changed; no dumps were removed.')
            selected, keep, holds = candidates(ROOT)
            roots = [x for x in selected if DUMP.fullmatch(PurePosixPath(x).name)]
            plan = {'version': 1, 'createdAt': time.time(), 'roots': roots, 'keepReleaseSets': keep, 'holds': holds,
                    'files': {k: v for k, v in before.items() if k in {str(ROOT / x) for x in roots}},
                    'reclaimableBytes': reclaimable([ROOT / x for x in roots])}
            proof = {'manifestSha256': hashlib.sha256(encoded(plan)).hexdigest(), 'snapshot': snapshot,
                     'repositoryId': restic.repository_id(), 'verifiedAt': time.time()}
            save(state / 'daily-verification.json', dict(proof, sourceFiles=len(before)))
            print(json.dumps(manager.apply(plan, proof)))
        else:
            manifest = args.manifest or state / 'plan.json'
            proof_path = args.proof or state / 'proof.json'
            if args.command == 'maintain':
                plan = manager.plan()
                save(manifest, plan)
                if not plan['roots']:
                    print('No eligible local recovery copies; nothing removed.')
                    return
            else:
                plan = json.loads(manifest.read_text())
            if args.command in ('archive', 'maintain'):
                proof = manager.archive(plan)
                save(proof_path, proof)
                print(json.dumps({'verifiedSnapshot': proof['snapshot'], 'reclaimableBytes': plan['reclaimableBytes']}))
            else:
                proof = json.loads(proof_path.read_text())
            if args.command in ('apply', 'maintain'):
                result = manager.apply(plan, proof)
                save(state / ('cleanup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json'), result)
                print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError, subprocess.SubprocessError) as error:
        print(f'Backup retention stopped: {error}', file=sys.stderr)
        sys.exit(1)
