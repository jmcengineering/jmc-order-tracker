# Changelog

## v3.2 — Share to Order Tracker (2026-11-02)

**New**
- The app is now an installable PWA ("JMC Orders"): `manifest.webmanifest`, `sw.js`, icons made from `jmc_logo.png`.
- **Share PDFs from WhatsApp (Android):** Share → JMC Orders. The PDF goes into the same Claude Vision import (`startPDFImport`) as the in-app *Import Parts from PDF* button. You get the same progress bar and the same review table, and nothing is saved until you confirm.
- You can share several PDFs at once. Each one is imported separately, one after another.
- Shared files are kept on the phone (IndexedDB) through Microsoft sign-in and while offline. When the phone is back online they import automatically.
- Clear errors for files that aren't PDFs, files over 25 MB, and unreadable or failed imports, with **Retry** / **Import again** / **Remove** buttons.
- Duplicate warning: if a PDF with the same file name was already imported, you're warned and nothing is created unless you press **Import anyway**.
- An **📲 Install app** button (top bar and login screen) with step-by-step instructions.

**Changed**
- Orders created by PDF import now record the original file name in Remarks (`Source PDF: <name>.pdf`). Drawings are renamed `<sr>-<NAME>.pdf` when uploaded, so the original name was being lost. This applies to the in-app import too.
- On phones, the PDF-import review table scrolls sideways so Qty, Dimensions and the thumbnail column stay visible. Desktop is unchanged.
- `closePDFImport()` now tells the shared-PDF queue whether the import was saved, cancelled or failed. Nothing else about it changed.

**Unchanged**
- All existing screens, routes, Excel columns, the OneDrive folders, the login (MSAL, `sessionStorage`) and the Claude prompt/model.
