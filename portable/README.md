# Compact USB package

The folder structure is:

```text
Mac/
  Play Math Blaster.app
  Game Files/Mac.zip
Windows/
  Play Math Blaster.exe
  Game Files/Windows-x64.zip
  Game Files/Windows-arm64.zip
```

The launchers verify their archive’s SHA-256, extract it into a cache on the computer, then open the game. Later launches reuse the verified copy. Progress is saved on the computer, never on the USB. The Windows launcher chooses the computer’s native architecture.

Build both desktop editions first, then run on macOS:

```sh
python3 scripts/build_mac.py
python3 scripts/build_windows.py
python3 scripts/package_usb.py --zig /path/to/zig
```

The packaging script needs Xcode Command Line Tools and Zig with the Windows GNU target. It regenerates archive hashes and the embedded PowerShell script before compiling both launchers. The Windows resource object is included alongside its editable `.rc` and icon source. The finished folder is `build/usb/`.

Copy the **Mac** and **Windows** folders together to each USB. No automatic launch on insertion is attempted. Keep the launcher beside its Game Files folder. Use a USB format readable by both operating systems, such as exFAT or FAT32; each archive is below FAT32’s individual-file limit. The Mac launcher is a universal executable app bundle; the Windows launcher is an actual executable, not a renamed script.

The previously distributed USB build was checked on macOS; a physical Windows PC was not available. Test a packaged drive on both target platforms before wider distribution. Mac builds are ad-hoc signed, not notarized.
