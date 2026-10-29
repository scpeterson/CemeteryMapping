"""Regression checks for the documentation fast-path gate using isolated fixtures."""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('check-docs.py')


class DocumentationValidation(unittest.TestCase):
    def validate(self, broken=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            page = root / 'docs/page.md'
            page.parent.mkdir()
            page.write_text('[asset](asset.svg)')
            (page.parent / 'asset.svg').write_text('<svg/>')
            site = root / 'site'
            site.mkdir()
            (site / 'page.html').write_text('<img src="asset.svg">')
            (site / 'asset.svg').write_text('<svg/>')
            archive = root / 'docs/adr/supporting/example'
            archive.mkdir(parents=True)
            data = b'archived evidence'
            (archive / 'evidence.txt').write_bytes(data)
            manifest = {'files': [{'file': 'evidence.txt', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}]}
            (archive / 'manifest.json').write_text(json.dumps(manifest))
            if broken == 'source':
                (page.parent / 'asset.svg').unlink()
            if broken == 'rendered':
                (site / 'asset.svg').unlink()
            if broken == 'hash':
                (archive / 'evidence.txt').write_text('tampered')
            previous = os.getcwd()
            try:
                os.chdir(root)
                with patch.object(sys, 'argv', [str(SCRIPT), str(site), 'base']), patch('subprocess.check_output', return_value=b'docs/page.md\0'), contextlib.redirect_stdout(io.StringIO()):
                    runpy.run_path(str(SCRIPT), run_name='__main__')
            finally:
                os.chdir(previous)

    def test_valid_documentation_passes(self):
        self.validate()

    def test_missing_source_rendered_assets_and_tampering_fail(self):
        for broken in ['source', 'rendered', 'hash']:
            with self.subTest(broken=broken), self.assertRaises(SystemExit):
                self.validate(broken)


if __name__ == '__main__':
    unittest.main()
