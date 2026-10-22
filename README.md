# Sol: Lightkeeper

A quiet, touch-first light puzzle for phone and desktop. Turn mirrors to wake ten handcrafted gardens. Later gardens add prisms that split the beam. There are no accounts, ads, timers, or scores.

**Download for Android:** [Sol: Lightkeeper v1.0 APK](https://shaunmcintyre813.github.io/sol-lightkeeper/downloads/Sol-Lightkeeper-v1.0.apk).

**Play in a browser:** [Sol: Lightkeeper on GitHub Pages](https://shaunmcintyre813.github.io/sol-lightkeeper/).

The [owner-private Site](https://sol-lightkeeper.shaun-mcintyre813.chatgpt.site) hosts the same game for a private preview. Progress is kept separately by each browser origin, so choose one install link and keep using it.

## Android app

Download the APK on your phone, open it from Chrome's Downloads or your Files app, and confirm **Install**. Android may first ask you to allow installs from Chrome or Files. The app appears as **Sol: Lightkeeper** in the app drawer. It contains the full game, works without a connection, and requests no Internet permission. The APK's [SHA-256 checksum](dist/downloads/Sol-Lightkeeper-v1.0.apk.sha256) is published beside it.

The Android app stores progress separately from the Chrome version. Installing it does not erase Chrome's saved progress or require removing a stuck Chrome web-app installation.

## Browser install

Open the published HTTPS link on your phone. On Android, use Chrome's **⋮ → Add to Home screen** or **Install app**. If Chrome says Sol is already installed but no icon appears, use **Add to Home screen → Create shortcut**. On iPhone, use Safari's **Share → Add to Home Screen**. After the first online visit, the installed web game can open offline. Progress and sound preference are stored on that device.

The browser install is a PWA. The direct Android APK above is a separate install option.

## Run locally

Node.js 20+ is enough. Run `node dev-server.mjs` and visit `http://127.0.0.1:8019/`. Run `node --test tests/*.test.mjs` to check all authored routes and beam behavior. The deployable static files are in `dist/`.

To build the Android APK, install Android SDK Build Tools 36.0.0, Android SDK Platform 37, and a JDK, then run `powershell -ExecutionPolicy Bypass -File android/build-android.ps1`. The script packages the files in `dist/` inside a minimal offline WebView. Its signing key and password stay in ignored `release/` files; keep those files to sign future updates with the same identity. The source and signed APK are both in this repository for review. Published APK signer certificate SHA-256: `48cece6f8fd9b23d97bc919a7554ee653fa69bee9f175f976f0e5df641f0df3c`.

## Design notes

- Tap a mirror or keyboard-focus it and press Enter/Space to turn it.
- Reset restores that garden's starting arrangement. Nudge turns one mirror toward the authored solution.
- Progress resumes locally; any unlocked garden can be replayed.
- Sound is optional and reduced-motion preferences shorten beam animation.
- The game uses no third-party scripts, analytics, downloads, or network services after install.
