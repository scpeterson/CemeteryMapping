"""Validate changed Markdown links, rendered dependencies, and archived evidence hashes."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
import hashlib
import json
import re
import subprocess
import sys

site = Path(sys.argv[1])
base = sys.argv[2]
errors = []


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for key, value in attrs if key in ('href', 'src') and value)


def local_path(ref):
    url = urlparse(ref)
    return unquote(url.path) if not url.scheme and not url.netloc else ''


def check_rendered(page, root):
    parser = Links()
    parser.feed(page.read_text())
    for ref in parser.links:
        path = local_path(ref)
        if not path:
            continue
        target = root / path.lstrip('/') if path.startswith('/') else page.parent / path
        if target.is_dir():
            target /= 'index.html'
        if not target.exists():
            errors.append(f'{page}: missing {ref}')


changed = subprocess.check_output(['git', 'diff', '--name-only', '--no-renames', '-z', base, 'HEAD']).decode().split('\0')
for name in changed:
    source = Path(name)
    if not source.is_file() or source.suffix != '.md':
        continue
    content = source.read_text()
    for ref in re.findall(r'\]\(([^)]+)\)', content):
        path = local_path(ref.strip('<>'))
        if not path or path.startswith('/'):
            continue
        target = source.parent / path
        if not target.exists() and not (target.suffix == '.html' and target.with_suffix('.md').exists()):
            errors.append(f'{name}: missing {ref}')
    if name.startswith('docs/'):
        permalink = re.search(r'^permalink:\s*[\'"]?([^\s\'"]+)', content, re.M)
        output = site / (permalink[1].lstrip('/') if permalink else str(source.relative_to('docs').with_suffix('.html')))
        if output.is_dir():
            output /= 'index.html'
        if not output.is_file():
            errors.append(f'{name}: missing rendered page {output}')
        else:
            check_rendered(output, site)

for manifest in Path('docs/adr/supporting').rglob('manifest.json'):
    for entry in json.loads(manifest.read_text())['files']:
        path = manifest.parent / entry['file']
        raw = path.read_bytes()
        if len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
            errors.append(f'{path}: archive integrity mismatch')
        if path.suffix == '.html':
            check_rendered(path, manifest.parent)

if errors:
    sys.exit('\n'.join(errors))
print('Changed documentation links, rendered dependencies, and archived report hashes passed.')
