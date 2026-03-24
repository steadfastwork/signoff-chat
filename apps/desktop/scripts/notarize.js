/**
 * macOS notarization hook — called by electron-builder after code signing.
 *
 * Requires env vars:
 *   APPLE_ID         — your Apple ID email
 *   APPLE_APP_PASSWORD — app-specific password (appleid.apple.com/account/manage)
 *   APPLE_TEAM_ID    — your 10-character Team ID from developer.apple.com
 *
 * Set these in CI secrets, never commit them.
 */

const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize on macOS
  if (electronPlatformName !== "darwin") return;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      "[notarize] Skipping — APPLE_ID, APPLE_APP_PASSWORD, or APPLE_TEAM_ID not set."
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Submitting ${appName} to Apple Notary Service…`);

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });

  console.log(`[notarize] Done.`);
};
