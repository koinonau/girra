/**
 * Electron names the `userData` directory after `app.getName()`, which `productName` in
 * `package.json` pins to this. Shared because the bundled CLI and the logs fallback resolve
 * the directory themselves, in their own processes, and must not drift from the app.
 *
 * Girra 1.0.0 shipped no `productName`, so the name fell through to `name` and that build
 * wrote its profile into `<appData>/orca`, the directory upstream Orca owns. Nothing here
 * reads that directory: a 1.0.0 profile stays where it is so Orca keeps working.
 */
export const USER_DATA_DIR_NAME = 'Girra'
