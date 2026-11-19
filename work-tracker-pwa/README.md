# Personal Work Tracker PWA

A local-first progressive web app for personal work-hour tracking. It uses IndexedDB in the browser; it does not send work records to GitHub or another service.

## Included

- One-tap check-in / check-out inside the app.
- URL-triggered toggle for an iPhone Shortcuts Home Screen widget.
- Multiple sessions per day, editable start/end times, lunch deductions, location, notes, and Pending/Confirmed status.
- Weekly target and balance, daily progress, office/home schedule.
- Separate paid-holiday credits. A holiday credit is Pending until explicitly confirmed.
- JSON full backup and restore; CSV session export.
- Offline app shell after the first successful load.

## Data and privacy

- Live records are stored in IndexedDB for the app's origin on that device/browser.
- GitHub Pages hosts only the static application files. It does not host or receive the work records.
- Browser storage is not a backup. Export JSON regularly and keep a copy somewhere safe.
- On iPhone, use Safari browser storage (not an installed standalone Home Screen web app) so the PWA page and the Shortcuts URL action share the same IndexedDB. iOS isolates storage for standalone Home Screen web apps from Safari, and iOS does not reliably route external deep links into an installed PWA.
- Clearing website data, uninstalling/resetting the browser, or losing the device can erase local records if no backup exists.

## Deploy to GitHub Pages

1. Create a **private GitHub repository** named `work-tracker` (the repository can be private; confirm that GitHub Pages is available for your account/repository settings).
2. Put the contents of this folder at the repository root. Do not put the folder itself one level down.
3. In the repository, open **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Wait for the deployment. The app URL will look like `https://YOUR-GITHUB-USERNAME.github.io/work-tracker/`.
6. Open that URL on your desktop and iPhone. Use it in Safari on iPhone. You may add a Home Screen bookmark, but do **not** open it as a standalone web app. On iOS 26, turn off **Open as Web App** when adding it to the Home Screen. On earlier iOS versions, the app manifest requests browser display.

The repository stores the app source only. Do not add JSON backups, exported CSVs, or personal work records to the repository.

## Preserve the existing iPhone Shortcut widget

The original shortcut used a `Get Contents of URL` POST to the Google Apps Script `/exec` endpoint with a JSON body containing `action: "toggle"` and a token. A static GitHub Pages site cannot receive that POST and write to browser-local IndexedDB. The equivalent local-first shortcut action is to open the app in Safari with a toggle query parameter. The app then performs the toggle in Safari’s local IndexedDB.

After deployment:

1. Duplicate your existing shortcut first so the old version remains as a fallback.
2. Keep the shortcut's existing name and icon; this preserves the Home Screen widget's appearance.
3. In the duplicate, remove the old `Get Contents of URL` POST action (and its token/body).
4. Add an **Open URLs** action with this URL, replacing the username if needed:

   `https://YOUR-GITHUB-USERNAME.github.io/work-tracker/?action=toggle&source=iphone-shortcut`

5. Save the shortcut. Keep the existing Home Screen shortcut widget or add the duplicated shortcut to the Home Screen.
6. Tap it once while checked out: the app should open and create a Pending check-in. Tap it again: it should close that open session. Check that both actions appear in the app's Sessions list.

**Important iOS design choice:** the shortcut opens the Work Tracker URL in Safari, and the app must also be used in Safari. Do not install/open a standalone Home Screen web app for this local-only version: iOS gives standalone web apps a separate IndexedDB store, and Shortcuts cannot reliably deep-link into that isolated app. A Home Screen bookmark with “Open as Web App” disabled is fine. After changing the shortcut, test one check-in and one check-out and confirm that both appear in the same Safari Work Tracker session list.

## Work rules

Defaults are Monday–Friday, 8 hours/day and 40 hours/week; Monday, Wednesday and Thursday are Office; Tuesday and Friday are Home. Gaps between separate sessions naturally represent breaks. A lunch deduction can also be entered on a manually edited session. Paid-holiday credits are stored separately and count toward the weekly target only after being marked Confirmed.

New sessions created by the timer are Pending. Confirm records manually after reviewing them. Pending work sessions are still included in the recorded-hours calculation so the live balance remains useful; their status is visible in the session list.

## Local development

Serve the folder over HTTP (service workers do not work from `file://`):

```bash
npx http-server . -p 8080
```

Then open `http://localhost:8080/`.

## Backup format

Use **Settings & data → Download JSON backup**. Restore replaces the Work Tracker data currently stored in that browser, after confirmation. Keep multiple dated backups. CSV export is intended for spreadsheet analysis, not full restore.
