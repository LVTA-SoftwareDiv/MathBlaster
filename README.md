# Math Blaster: In Search of Spot

The shared game source, original artwork and audio, Mac and Windows hosts, USB launchers, and touch-only iPhone/iPad PWA.

## Play on iPhone or iPad

[Open the touch edition](https://math-blaster-spot-touch.lehigh-valle-5669.chatgpt.site). This hosted copy is private and requires its owner’s ChatGPT sign-in for the initial download.

The mobile edition requires **landscape orientation**. In portrait, the game pauses behind a rotate-device screen. Safari does not need to support orientation locking for this requirement to work.

- Tap numbers on the answer pad, then Enter.
- In the recycler, tap a column to select it; tap it again to push. Tap Check equation when ready.
- In Cave Runner and Math Blaster, Thrust is on the left, the game is in the middle, and the direction arrows are on the right. Hold steering and Thrust together; release Thrust to fall.
- Tap floating trash to fire the zapper.
- Use File → New Game to start a new mission.

In Safari, use Share → Add to Home Screen. Open the installed app once online and wait for **Ready for offline play**. The initial game download is about 26 MB. Saves stay on that device; clearing Safari/site data removes them. iOS may reclaim website storage, so keep the link for downloading again if needed.

## Repository layout

| Folder | Contents |
| --- | --- |
| `game/` | Shared game logic, data tables, fonts, artwork and audio |
| `pwa/` | Landscape-only touch shell, offline worker, icons and build script |
| `native/mac/` | Swift/WebKit host for Intel and Apple silicon Macs |
| `native/windows/` | Electron host for Windows x64 and ARM64 |
| `portable/` | Mac and Windows USB launcher sources |
| `scripts/` | Asset preparation and desktop build tools |
| `tests/` | Game, audio, input and offline-installation checks |

The 3,652 original asset files are stored losslessly in `game/assets.zip` to keep the repository manageable. `python3 scripts/assets.py` expands them into `game/assets/`; builds do this automatically. `game/assets.sha256` verifies the archive. Build products, downloaded runtimes, personal saves, credentials and machine-specific USB records are not tracked.

## Build and preview the PWA

Requires Python 3.9+; Node 22+ for tests. No package installation is needed.

```sh
python3 pwa/build.py
node tests/pwa.test.cjs
node tests/pwa-game.test.cjs
python3 -m http.server 8875 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8875/`. Use a landscape viewport. For installation on a real device, host **all of `dist/` over HTTPS**. A LAN HTTP address is not sufficient for offline installation. The worker scope is relative, so a subdirectory host is supported. Serve `sw.js` as JavaScript without a long-lived HTTP cache; do not rewrite missing asset or pack requests to HTML.

The original gameplay is shared with the desktop build. `pwa/build.py` applies a small, checked adapter for touch input, background saving, paused orientation changes, and predecoded movie audio. It does not replace the physics or cutscene timeline. Download packs are SHA-256 verified before becoming the active offline version. Updates require an explicit Save & update action.

## Desktop builds

On a Mac with Xcode Command Line Tools:

```sh
python3 scripts/build_mac.py
```

The universal app is written to `build/mac/Math Blaster.app`. Builds are ad-hoc signed for local use, not Developer ID notarized distribution.

For Windows, place the official Electron 45.3.3 `win32-x64` and `win32-arm64` ZIPs in `.cache/`, then run:

```sh
python3 scripts/build_windows.py
```

Runtime hashes are pinned in `native/windows/SHASUMS256.txt`; the build refuses a mismatched download. Each output retains Electron’s license files. See `portable/README.md` for the compact USB package.

## Validation

```sh
python3 scripts/assets.py
node tests/test-buffered-sound.cjs
node tests/test-game-buffered-audio.cjs
node tests/test-controls.cjs
node tests/test-new-game-pace.cjs
python3 pwa/build.py
node tests/pwa.test.cjs
node tests/pwa-game.test.cjs
```

The audio tests compare every original PCM sample, exercise 2,200 delayed-completion sound cues, and run zapper hit/miss and recycler sequences. PWA tests cover independent fingers, cache completeness, corruption recovery, offline navigation, audio byte ranges and explicit updates. Real iPhone/iPad hardware testing is still required before claiming device compatibility has been verified.

## Original material

Original game, characters, artwork and audio © 1993–1994 Davidson & Associates. These assets are preserved from the original game and are not covered by an open-source license. This repository does not claim ownership of the original material. Reference versions: [Internet Archive](https://archive.org/details/mathblasterepisode1) and [ClassicReload](https://classicreload.com/win3x-math-blaster-in-search-of-spot.html).
