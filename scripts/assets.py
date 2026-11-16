"""Expand the original artwork/audio archive after a clean checkout."""
from pathlib import Path
import hashlib, zipfile, zlib
ROOT = Path(__file__).resolve().parents[1]
def ensure():
    archive = ROOT / 'game/assets.zip'
    expected = (ROOT / 'game/assets.sha256').read_text().split()[0]
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        raise RuntimeError('The original asset archive is incomplete or damaged.')
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            target = ROOT / 'game' / entry.filename
            if not target.resolve().is_relative_to((ROOT / 'game/assets').resolve()):
                raise RuntimeError('Unexpected archive path: ' + entry.filename)
            if not target.exists() or target.stat().st_size != entry.file_size or zlib.crc32(target.read_bytes()) != entry.CRC:
                z.extract(entry, ROOT / 'game')
if __name__ == '__main__':
    ensure()
    print('Original game assets are ready.')
