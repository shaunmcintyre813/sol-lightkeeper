# Cache maintenance

Content 1.0.4, build 5, uses web cache `sol-lightkeeper-v7`. Activation removes
only obsolete `sol-lightkeeper-` caches and retains other games' offline
files. Garden content, mirror ordering, save keys, runtime module URLs,
manifest identity, Android package/signing identity, and APK downloads are
unchanged. The signed APK remains 1.0.2.

Only the worker changes in the downloadable content bundle. The manifest is
regenerated from the exact files; the native updater verifies the complete
bundle as usual and retains its original app storage origin.

The .gitattributes rules keep the manifest's text assets in LF form on both
Windows and Linux. Binary icons and APK downloads retain their exact bytes.

## Regression and release checks

```sh
node --test tests/*.test.mjs
node tools/update-manifest.mjs --check
```

On Windows, also run:

```powershell
powershell -ExecutionPolicy Bypass -File tests/run-native-tests.ps1
```

The cache test executes the real activation handler with synthetic
origin-wide names. It checks current-cache retention, own-cache cleanup,
foreign-cache preservation, first install, and empty storage.
The pull-request workflow also checks puzzles, the complete content manifest,
and native update rollback. The publishing workflow includes the cache test.

Before release, cache two games on different paths of the same test origin,
activate this candidate worker, and reopen both offline without clearing
site data. Browser/PWA and APK save/update acceptance are separate.
Automated checks do not establish physical-device or subjective-audio acceptance.

For rollback after build 5 reaches native apps, use a later build number with
the prior known-good content and regenerate its manifest. The native updater
intentionally rejects lower build numbers; redeploying build 4 alone is not
an APK content rollback. Follow the existing README release process.
