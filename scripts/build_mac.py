"""Build a universal, ad-hoc signed Mac app with Xcode Command Line Tools."""
from pathlib import Path
import plistlib, shutil, subprocess
from assets import ROOT, ensure
ensure()
build=ROOT/'build/mac';build.mkdir(parents=True,exist_ok=True)
app=build/'Math Blaster.app';resources=app/'Contents/Resources';macos=app/'Contents/MacOS'
resources.mkdir(parents=True,exist_ok=True);macos.mkdir(parents=True,exist_ok=True)
for arch in ['arm64','x86_64']:
    subprocess.run(['xcrun','swiftc','-O','-target',arch+'-apple-macos12.3','-module-cache-path',str(build/'module-cache'),str(ROOT/'native/mac/MathBlaster.swift'),'-o',str(build/arch)],check=True)
subprocess.run(['xcrun','lipo','-create',str(build/'arm64'),str(build/'x86_64'),'-output',str(macos/'MathBlaster')],check=True)
for source in (ROOT/'game').iterdir():
    if source.suffix in ('.js','.css','.html'):shutil.copyfile(source,resources/source.name)
shutil.copytree(ROOT/'game/assets',resources/'assets',dirs_exist_ok=True)
shutil.copyfile(ROOT/'native/mac/AppIcon.icns',resources/'AppIcon.icns')
info={'CFBundleExecutable':'MathBlaster','CFBundleIdentifier':'local.mathblaster.insearchofspot','CFBundleName':'Math Blaster','CFBundleDisplayName':'Math Blaster','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.2','CFBundleVersion':'3','CFBundleIconFile':'AppIcon','LSMinimumSystemVersion':'12.3','NSHighResolutionCapable':True}
(app/'Contents/Info.plist').write_bytes(plistlib.dumps(info))
subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
print(app)
