import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('parity', Path(__file__).with_name('verify-environments.py'))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


class ParityTests(unittest.TestCase):
    def test_snapshot_is_read_only_and_preserves_geometry_bytes(self):
        sql = parity.snapshot_sql()
        self.assertIn('REPEATABLE READ READ ONLY', sql)
        self.assertIn('ST_AsEWKB', sql)
        self.assertIn("string_agg(h,'' ORDER BY h)", sql)
        for table in parity.PROTECTED:
            self.assertIn("'" + table + "'", sql)
        self.assertNotIn('EXCLUDED', sql)

    def test_drift_fails_even_with_same_release(self):
        def result():
            return {'database': [{'table': 'headstones', 'rows': 1, 'hash': 'a'}],
                    'media': {'photo.jpg': {'bytes': 2, 'sha256': 'aa'}}, 'code': {'app': 'x'}, 'release': {'gitSha': 'same'}}
        values = {name: result() for name in ['dev', 'local-test', 'hosted-test']}
        self.assertTrue(parity.compare(values)['passed'])
        values['hosted-test']['media']['photo.jpg']['sha256'] = 'bb'
        self.assertFalse(parity.compare(values)['passed'])
        values['local-test']['database'][0]['hash'] = 'changed'
        self.assertFalse(parity.compare(values)['checks']['local-test']['database'])
        with self.assertRaises(ValueError):
            parity.compare({'dev': result()})

    def test_media_inventory_rejects_links_and_detects_same_size_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'photo').write_bytes(b'ab')
            before = parity.file_inventory(root)
            (root / 'photo').write_bytes(b'cd')
            self.assertNotEqual(before, parity.file_inventory(root))
            (root / 'link').symlink_to(root / 'photo')
            with self.assertRaises(RuntimeError):
                parity.file_inventory(root)


if __name__ == '__main__':
    unittest.main()
