"""Package the Windows game using verified official Electron ZIPs in .cache/."""
from pathlib import Path
import hashlib, json, shutil, zipfile
from assets import ROOT, ensure
from pack_asar import pack
ensure()
version='45.3.3'
hashes={line.split()[1].lstrip('*'):line.split()[0] for line in (ROOT/'native/windows/SHASUMS256.txt').read_text().splitlines()}
for arch in ['x64','arm64']:
    name=f'electron-v{version}-win32-{arch}.zip';archive=ROOT/'.cache'/name
    if not archive.exists():raise SystemExit(f'Download https://github.com/electron/electron/releases/download/v{version}/{name} into .cache/ first.')
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=hashes[name]:raise SystemExit('Runtime checksum mismatch: '+name)
    dest=ROOT/'build/windows'/arch;dest.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if not (dest/item.filename).resolve().is_relative_to(dest.resolve()):raise RuntimeError('Unexpected runtime path')
        z.extractall(dest)
    (dest/'electron.exe').rename(dest/'Math Blaster.exe')
    if (dest/'electron_wer.dll').exists():(dest/'electron_wer.dll').rename(dest/'Math Blaster_wer.dll')
    app=dest/'resources/app';app.mkdir(exist_ok=True)
    for f in ['main.cjs','paths.cjs','icon.png']:shutil.copyfile(ROOT/'native/windows'/f,app/f)
    (app/'package.json').write_text(json.dumps({'name':'math-blaster','version':'1.2.0','private':True,'main':'main.cjs'}))
    game=app/'game';game.mkdir(exist_ok=True)
    for f in (ROOT/'game').iterdir():
        if f.suffix in ('.js','.html','.css'):shutil.copyfile(f,game/f.name)
    shutil.copytree(ROOT/'game/assets',game/'assets',dirs_exist_ok=True)
    pack(app,dest/'resources/app.asar');shutil.rmtree(app)
    (dest/'resources/default_app.asar').unlink(missing_ok=True)
    print(dest/'Math Blaster.exe')
