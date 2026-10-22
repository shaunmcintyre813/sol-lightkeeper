# Sol: Lightkeeper

A quiet, touch-first light puzzle for phone and desktop. Turn mirrors to wake eleven handcrafted gardens. Later gardens add prisms that split the beam. There are no accounts, ads, timers, or scores.

**Download for Android:** [Sol: Lightkeeper v1.0.2 APK](https://shaunmcintyre813.github.io/sol-lightkeeper/downloads/Sol-Lightkeeper-v1.0.2.apk).

**Play in a browser:** [Sol: Lightkeeper on GitHub Pages](https://shaunmcintyre813.github.io/sol-lightkeeper/).

The [owner-private Site](https://sol-lightkeeper.shaun-mcintyre813.chatgpt.site) is a separate private preview. Its access and deployment are independent of this public GitHub Pages release. Each browser origin keeps its own progress.

## Android app

Download the APK on your phone, open it from Chrome's Downloads or your Files app, and confirm **Install**. Android may first ask you to allow installs from Chrome or Files. The app appears as **Sol: Lightkeeper** in the app drawer. Version 1.0.2 installs over 1.0.1 with the same package and signing identity. It includes a complete offline game and requests Internet and network-state access to check this public GitHub Pages release on launch. The APK's [SHA-256 checksum](dist/downloads/Sol-Lightkeeper-v1.0.2.apk.sha256) is published beside it.

Future **game-content** changes published here are downloaded into the installed app on its next online launch. The app checks and verifies every file before showing the new version; a missing or damaged update leaves the previous complete version in place. It never swaps content during a puzzle. The last working version opens offline. The update stays on the APK's original `https://appassets.androidplatform.net` origin, preserving `sol-lightkeeper-progress-v1` (current garden, unlocked and completed gardens, mirror state, sound preference, and first-visit state). Chrome and the private Site keep their own separate saves. Changes to native Android code, permissions, or the package still require a newly signed APK.

Content release 1.0.3 adds **One more morning** as an eleventh garden. It is delivered to the installed 1.0.2 Android app through the update manifest; the APK version remains 1.0.2.

On a fresh sideload, Google Play Protect may show **Unsafe app blocked** because it has not seen this new signing identity. In the Android emulator, **More details → Install anyway** completed the install. You can use the browser shortcut below if you prefer not to allow sideloading.

The Android app stores progress separately from the Chrome version. Installing it does not erase Chrome's saved progress or require removing a stuck Chrome web-app installation.

## Browser install

Open the published HTTPS link on your phone. On Android, use Chrome's **⋮ → Add to Home screen** or **Install app**. If Chrome says Sol is already installed but no icon appears, use **Add to Home screen → Create shortcut**. On iPhone, use Safari's **Share → Add to Home Screen**. After the first online visit, the installed web game can open offline. Progress and sound preference are stored on that device.

The browser install is a PWA. The direct Android APK above is a separate install option.

## Run locally

Node.js 20+ is enough. Run `node dev-server.mjs` and visit `http://127.0.0.1:8019/`. Run `node --test tests/*.test.mjs` to check all authored routes and beam behavior. The deployable static files are in `dist/`.

To build the Android APK, install Android SDK Build Tools 36.0.0, Android SDK Platform 37, and a JDK, then run `powershell -ExecutionPolicy Bypass -File android/build-android.ps1`. The script packages the exact files listed in `dist/update.manifest` inside the WebView. Its signing key and password stay in ignored `release/` files; the build fails if the existing key is missing. The source and signed APK are both in this repository for review. Published APK signer certificate SHA-256: `48cece6f8fd9b23d97bc919a7554ee653fa69bee9f175f976f0e5df641f0df3c`.

For later content-only releases, edit `dist/`, increase `content-version.json`'s `build`, run `node tools/update-manifest.mjs`, and publish the source to `main`. The Pages workflow checks the manifest and deploys `dist/`. Keep the existing APK download file available; players do not need a new APK for these content releases. Do not list APKs in the content manifest. Preserve existing garden indices and mirror order, or add an explicit save migration when changing them. Run `node --test tests/*.test.mjs` and `powershell -ExecutionPolicy Bypass -File tests/run-native-tests.ps1` before publishing.

## Design notes

- Tap a mirror or keyboard-focus it and press Enter/Space to turn it.
- Reset restores that garden's starting arrangement. Nudge turns one mirror toward the authored solution.
- Progress resumes locally; any unlocked garden can be replayed.
- Sound is optional and reduced-motion preferences shorten beam animation.
- The game uses no third-party scripts or analytics. The Android app contacts only the public GitHub Pages game for content updates.
