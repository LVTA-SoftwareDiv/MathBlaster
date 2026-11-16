"""Build the touch PWA from the unchanged, shared desktop game. Python 3 only."""
from pathlib import Path
import argparse, hashlib, json, mimetypes, shutil, sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from assets import ensure
ensure()
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=ROOT / 'dist')
args = parser.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=True)
for p in (ROOT / 'game').iterdir():
    if p.is_file() and p.suffix in ('.js', '.css'):
        shutil.copyfile(p, out / p.name)
shutil.copytree(ROOT / 'game/assets', out / 'assets', dirs_exist_ok=True)
for name in ('index.html', 'mobile.css', 'mobile.js', 'touch-input.js', 'manifest.webmanifest'):
    shutil.copyfile(ROOT / 'pwa' / name, out / name)
shutil.copytree(ROOT / 'pwa/icons', out / 'icons', dirs_exist_ok=True)

game = (out / 'game.js').read_text()
def replace(before, after):
    global game
    assert game.count(before) == 1, f'Game integration point changed: {before[:100]}'
    game = game.replace(before, after)

replace("const n=q.answerText.length,rtl=", "input.readOnly=true;input.inputMode='none';\n const n=q.answerText.length,rtl=")
replace("sampleBank=window.MBSound?new MBSound.SampleBank(window.MB_EFFECT_AUDIO):null", "sampleBank=window.MBMobileAudioBank")
replace("const a=new Audio(`assets/${info.file}`);", "const a=sampleBank.voice(info.file);if(!a)throw new Error('Cutscene audio was not prepared: '+info.file);")
replace("const paused=state.paused||state.focusPaused", "const paused=window.MBMobilePaused||state.paused||state.focusPaused")
replace("if(!((state.modal&&!state.nativeTip?.active)", "if(!(window.MBMobilePaused||(state.modal&&!state.nativeTip?.active)")
replace("if(!state.modal&&settings.sound)for", "if(!window.MBMobilePaused&&!state.modal&&settings.sound)for")
replace("else if(settings.sound&&!state.modal&&!state.focusPaused)for", "else if(!window.MBMobilePaused&&settings.sound&&!state.modal&&!state.focusPaused)for")
replace("window.addEventListener('beforeunload',snapshot);", "window.addEventListener('beforeunload',snapshot);\nwindow.addEventListener('pagehide',()=>{keys.clear();pointer.down=false;snapshot();});")
# Touch buttons call the same actions as the original keyboard/mouse. They have
# no access to answers, physics state, score mutation, or scene skipping hooks.
bridge = (ROOT / 'pwa/bridge.js').read_text()
replace('// Expose an intentionally read-only snapshot', bridge + '\n// Expose an intentionally read-only snapshot')
(out / 'game.js').write_text(game)

# Small, hashed download packs avoid thousands of network requests on first use.
# Cache entries remain ordinary individual URLs after unpacking by the worker.
files = sorted(p for p in out.rglob('*') if p.is_file() and p.name not in ('sw.js', 'offline-index.json') and p.suffix != '.pack')
entries, packs, payload = [], [], bytearray()
def flush():
    global payload
    if not payload: return
    digest = hashlib.sha256(payload).hexdigest()
    name = f'offline-{len(packs)}-{digest[:12]}.pack'
    (out / name).write_bytes(payload)
    packs.append({'path': name, 'sha256': digest, 'size': len(payload)})
    payload = bytearray()
for p in files:
    data = p.read_bytes()
    if len(payload) + len(data) > 8 * 1024 * 1024: flush()
    mime = mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    if p.suffix == '.js': mime = 'text/javascript'
    entries.append({'path': p.relative_to(out).as_posix(), 'pack': len(packs), 'offset': len(payload), 'size': len(data), 'type': mime})
    payload.extend(data)
flush()
index = json.dumps({'entries': entries, 'packs': packs}, separators=(',', ':'))
version = hashlib.sha256((index + (ROOT/'pwa/sw.js').read_text()).encode()).hexdigest()[:20]
(out / 'offline-index.json').write_text(index)
(out / 'sw.js').write_text((ROOT/'pwa/sw.js').read_text().replace('__VERSION__', version).replace('__INDEX_HASH__', hashlib.sha256(index.encode()).hexdigest()))
current = {p['path'] for p in packs}
for p in out.glob('*.pack'):
    if p.name not in current: p.unlink()
print(f'PWA {version}: {len(entries)} cached files, {len(packs)} packs, {sum(p["size"] for p in packs):,} bytes. Output: {out}')
