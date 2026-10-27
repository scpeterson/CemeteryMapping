import io
import hashlib
import os
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import release


OLD = 'a' * 40
NEW = 'b' * 40
TIME = '2026-10-27T19:00:00Z'


def health(commit=NEW):
    return {'status': 'ok', 'environment': 'TEST', 'database': 'cemetery_mapping_test',
            'version': {'gitSha': commit, 'buildTime': TIME}}


class ArchiveTests(unittest.TestCase):
    def test_private_token_copy_preserves_foreign_uid_gid_and_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'token-before'
            target = root / 'token-after'
            source.write_bytes(b'fixture-token')
            source.chmod(0o400)
            metadata = list(source.stat())
            metadata[4:6] = [65532, 65532]
            with patch.object(Path, 'stat', return_value=os.stat_result(metadata)), patch.object(release.os, 'chown') as chown:
                release.copy_protected(source, target)
            chown.assert_called_once_with(target, 65532, 65532)
            self.assertEqual(target.read_bytes(), b'fixture-token')
            self.assertEqual(target.stat().st_mode & 0o777, 0o400)

    def test_all_host_environment_overrides_are_preserved_without_dependency_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['.env.test.local', 'db/env/test.local.env', 'node_modules/example/private.env']:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('private=fixture')
            paths = release.protected_paths(root)
            self.assertIn('.env.test.local', paths)
            self.assertIn('db/env/test.local.env', paths)
            self.assertIn('deploy/test/tunnel-token', paths)
            self.assertNotIn('node_modules/example/private.env', paths)

    def test_health_requires_exact_test_revision_and_build(self):
        release.validate_health(health(), NEW, TIME)
        for invalid in [dict(health(), environment='PROD'), health(OLD), dict(health(), status='error')]:
            with self.assertRaises(RuntimeError):
                release.validate_health(invalid, NEW, TIME)
        with self.assertRaises(RuntimeError):
            release.validate_health(health(), NEW, 'different-build')

    def test_archive_rejects_traversal_symlinks_and_environment_files(self):
        for filename, symlink in [('../escape', False), ('server/link', True), ('runtime.env', False)]:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                archive = root / 'release.tar.gz'
                with tarfile.open(archive, 'w:gz') as bundle:
                    item = tarfile.TarInfo(filename)
                    if symlink:
                        item.type = tarfile.SYMTYPE
                        item.linkname = '/etc/passwd'
                        bundle.addfile(item)
                    else:
                        item.size = 4
                        bundle.addfile(item, io.BytesIO(b'data'))
                with self.assertRaises(RuntimeError):
                    release.unpack(archive, root / 'source', {filename: 'unused'})
                self.assertFalse((root / 'source').exists())

    def test_extracted_changelog_is_readable_by_nonroot_migration_container(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'release.tar.gz'
            with tarfile.open(archive, 'w:gz') as bundle:
                item = tarfile.TarInfo('db/changelog/liquibase.properties')
                item.mode = 0o644
                item.size = 4
                bundle.addfile(item, io.BytesIO(b'data'))
            previous = os.umask(0o077)
            try:
                release.unpack(archive, root / 'source',
                               {'db/changelog/liquibase.properties': hashlib.sha256(b'data').hexdigest()})
            finally:
                os.umask(previous)
            self.assertEqual((root / 'source/db/changelog').stat().st_mode & 0o777, 0o755)
            self.assertEqual((root / 'source/db/changelog/liquibase.properties').stat().st_mode & 0o777, 0o644)

    def test_tampered_contents_fail_manifest_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'server').mkdir()
            file = root / 'server/index.mjs'
            file.write_text('original')
            files = {'server/index.mjs': release.digest(file)}
            file.write_text('changed')
            with self.assertRaises(RuntimeError):
                release.verify_files(root, files)


class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.addCleanup(patch.stopall)
        patch.object(release, 'ROOT', self.root).start()
        patch.object(release.subprocess, 'run').start()
        self.stage = self.root / 'staging/test-release'
        self.stage.mkdir(parents=True)
        (self.stage / 'manifest.json').write_text(json.dumps({'commit': NEW, 'buildTime': TIME, 'files': {}}))
        self.job = release.Release(self.stage, 'unused')
        self.commands = []
        self.job.command = self.command
        self.job.dump = lambda name: self.commands.append(['dump', name])
        self.job.sql = lambda _: b'unchanged-account-and-media-hashes'
        self.job.media_inventory = lambda: {}
        self.job.wait_health = lambda port, commit, build: health(commit)
        self.job.prepare = self.prepare
        self.job.start_candidate = lambda: self.commands.append(['candidate'])
        self.job.verify = lambda: self.commands.append(['verified'])
        self.fail_up = False

    def prepare(self):
        self.job.backup.mkdir(parents=True)
        for directory, revision in [(self.job.app, OLD), (self.job.source, NEW)]:
            (directory / 'deploy/test').mkdir(parents=True)
            (directory / 'deploy/test/runtime.env').write_text(f'GIT_SHA={revision}\nBUILD_TIME={TIME}\nAUTH0_DOMAIN=preserved\n')
            (directory / 'dist').mkdir()
            (directory / 'dist/index.html').write_text(revision)
        self.job.old_health = health(OLD)
        self.job.media_before = {}
        self.job.protected_hashes = {}

    def command(self, args, **_):
        self.commands.append(args)
        if self.fail_up and args[:3] == ['docker', 'compose', 'up']:
            runtime = self.job.app / 'deploy/test/runtime.env'
            if NEW in runtime.read_text():
                raise RuntimeError('Injected API startup failure')
        return b''

    def assert_restored(self):
        self.assertEqual((self.job.app / 'dist/index.html').read_text(), OLD)
        self.assertIn(OLD, (self.job.app / 'deploy/test/runtime.env').read_text())
        self.assertIn('AUTH0_DOMAIN=preserved', (self.job.app / 'deploy/test/runtime.env').read_text())
        self.assertEqual(json.loads((self.stage / 'rollback.json').read_text())['restoredCommit'], OLD)
        self.assertTrue(any(args[:3] == ['docker', 'tag', self.job.before_image] for args in self.commands))

    def test_pending_migrations_stop_before_backups_builds_or_live_changes(self):
        self.job.fetch_health = lambda _: health(OLD)
        settings = self.job.app / 'deploy/test/.env'
        settings.parent.mkdir(parents=True)
        settings.write_text('POSTGRES_PASSWORD=fixture')
        self.job.command = lambda *args, **kwargs: b'1 changeset has not been applied'
        with patch.object(release, 'digest', return_value='unused'), patch.object(release, 'unpack'):
            with self.assertRaisesRegex(RuntimeError, 'Pending migrations'):
                release.Release.prepare(self.job)
        self.assertFalse(self.job.backup.exists())
        self.assertFalse(self.job.rollback_needed)
        self.assertFalse(any(args[:3] == ['docker', 'compose', 'stop'] for args in self.commands))

    def test_setting_changes_after_preparation_stop_before_live_shutdown(self):
        self.prepare()
        runtime = self.job.app / 'deploy/test/runtime.env'
        self.job.protected_hashes = {'deploy/test/runtime.env': release.digest(runtime)}
        runtime.write_text('administrator changed configuration')
        with self.assertRaisesRegex(RuntimeError, 'settings changed'):
            self.job.cutover()
        self.assertFalse(self.job.rollback_needed)
        self.assertFalse(any(args[:3] == ['docker', 'compose', 'stop'] for args in self.commands))

    def test_candidate_failure_never_stops_live_services(self):
        def fail():
            raise RuntimeError('Candidate health failed')
        self.job.start_candidate = fail
        with self.assertRaisesRegex(RuntimeError, 'Candidate health'):
            self.job.execute()
        self.assertFalse(any(args[:3] == ['docker', 'compose', 'stop'] for args in self.commands))
        self.assertEqual((self.job.app / 'dist/index.html').read_text(), OLD)

    def test_startup_failure_restores_previous_app_settings_and_image(self):
        self.fail_up = True
        with self.assertRaisesRegex(RuntimeError, 'startup failure'):
            self.job.execute()
        self.assert_restored()

    def test_failed_https_probe_rolls_back_and_successful_probe_is_accepted(self):
        original = self.command
        self.job.command = lambda args, **kwargs: b'200' if args[0] == 'curl' else original(args, **kwargs)
        self.job.check_public_https()
        self.job.command = lambda args, **kwargs: b'403' if args[0] == 'curl' else original(args, **kwargs)
        self.job.verify = self.job.check_public_https
        with self.assertRaisesRegex(RuntimeError, 'HTTPS page health'):
            self.job.execute()
        self.assert_restored()

    def test_verification_failure_also_rolls_back(self):
        def fail():
            raise RuntimeError('Injected preservation mismatch')
        self.job.verify = fail
        with self.assertRaisesRegex(RuntimeError, 'preservation mismatch'):
            self.job.execute()
        self.assert_restored()
        self.assertTrue((self.stage / 'failed-application').exists())

    def test_failure_between_directory_renames_restores_previous_app(self):
        original = Path.rename
        def rename(path, target):
            if path == self.job.source:
                raise OSError('Injected rename failure')
            return original(path, target)
        with patch.object(Path, 'rename', rename), self.assertRaisesRegex(OSError, 'rename failure'):
            self.job.execute()
        self.assert_restored()

    def test_media_snapshot_is_reused_only_with_valid_checksum(self):
        self.prepare()
        (self.root / 'media').mkdir()
        (self.root / 'media/photo.jpg').write_bytes(b'photo')
        self.job.media_before = {}
        self.job.backup_media()
        archive = self.job.backup / 'media-before.tar.gz'
        original_inode = archive.stat().st_ino
        archive.unlink()
        self.job.backup_media()
        self.assertEqual(archive.stat().st_ino, original_inode)
        archive.unlink()
        checksum = next((self.root / 'backups/media-snapshots').glob('*.sha256'))
        checksum.write_text('invalid')
        with self.assertRaisesRegex(RuntimeError, 'checksum'):
            self.job.backup_media()
        self.assertFalse(archive.exists())

    def test_lost_console_output_does_not_prevent_rollback(self):
        self.fail_up = True
        with patch('builtins.print', side_effect=BrokenPipeError), self.assertRaisesRegex(RuntimeError, 'startup failure'):
            self.job.execute()
        self.assert_restored()

    def test_prepare_only_checks_candidate_without_cutover(self):
        self.job.prepare_only = True
        self.job.execute()
        self.assertTrue(self.job.success)
        self.assertFalse(any(args[:3] == ['docker', 'compose', 'stop'] for args in self.commands))
        self.assertFalse((self.job.source / 'deploy/test/runtime.env').exists())

    def test_success_keeps_new_release_and_preserves_existing_settings(self):
        self.job.execute()
        self.assertTrue(self.job.success)
        self.assertEqual((self.job.app / 'dist/index.html').read_text(), NEW)
        self.assertIn('AUTH0_DOMAIN=preserved', (self.job.app / 'deploy/test/runtime.env').read_text())
        self.assertFalse((self.stage / 'rollback.json').exists())
        self.assertTrue((self.job.backup / 'application-before').exists())


if __name__ == '__main__':
    unittest.main()
