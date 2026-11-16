"""Package compact USB folders and regenerate launchers bound to their archives."""
from pathlib import Path
import argparse, base64, hashlib, json, plistlib, shutil, subprocess, zipfile
from assets import ROOT
parser=argparse.ArgumentParser();parser.add_argument('--zig',required=True);args=parser.parse_args()
out=ROOT/'build/usb';scratch=ROOT/'build/launchers';scratch.mkdir(parents=True,exist_ok=True)
records={}
for name,source,target,prefix in [
 ('Mac',ROOT/'build/mac/Math Blaster.app',out/'Mac/Game Files/Mac.zip','Math Blaster.app/'),
 ('x64',ROOT/'build/windows/x64',out/'Windows/Game Files/Windows-x64.zip',''),
 ('arm64',ROOT/'build/windows/arm64',out/'Windows/Game Files/Windows-arm64.zip','')]:
    if not source.exists():raise SystemExit('Build the desktop game first: '+str(source))
    target.parent.mkdir(parents=True,exist_ok=True)
    files=sorted(p for p in source.rglob('*') if p.is_file())
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in files:
            if p.is_symlink():raise RuntimeError('Unexpected symlink: '+str(p))
            z.write(p,prefix+p.relative_to(source).as_posix())
    with zipfile.ZipFile(target) as z:
        for p in files:
            if z.read(prefix+p.relative_to(source).as_posix())!=p.read_bytes():raise RuntimeError('Archive verification failed')
    records[name]={'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':target.stat().st_size,'files':len(files)}
(scratch/'archives.json').write_text(json.dumps(records,indent=2)+'\n')
(scratch/'BuildInfo.swift').write_text('let archiveSHA256 = '+json.dumps(records['Mac']['sha256'])+'\n')
for arch in ['arm64','x86_64']:
    subprocess.run(['xcrun','swiftc','-O','-target',arch+'-apple-macos12.3','-module-cache-path',str(scratch/'module-cache'),str(ROOT/'portable/mac/main.swift'),str(scratch/'BuildInfo.swift'),'-o',str(scratch/arch)],check=True)
app=out/'Mac/Play Math Blaster.app';macos=app/'Contents/MacOS';resources=app/'Contents/Resources';macos.mkdir(parents=True,exist_ok=True);resources.mkdir(parents=True,exist_ok=True)
subprocess.run(['xcrun','lipo','-create',str(scratch/'arm64'),str(scratch/'x86_64'),'-output',str(macos/'Launcher')],check=True)
shutil.copyfile(ROOT/'native/mac/AppIcon.icns',resources/'AppIcon.icns')
(app/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleExecutable':'Launcher','CFBundleIdentifier':'local.mathblaster.portable.launcher','CFBundleName':'Play Math Blaster','CFBundleDisplayName':'Play Math Blaster','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.2','CFBundleVersion':'3','CFBundleIconFile':'AppIcon','LSMinimumSystemVersion':'12.3','NSHighResolutionCapable':True}))
subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
(scratch/'build_info.h').write_text(''.join('#define HASH_'+a.upper()+' L"'+records[a]['sha256']+'"\n' for a in ['x64','arm64']))
encoded=base64.b64encode((ROOT/'portable/windows/prepare-windows.ps1').read_text().encode('utf-16le')).decode()
(scratch/'prepare_script.h').write_text('#define PREPARE_SCRIPT L"'+encoded+'"\n')
subprocess.run([args.zig,'cc','-target','x86-windows-gnu','-O2','-municode','-mwindows','-I',str(scratch),str(ROOT/'portable/windows/launcher.c'),str(ROOT/'portable/windows/launcher.res'),'-luser32','-lkernel32','-o',str(out/'Windows/Play Math Blaster.exe')],check=True)
for platform in ['Mac','Windows']:
    (out/platform/'Game Files/Read Me.txt').write_text('Double-click Play Math Blaster in the '+platform+' folder. Keep Game Files beside it. The first launch extracts the game to this computer; later launches are faster. Progress stays on the computer. Close the game before ejecting the USB.\n')
print(out)
