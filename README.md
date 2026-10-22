# Sol: Lightkeeper

A quiet, touch-first light puzzle for phone and desktop. Turn mirrors to wake ten handcrafted gardens. Later gardens add prisms that split the beam. There are no accounts, ads, timers, or scores.

**Play and install:** [Sol: Lightkeeper on GitHub Pages](https://shaunmcintyre813.github.io/sol-lightkeeper/).

The [owner-private Site](https://sol-lightkeeper.shaun-mcintyre813.chatgpt.site) hosts the same game for a private preview. Progress is kept separately by each browser origin, so choose one install link and keep using it.

## Play and install

Open the published HTTPS link on your phone. On Android, use Chrome's **⋮ → Add to Home screen** or **Install app**. On iPhone, use Safari's **Share → Add to Home Screen**. After the first online visit, the installed game can open offline. Progress and sound preference are stored only in that browser or installed app on that device.

The installed web app is a PWA, not an Android APK. If a browser does not offer an install prompt, the home-screen menu option still works.

## Run locally

Node.js 20+ is enough. Run `node dev-server.mjs` and visit `http://127.0.0.1:8019/`. Run `node --test tests/*.test.mjs` to check all authored routes and beam behavior. The deployable static files are in `dist/`.

## Design notes

- Tap a mirror or keyboard-focus it and press Enter/Space to turn it.
- Reset restores that garden's starting arrangement. Nudge turns one mirror toward the authored solution.
- Progress resumes locally; any unlocked garden can be replayed.
- Sound is optional and reduced-motion preferences shorten beam animation.
- The game uses no third-party scripts, analytics, downloads, or network services after install.
