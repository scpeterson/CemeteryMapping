"""Hosted TEST only: verified code releases; schema changes require separate rehearsal."""
import fcntl
from contextlib import suppress
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request

ROOT = Path('/srv/nhcemeteries')
PROTECTED = ['deploy/test/.env', 'deploy/test/runtime.env', 'deploy/test/frontend.env',
             'deploy/test/tunnel-token', 'db/env/test.env']
PRESERVE_SQL = """
SELECT 'app_users',count(*),md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),'')) FROM app_users t;
SELECT 'app_user_cemetery_access',count(*),md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY app_user_id,cemetery_id),'')) FROM app_user_cemetery_access t;
SELECT 'access_requests',count(*),md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),'')) FROM access_requests t;
SELECT 'media_assets',count(*),md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),'')) FROM media_assets t;
SELECT 'headstone_media_assets',count(*),md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),'')) FROM headstone_media_assets t;
"""


def emit(message):
    with suppress(BrokenPipeError):
        print(message, flush=True)


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def env_values(path):
    values = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('\"', "'"):
                value = value[1:-1]
            values[key.strip()] = value
    return values


def protected_paths(app):
    paths = set(PROTECTED)
    for path in app.rglob('*'):
        relative = path.relative_to(app)
        if (path.is_file() and not any(part in ('node_modules', '.git', 'dist') for part in relative.parts)
                and (path.name.endswith('.env') or '.env.' in path.name)):
            paths.add(relative.as_posix())
    return sorted(paths)


def validate_health(health, commit, build_time):
    if (health.get('status') != 'ok' or health.get('environment') != 'TEST'
            or health.get('database') != 'cemetery_mapping_test'
            or health.get('version', {}).get('gitSha') != commit
            or health.get('version', {}).get('buildTime') != build_time):
        raise RuntimeError('API health does not match the selected TEST release.')


def unpack(archive, destination, files):
    with tarfile.open(archive) as bundle:
        members = bundle.getmembers()
        for item in members:
            path = PurePosixPath(item.name)
            if (not item.isfile() or path.is_absolute() or '..' in path.parts
                    or item.name not in files or path.name.endswith('.env') or '.env.' in path.name):
                raise RuntimeError('Unsafe or unexpected release archive member.')
        if len(members) != len(files) or {m.name for m in members} != set(files):
            raise RuntimeError('Archive does not match its manifest.')
        destination.mkdir(mode=0o700)
        # Every member is a validated regular file; reject links before extracting.
        for item in members:
            output = destination / item.name
            output.parent.mkdir(parents=True, exist_ok=True)
            with bundle.extractfile(item) as source, open(output, 'wb') as target:
                shutil.copyfileobj(source, target)
            output.chmod(item.mode & 0o777)
    for directory in destination.rglob("*"):
        if directory.is_dir():
            directory.chmod(0o755)
    verify_files(destination, files)


def verify_files(directory, files):
    for name, expected in files.items():
        if digest(directory / name) != expected:
            raise RuntimeError(f'Release hash mismatch: {name}')


class Release:
    def __init__(self, stage, archive_sha, prepare_only=False):
        self.stage = stage
        self.prepare_only = prepare_only
        self.protected = list(PROTECTED)
        self.archive_sha = archive_sha
        self.app = ROOT / 'app'
        self.source = stage / 'source'
        self.backup = ROOT / 'backups' / stage.name
        self.candidate = f'nhcemeteries-candidate-{stage.name.lower()}'
        self.image = f'nhcemeteries-test-api:{stage.name.lower()}'
        self.before_image = f'nhcemeteries-test-api:before-{stage.name.lower()}'
        self.rollback_needed = False
        self.success = False
        self.manifest = json.loads((stage / 'manifest.json').read_text())
        self.commit = self.manifest['commit']
        self.build_time = self.manifest['buildTime']
        if not re.fullmatch(r'[a-f0-9]{40}', self.commit):
            raise RuntimeError('Invalid release commit.')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', self.build_time):
            raise RuntimeError('Invalid release build time.')

    def command(self, args, *, capture=False, input=None, env=None, output=None):
        cwd = self.app / 'deploy/test'
        if not cwd.exists():
            cwd = self.backup / 'application-before/deploy/test'
        with open(self.stage / 'commands.log', 'ab') as log:
            result = subprocess.run(args, cwd=cwd, input=input,
                                    stdout=subprocess.PIPE if capture else output or log,
                                    stderr=log, env=env)
        if result.returncode:
            raise RuntimeError(f'{args[0]} {args[1]} failed; inspect protected commands.log.')
        return result.stdout if capture else None

    def compose(self, *args, **kwargs):
        return self.command(['docker', 'compose', *args], **kwargs)

    def sql(self, query):
        return self.compose('exec', '-T', 'db', 'psql', '-U', 'cemetery_app', '-d',
                            'cemetery_mapping_test', '-At', '-v', 'ON_ERROR_STOP=1',
                            input=query.encode(), capture=True)

    def dump(self, name):
        with open(self.backup / name, 'wb') as output:
            self.compose('exec', '-T', 'db', 'pg_dump', '-U', 'cemetery_app', '-d',
                         'cemetery_mapping_test', '--format=custom', '--no-owner', '--no-privileges', output=output)
        with open(self.backup / name, 'rb') as source:
            self.compose('exec', '-T', 'db', 'pg_restore', '--list', input=source.read())

    def fetch_health(self, port):
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=3) as response:
            return json.load(response)

    def wait_health(self, port, commit, build_time):
        for _ in range(30):
            try:
                health = self.fetch_health(port)
                validate_health(health, commit, build_time)
                return health
            except (OSError, ValueError, RuntimeError):
                time.sleep(1)
        raise RuntimeError('API did not become healthy within 30 attempts.')

    def media_inventory(self):
        return {str(path.relative_to(ROOT / 'media')): [path.stat().st_size, path.stat().st_mtime_ns]
                for path in (ROOT / 'media').rglob('*') if path.is_file()}

    def backup_media(self):
        # Reuse only an identical inventory with a verified immutable archive digest.
        snapshots = ROOT / 'backups/media-snapshots'
        snapshots.mkdir(mode=0o700, exist_ok=True)
        inventory = json.dumps(self.media_before, sort_keys=True).encode()
        key = hashlib.sha256(inventory).hexdigest()
        archive = snapshots / f'{key}.tar.gz'
        checksum = snapshots / f'{key}.sha256'
        if archive.exists():
            if not checksum.exists() or digest(archive) != checksum.read_text().strip():
                raise RuntimeError('Retained media snapshot failed checksum validation.')
        else:
            required = sum(item[0] for item in self.media_before.values()) + 1024 ** 3
            if shutil.disk_usage(ROOT).free < required:
                raise RuntimeError('Insufficient disk space for a new media recovery snapshot.')
            partial = snapshots / f'{key}.partial'
            try:
                with tarfile.open(partial, 'w:gz', compresslevel=1) as bundle:
                    bundle.add(ROOT / 'media', arcname='media')
                if self.media_inventory() != self.media_before:
                    raise RuntimeError('Media changed while creating its recovery snapshot.')
                checksum.write_text(digest(partial) + '\n')
                partial.chmod(0o400)
                partial.rename(archive)
            finally:
                partial.unlink(missing_ok=True)
        os.link(archive, self.backup / 'media-before.tar.gz')
        (self.backup / 'media-inventory.json').write_bytes(inventory)

    def prepare(self):
        emit('Validating hosted TEST, release integrity and schema status.')
        self.old_health = self.fetch_health(8080)
        if (self.old_health.get('status') != 'ok' or self.old_health.get('environment') != 'TEST'
                or self.old_health.get('database') != 'cemetery_mapping_test'):
            raise RuntimeError('Refusing to deploy: target is not healthy hosted TEST.')
        if digest(self.stage / 'release.tar.gz') != self.archive_sha:
            raise RuntimeError('Release archive checksum mismatch.')
        unpack(self.stage / 'release.tar.gz', self.source, self.manifest['files'])
        # Unexpected schema work is never silently applied to the live database.
        self.credentials = env_values(self.app / 'deploy/test/.env')
        migration_env = dict(os.environ, LIQUIBASE_COMMAND_PASSWORD=self.credentials['POSTGRES_PASSWORD'])
        migration_args = ['docker', 'run', '--rm', '--network', 'host', '-e', 'LIQUIBASE_COMMAND_PASSWORD',
                               '-v', f'{self.source}/db/changelog:/liquibase/changelog:ro',
                               'liquibase/liquibase:4.33.0', '--defaults-file=/liquibase/changelog/liquibase.properties',
                               '--url=jdbc:postgresql://127.0.0.1:5432/cemetery_mapping_test',
                               '--username=cemetery_app']
        self.command([*migration_args, 'validate'], env=migration_env)
        result = self.command([*migration_args, 'status', '--verbose'], env=migration_env, capture=True)
        if b'is up to date' not in result:
            raise RuntimeError('Pending migrations: rehearse and apply them separately before deploying code.')
        emit('Backing up TEST database, application settings and media.')
        self.backup.mkdir(mode=0o700)
        self.dump('database-before.dump')
        with tarfile.open(self.backup / 'application-before.tar.gz', 'w:gz', compresslevel=1) as bundle:
            bundle.add(self.app, arcname='app')
        self.media_before = self.media_inventory()
        self.backup_media()
        if self.media_inventory() != self.media_before:
            raise RuntimeError('Media changed during backup; rerun deployment to obtain a consistent snapshot.')
        self.protected = protected_paths(self.app)
        self.protected_hashes = {path: digest(self.app / path) for path in self.protected}
        self.runtime_before = env_values(self.app / 'deploy/test/runtime.env')
        for name in self.protected:
            if (self.app / name).exists():
                target = self.source / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(self.app / name, target)
        (self.source / 'db/env/test.env').chmod(0o600)
        running = self.compose('ps', '-q', 'api', capture=True).decode().strip()
        previous = self.command(['docker', 'inspect', running, '--format', '{{.Image}}'], capture=True).decode().strip()
        self.command(['docker', 'tag', previous, self.before_image])
        emit('Building the committed API Dockerfile without cache.')
        self.command(['docker', 'build', '--no-cache', '-t', self.image, '-f',
                      str(self.source / 'deploy/test/Dockerfile'), str(self.source)])
        emit('Backups validated; unchanged schema and candidate image ready.')

    def check_runtime(self, container):
        self.command(['docker', 'exec', container, 'node', '--input-type=module', '-e', '''
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {loadApiConfig} from './server/config.mjs';
const stat=statSync('/app/db/env/test.env');
assert.equal(process.getuid(),1000);assert.equal(stat.uid,1000);
assert.equal(stat.mode&0o777,0o600);readFileSync('/app/db/env/test.env');
const config=loadApiConfig();assert.equal(config.auth.mode,'auth0');
assert.equal(config.database.user,'cemetery_api');
await import('./shared/recordNormalization.mjs');
'''])

    def start_candidate(self):
        env = dict(os.environ, PGPASSWORD=self.credentials['CEMETERY_API_PASSWORD'])
        self.command(['docker', 'run', '-d', '--name', self.candidate, '--network', 'host',
                      '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL',
                      '--security-opt', 'no-new-privileges:true', '--env-file',
                      str(self.source / 'deploy/test/runtime.env'), '-e', 'PGPASSWORD',
                      '-e', 'APP_ENV=test', '-e', 'AUTH_MODE=auth0', '-e', 'PGHOST=127.0.0.1',
                      '-e', 'PGPORT=5432', '-e', 'PGDATABASE=cemetery_mapping_test',
                      '-e', 'PGUSER=cemetery_api', '-e', 'API_PORT=3002',
                      '-e', f'GIT_SHA={self.commit}', '-e', f'BUILD_TIME={self.build_time}', self.image], env=env)
        self.check_runtime(self.candidate)
        self.wait_health(3002, self.commit, self.build_time)
        emit('Candidate startup, private env permissions, Auth0 and database health passed.')

    def cutover(self):
        for path, expected in self.protected_hashes.items():
            if digest(self.app / path) != expected:
                raise RuntimeError('Host settings changed during preparation; rerun deployment.')
        self.rollback_needed = True
        emit('Switching hosted TEST API/web; database and tunnel remain running.')
        self.compose('stop', 'api', 'web')
        self.dump('database-final-before.dump')
        self.preserved_before = self.sql(PRESERVE_SQL)
        if self.media_inventory() != self.media_before:
            raise RuntimeError('Media changed after its backup; live services will be restored. Rerun deployment.')
        self.app.rename(self.backup / 'application-before')
        self.source.rename(self.app)
        runtime = self.app / 'deploy/test/runtime.env'
        lines = [line for line in runtime.read_text().splitlines()
                 if not line.startswith(('GIT_SHA=', 'BUILD_TIME='))]
        runtime.write_text('\n'.join(lines) + f'\nGIT_SHA={self.commit}\nBUILD_TIME={self.build_time}\n')
        runtime.chmod(0o600)
        for directory in [self.app / 'dist', *(self.app / 'dist').rglob('*')]:
            directory.chmod(0o755 if directory.is_dir() else 0o644)
        self.command(['docker', 'tag', self.image, 'nhcemeteries-test-api:latest'])
        self.compose('up', '-d', '--no-deps', '--no-build', '--force-recreate', 'api', 'web')
        self.compose('exec', '-T', 'web', 'nginx', '-t')

    def check_public_https(self):
        # Use the same curl probe as the hosted runbook; Cloudflare rejects Python's default client.
        status = self.command(['curl', '--fail', '--silent', '--show-error', '--max-time', '15',
                               '--output', '/dev/null', '--write-out', '%{http_code}',
                               'https://test.nhcemeteries.org/request-access'], capture=True).strip()
        if status != b'200':
            raise RuntimeError('Hosted TEST HTTPS page health failed.')

    def verify(self):
        health = self.wait_health(8080, self.commit, self.build_time)
        verify_files(self.app, self.manifest['files'])
        container = self.compose('ps', '-q', 'api', capture=True).decode().strip()
        self.check_runtime(container)
        runtime_files = {name: value for name, value in self.manifest['files'].items()
                         if name.startswith(('server/', 'shared/'))}
        self.command(['docker', 'exec', '-i', container, 'node', '--input-type=module', '-e', '''
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
for(const [p,h] of Object.entries(JSON.parse(readFileSync(0,'utf8'))))
 if(createHash('sha256').update(readFileSync(p)).digest('hex')!==h)throw Error(p);
'''], input=json.dumps(runtime_files).encode())
        if self.sql(PRESERVE_SQL) != self.preserved_before or self.media_inventory() != self.media_before:
            raise RuntimeError('Account or media preservation check failed.')
        for path, expected in self.protected_hashes.items():
            if path != 'deploy/test/runtime.env' and digest(self.app / path) != expected:
                raise RuntimeError(f'Protected settings changed: {path}')
        runtime = env_values(self.app / 'deploy/test/runtime.env')
        for key in set(runtime) | set(self.runtime_before):
            if key not in ('GIT_SHA', 'BUILD_TIME') and runtime.get(key) != self.runtime_before.get(key):
                raise RuntimeError('Runtime settings changed beyond release metadata.')
        with urllib.request.urlopen('http://127.0.0.1:8080/request-access', timeout=5) as response:
            if (response.status != 200 or hashlib.sha256(response.read()).hexdigest()
                    != self.manifest['files']['dist/index.html']):
                raise RuntimeError('Public page does not match the release frontend.')
        try:
            urllib.request.urlopen('http://127.0.0.1:8080/api/me', timeout=5)
        except urllib.error.HTTPError as error:
            if error.code != 401:
                raise RuntimeError('Private API did not reject anonymous access.') from error
        else:
            raise RuntimeError('Private API allowed anonymous access.')
        # Catch immediate crash/restart loops after readiness.
        time.sleep(5)
        self.wait_health(8080, self.commit, self.build_time)
        restarts = self.command(['docker', 'inspect', container, '--format', '{{.RestartCount}}'], capture=True).strip()
        if restarts != b'0':
            raise RuntimeError('API restarted after deployment.')
        self.check_public_https()
        image = self.command(['docker', 'image', 'inspect', 'nhcemeteries-test-api:latest',
                              '--format', '{{.Id}}'], capture=True).decode().strip()
        report = {'apiImage': image, 'dockerfileSha256': digest(self.app / 'deploy/test/Dockerfile'),
                  'runtimeUser': 'node', 'environmentFileMode': '0600', 'environment': 'hosted TEST',
                  'commit': self.commit, 'previousCommit': self.old_health['version']['gitSha'], 'buildTime': self.build_time,
                  'health': health, 'runtimeFilesVerified': len(runtime_files), 'apiRestartCount': 0,
                  'schemaChanges': False, 'accountAndMediaPreservation': 'passed', 'backupDirectory': str(self.backup)}
        (self.stage / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
        emit(json.dumps(report, indent=2))

    def rollback(self):
        emit('Deployment failed; restoring previous code, settings and API image.')
        # This workflow never applies migrations, so code rollback needs no database restore.
        self.compose('stop', 'api', 'web')
        previous = self.backup / 'application-before'
        if previous.exists():
            if self.app.exists():
                self.app.rename(self.stage / 'failed-application')
            previous.rename(self.app)
        self.command(['docker', 'tag', self.before_image, 'nhcemeteries-test-api:latest'])
        self.compose('up', '-d', '--no-deps', '--no-build', '--force-recreate', 'api', 'web')
        old = self.old_health['version']
        self.wait_health(8080, old['gitSha'], old['buildTime'])
        (self.stage / 'rollback.json').write_text(json.dumps({'restoredCommit': old['gitSha'], 'health': 'passed'}) + '\n')

    def execute(self):
        try:
            self.prepare()
            self.start_candidate()
            if not self.prepare_only:
                self.cutover()
                self.verify()
            self.success = True
            if self.prepare_only:
                (self.stage / 'preparation.json').write_text(json.dumps({
                    'commit': self.commit, 'buildTime': self.build_time, 'candidateHealth': 'passed',
                    'liveServicesRestarted': False, 'backupDirectory': str(self.backup)}, indent=2) + '\n')
                emit('Prepare-only rehearsal passed; live services were not restarted.')
        except BaseException:
            if self.rollback_needed:
                self.rollback()
            raise
        finally:
            # Do not let cleanup hide the deployment or recovery result.
            if not self.success:
                with suppress(OSError):
                    with open(self.stage / 'candidate.log', 'ab') as log:
                        subprocess.run(['docker', 'logs', '--tail', '80', self.candidate], stdout=log, stderr=log)
            with suppress(OSError):
                subprocess.run(['docker', 'rm', '-f', self.candidate], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if self.source.exists():
                for name in self.protected:
                    with suppress(OSError):
                        (self.source / name).unlink(missing_ok=True)


def main():
    os.umask(0o077)
    if len(sys.argv) not in (3, 4) or (len(sys.argv) == 4 and sys.argv[3] != '--prepare-only'):
        raise RuntimeError('Expected staging path, archive checksum, and optional --prepare-only.')
    stage = Path(sys.argv[1])
    if (stage.parent != ROOT / 'staging' or stage.is_symlink()
            or not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{12}-[a-f0-9]{8}', stage.name)
            or not re.fullmatch(r'[a-f0-9]{64}', sys.argv[2])):
        raise RuntimeError('Invalid hosted TEST release location or checksum.')
    with open(ROOT / 'deploy-test.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        def interrupted(_signal, _frame):
            raise RuntimeError('Deployment interrupted.')
        for event in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(event, interrupted)
        Release(stage, sys.argv[2], len(sys.argv) == 4).execute()


if __name__ == '__main__':
    main()
