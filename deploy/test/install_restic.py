"""Install a checksum-pinned official restic binary; no storage credentials needed."""
import argparse
import bz2
import hashlib
from pathlib import Path
import platform
import urllib.request

VERSION = '0.19.1'
DIGESTS = {
    'linux_amd64': 'f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c',
    'darwin_arm64': '7be0a144ccc377880f294204aa271d76e4b79554b42a751151d425ce6ebac143',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    architecture = {'x86_64': 'amd64', 'arm64': 'arm64', 'aarch64': 'arm64'}.get(platform.machine())
    target = platform.system().lower() + '_' + str(architecture)
    if target not in DIGESTS:
        raise RuntimeError('No reviewed restic binary for this platform.')
    url = f'https://github.com/restic/restic/releases/download/v{VERSION}/restic_{VERSION}_{target}.bz2'
    with urllib.request.urlopen(url, timeout=120) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != DIGESTS[target]:
        raise RuntimeError('Official restic archive checksum mismatch; nothing installed.')
    args.directory.mkdir(parents=True, exist_ok=True)
    destination = args.directory / 'restic'
    if destination.is_symlink():
        raise RuntimeError('Refusing to overwrite a symlink.')
    temporary = args.directory / 'restic.partial'
    with temporary.open('xb') as output:
        output.write(bz2.decompress(data))
    temporary.chmod(0o755)
    temporary.replace(destination)
    print(f'Installed checksum-verified restic {VERSION} for {target}.')


if __name__ == '__main__':
    main()
