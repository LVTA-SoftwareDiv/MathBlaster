"""Write Electron's standard ASAR format and compare every archived byte."""
from pathlib import Path
import hashlib,json,shutil,struct,sys

def pack(source, target):
    source, target = Path(source), Path(target)
    files = sorted(p for p in source.rglob('*') if p.is_file())
    header = {'files': {}}
    offset = 0
    records = []
    for p in files:
        assert not p.is_symlink(), p
        contents = p.read_bytes()
        parts = p.relative_to(source).parts
        parent = header
        for part in parts[:-1]:
            parent = parent['files'].setdefault(part, {'files': {}})
        record = {'size': len(contents), 'offset': str(offset), 'integrity': {
            'algorithm': 'SHA256', 'hash': hashlib.sha256(contents).hexdigest(),
            'blockSize': 4 * 1024 * 1024,
            'blocks': [hashlib.sha256(contents[i:i+4*1024*1024]).hexdigest()
                       for i in range(0, len(contents), 4*1024*1024)]}}
        parent['files'][parts[-1]] = record
        records.append((p, record))
        offset += len(contents)
    encoded = json.dumps(header, ensure_ascii=False, separators=(',', ':')).encode()
    padded = encoded + b'\0' * ((-len(encoded)) % 4)
    header_pickle = struct.pack('<II', 4 + len(padded), len(encoded)) + padded
    with target.open('wb') as out:
        out.write(struct.pack('<II', 4, len(header_pickle)))
        out.write(header_pickle)
        for p, _ in records:
            with p.open('rb') as f:
                shutil.copyfileobj(f, out)
    with target.open('rb') as archive:
        base = 8 + len(header_pickle)
        for p, record in records:
            archive.seek(base + int(record['offset']))
            assert archive.read(record['size']) == p.read_bytes(), p
    assert target.stat().st_size == base + offset
    print(f'Packed and verified {len(files)} files: {target} ({target.stat().st_size:,} bytes)', flush=True)

if __name__ == '__main__':
    pack(sys.argv[1], sys.argv[2])
