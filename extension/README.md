# Cursor Remote Extension

This extension starts a local pairing server, shows a QR code for the iOS app, stores pairing/APNs secrets, checks Cursor CDP connectivity, and sends APNs test notifications to paired devices.

## Development

```bash
cd extension
npm install
npm run compile
```

## Cursor CDP

Launch Cursor with Chrome DevTools Protocol enabled:

```bash
open -a Cursor --args --remote-debugging-port=9222
```

Then run `Cursor Remote: Check CDP Connection` to verify the extension can reach CDP.

## APNs (built-in)

Team ID, Key ID, bundle ID, and sandbox flag are set in `src/apnsDefaults.ts`. The APNs auth key file must be named `AuthKey_55LHUBZN69.p8` and sit in the **extension root** (next to `package.json`) so it is bundled when you build a `.vsix`. The key PEM is cached in VS Code `SecretStorage` after the first successful read.

Do not commit the `.p8` to a public repository (keep it gitignored; copy it in before packaging).
