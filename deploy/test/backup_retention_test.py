import io
import json
import os
import shutil
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import backup_retention as retention


class FakeRestic:
    snapshot = 'a' * 64
    repository = 'fixture-repository'
    available = True
    fail_backup = False
    fail_verify = False

    def backup(self, paths, tag):
        if self.fail_backup:
            raise RuntimeError('storage unavailable')
        self.paths, self.tag = paths, tag
        return self.snapshot

    def verify(self, snapshot, paths, expected):
        if self.fail_verify:
            raise RuntimeError('plaintext mismatch')
        self.verified = snapshot, paths, expected

    def repository_id(self):
        return self.repository

    def run(self, *args):
        return json.dumps([{'id': self.snapshot}] if self.available else []).encode()


class Fixture(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name in ('backups', 'staging', 'app', 'media'):
            (self.root / name).mkdir()
        (self.root / 'media/live.jpg').write_bytes(b'live media')
        self.source = self.root / 'backups' / retention.LEGACY[0]
        self.source.mkdir()
        (self.source / 'recovery.dump').write_bytes(b'private recovery fixture')
        self.remote = FakeRestic()
        self.manager = retention.Manager(self.root, self.remote)

    def proof(self):
        plan = self.manager.plan()
        return plan, self.manager.archive(plan)

    def test_successful_verified_cleanup_preserves_active_data(self):
        plan, proof = self.proof()
        result = self.manager.apply(plan, proof)
        self.assertFalse(self.source.exists())
        self.assertEqual(result['snapshot'], self.remote.snapshot)
        self.assertEqual((self.root / 'media/live.jpg').read_bytes(), b'live media')
        self.assertEqual(self.remote.tag, 'hosted-test-recovery-hold')

    def test_backup_or_plaintext_verification_failure_never_deletes(self):
        for attribute in ('fail_backup', 'fail_verify'):
            setattr(self.remote, attribute, True)
            with self.assertRaises(RuntimeError):
                self.manager.archive(self.manager.plan())
            self.assertTrue(self.source.exists())
            setattr(self.remote, attribute, False)

    def test_changed_content_same_size_blocks_cleanup(self):
        plan, proof = self.proof()
        p = self.source / 'recovery.dump'
        p.write_bytes(b'x' * p.stat().st_size)
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            self.manager.apply(plan, proof)
        self.assertTrue(p.exists())

    def test_added_file_blocks_cleanup(self):
        plan, proof = self.proof()
        (self.source / 'new-record.dump').write_bytes(b'new')
        with self.assertRaisesRegex(RuntimeError, 'changed'):
            self.manager.apply(plan, proof)
        self.assertTrue(self.source.exists())

    def test_stale_verification_blocks_cleanup(self):
        plan, proof = self.proof()
        proof['verifiedAt'] -= retention.MAX_PROOF_AGE + 1
        with self.assertRaisesRegex(RuntimeError, 'expired'):
            self.manager.apply(plan, proof)
        self.assertTrue(self.source.exists())

    def test_missing_snapshot_blocks_cleanup(self):
        plan, proof = self.proof()
        self.remote.available = False
        with self.assertRaisesRegex(RuntimeError, 'unavailable'):
            self.manager.apply(plan, proof)
        self.assertTrue(self.source.exists())

    def test_different_repository_or_manifest_blocks_cleanup(self):
        plan, proof = self.proof()
        self.remote.repository = 'different-repository'
        with self.assertRaisesRegex(RuntimeError, 'repository changed'):
            self.manager.apply(plan, proof)
        self.remote.repository = 'fixture-repository'
        plan['reclaimableBytes'] += 1
        with self.assertRaisesRegex(RuntimeError, 'does not match'):
            self.manager.apply(plan, proof)
        self.assertTrue(self.source.exists())

    def test_new_hold_blocks_previously_planned_cleanup(self):
        plan, proof = self.proof()
        retention.save(self.root / 'backup-retention/policy.json', {'holds': [str(self.source.relative_to(self.root))]})
        with self.assertRaisesRegex(RuntimeError, 'held'):
            self.manager.apply(plan, proof)
        self.assertTrue(self.source.exists())

    def test_symlink_sources_and_children_are_rejected(self):
        (self.source / 'escape').symlink_to(self.root / 'media/live.jpg')
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            self.manager.plan()

    def test_cleanup_cannot_target_active_data_or_traverse(self):
        for name in ('media/live.jpg', 'app/deploy', 'backups/../media', 'backups', '/backups/test', 'backups/a/b'):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                retention.safe_root(self.root, name)

    def test_hard_link_estimate_counts_only_final_references(self):
        file = self.source / 'recovery.dump'
        other = self.root / 'backups/other-copy.dump'
        os.link(file, other)
        self.assertEqual(retention.reclaimable([self.source]), 0)
        self.assertGreater(retention.reclaimable([self.source, other]), 0)

    def test_daily_pruning_only_matches_top_level_job_files(self):
        old = self.root / 'backups/test-20260101T033000Z.dump'
        old.write_bytes(b'old')
        os.utime(old, (1, 1))
        manual = self.root / 'backups/test-manual.dump'
        manual.write_bytes(b'held')
        os.utime(manual, (1, 1))
        (self.root / 'backups/migration-checkpoint').mkdir()
        (self.root / 'backups/migration-checkpoint/test-20260101T033000Z.dump').write_bytes(b'held')
        roots, _, _ = retention.candidates(self.root)
        self.assertIn(str(old.relative_to(self.root)), roots)
        self.assertNotIn(str(manual.relative_to(self.root)), roots)
        self.assertNotIn('backups/migration-checkpoint', roots)

    def test_four_latest_successful_release_sets_and_unknown_failures_are_retained(self):
        names = []
        for day in range(1, 7):
            name = f'2026010{day}T010000Z-aaaaaaaaaaaa-bbbbbbbb'
            names.append(name)
            (self.root / 'backups' / name).mkdir()
            (self.root / 'staging' / name).mkdir()
            retention.save(self.root / 'staging' / name / 'verification.json', {
                'health': {'status': 'ok'}, 'accountAndMediaPreservation': 'passed'})
            for parent in ('backups', 'staging'):
                os.utime(self.root / parent / name, (1, 1))
        unknown = '20250101T010000Z-aaaaaaaaaaaa-cccccccc'
        (self.root / 'backups' / unknown).mkdir()
        os.utime(self.root / 'backups' / unknown, (1, 1))
        roots, keep, _ = retention.candidates(self.root)
        self.assertEqual(keep, names[2:])
        self.assertNotIn('backups/' + unknown, roots)
        self.assertIn('backups/' + names[0], roots)
        self.assertNotIn('backups/' + names[-1], roots)

    def test_holding_one_release_side_holds_staging_too(self):
        name = '20250101T010000Z-aaaaaaaaaaaa-bbbbbbbb'
        (self.root / 'backups' / name).mkdir()
        (self.root / 'staging' / name).mkdir()
        retention.save(self.root / 'backup-retention/policy.json', {'holds': ['backups/' + name]})
        roots, _, _ = retention.candidates(self.root)
        self.assertNotIn('staging/' + name, roots)

    def test_media_pool_requires_no_inventory_or_hardlink_reference(self):
        pool = self.root / 'backups/media-snapshots'
        pool.mkdir()
        metadata = self.source / 'media-inventory.json'
        metadata.write_bytes(b'inventory fixture')
        key = retention.digest(metadata)
        archive = pool / (key + '.tar.gz')
        archive.write_bytes(b'archive fixture')
        os.utime(archive, (1, 1))
        relative = str(archive.relative_to(self.root))
        self.assertNotIn(relative, retention.candidates(self.root)[0])
        metadata.unlink()
        link = self.source / 'media.tar.gz'
        os.link(archive, link)
        self.assertNotIn(relative, retention.candidates(self.root)[0])
        link.unlink()
        self.assertIn(relative, retention.candidates(self.root)[0])
        plan, proof = self.proof()
        os.link(archive, link)
        with self.assertRaisesRegex(RuntimeError, 'eligible'):
            self.manager.apply(plan, proof)
        self.assertTrue(archive.exists())

    def test_media_pool_checksum_hold_is_preserved(self):
        pool = self.root / 'backups/media-snapshots'
        pool.mkdir()
        archive = pool / ('b' * 64 + '.tar.gz')
        checksum = pool / ('b' * 64 + '.sha256')
        archive.write_bytes(b'archive fixture')
        checksum.write_text('checksum fixture')
        os.utime(archive, (1, 1))
        relative = str(checksum.relative_to(self.root))
        retention.save(self.root / 'backup-retention/policy.json', {'holds': [relative]})
        roots, _, _ = retention.candidates(self.root)
        self.assertIn(str(archive.relative_to(self.root)), roots)
        self.assertNotIn(relative, roots)

    def test_daily_dump_failure_keeps_existing_recovery_copy(self):
        (self.root / 'app/deploy/test').mkdir(parents=True)
        with patch.object(retention.subprocess, 'run', side_effect=RuntimeError('dump failed')):
            with self.assertRaises(RuntimeError):
                retention.create_database_backup(self.root, io.BytesIO())
        self.assertEqual(list((self.root / 'backups').glob('*.partial')), [])
        self.assertTrue((self.source / 'recovery.dump').exists())


class RepositoryTests(unittest.TestCase):
    def test_remote_and_private_password_are_required(self):
        with tempfile.TemporaryDirectory() as d:
            password = Path(d) / 'password'
            password.write_text('fixture-password')
            password.chmod(0o600)
            for repo in ('/tmp/repo', 's3:http://store.example/bucket', 'rest:https://localhost/repo'):
                with self.assertRaisesRegex(RuntimeError, 'remote'):
                    retention.Restic({'RESTIC_REPOSITORY': repo, 'RESTIC_PASSWORD_FILE': str(password)}, io.BytesIO())
            password.chmod(0o644)
            with self.assertRaisesRegex(RuntimeError, '0600'):
                retention.Restic({'RESTIC_REPOSITORY': 's3:https://store.example/bucket', 'RESTIC_PASSWORD_FILE': str(password)}, io.BytesIO())


@unittest.skipUnless(shutil.which('restic'), 'Install checksum-pinned restic to run encrypted integration tests.')
class EncryptedIntegrationTests(unittest.TestCase):
    def test_real_encrypted_snapshot_readback_and_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / 'host'
            for name in ('backups', 'staging', 'media', 'app'):
                (root / name).mkdir(parents=True)
            source = root / 'backups' / retention.LEGACY[0]
            (source / 'nested').mkdir(parents=True)
            (source / 'nested/database.dump').write_bytes(b'private fixture database')
            (source / 'settings.env').write_bytes(b'private fixture configuration')
            (source / 'settings.env').chmod(0o600)
            os.link(source / 'settings.env', source / 'settings-hardlink.env')
            password = base / 'password'
            password.write_text('test-only-password-never-used-on-hosted-test')
            password.chmod(0o600)
            env = {'RESTIC_REPOSITORY': str(base / 'repository'), 'RESTIC_PASSWORD_FILE': str(password),
                   'RESTIC_CACHE_DIR': str(base / 'cache')}
            with (base / 'log').open('ab') as log:
                remote = retention.Restic(env, log, require_remote=False)
                remote.run('init')
                manager = retention.Manager(root, remote)
                plan = manager.plan()
                proof = manager.archive(plan)
                remote.run('check', '--read-data')
                manager.apply(plan, proof)
                self.assertFalse(source.exists())
                self.assertTrue((root / 'media').exists())
                # The repository cannot be decrypted using the wrong password.
                wrong = base / 'wrong-password'
                wrong.write_text('different-test-password')
                wrong.chmod(0o600)
                invalid = retention.Restic(dict(env, RESTIC_PASSWORD_FILE=str(wrong)), log, require_remote=False)
                with self.assertRaises(RuntimeError):
                    invalid.run('snapshots', '--json')


if __name__ == '__main__':
    unittest.main()
