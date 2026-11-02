# jmc-order-tracker

JMC Engineering order management, a single-page app hosted on GitHub Pages:
<https://jmcengineering.github.io/jmc-order-tracker/jmc_order_tracker.html>

- Sign-in: Microsoft 365 (MSAL). Access is controlled by the *Access List* sheet.
- Data: the OneDrive Excel workbook plus the `tool_images/`, `drawings/`, `3d_models/` and `wirecut_programs/` folders, through Microsoft Graph.
- PDF import: Claude Vision reads each drawing's title block (admin only; the key is in the hidden *Config* sheet).

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## v3.2: Share PDFs from WhatsApp to the Order Tracker

### What changed

| File | What it does |
|---|---|
| `manifest.webmanifest` | Makes the site installable as **JMC Orders** and registers it as an Android share target for PDFs (`share_target` → `./share-target`, POST, multipart, field `pdf`). |
| `sw.js` | Service worker. It receives the shared PDFs, stores them on the phone, and redirects (303) to the app. It also caches the app so it opens offline. It never caches or touches Microsoft login, Graph or Claude calls. |
| `share-queue.js` | The small IndexedDB queue used by both the service worker and the page. It checks each file (must be a PDF, 25 MB max). |
| `icons/` | App icons generated from `jmc_logo.png` (192, 512, maskable 512, Apple touch icon, favicon). |
| `jmc_order_tracker.html` | Links the manifest, registers the worker, and adds the **New Order from Shared PDF** screen, the **📲 Install app** hint and the offline screen. Version **v3.2**. |

**How a shared PDF flows (no second import path):**

```
WhatsApp → Share → JMC Orders
  → sw.js receives POST ./share-target, saves each PDF in IndexedDB, 303 → jmc_order_tracker.html
  → (sign in with Microsoft if needed; the files wait on the phone)
  → "New Order from Shared PDF" screen → choose client (remembered next time)
  → for each PDF: A.pendingPDFFile = file → startPDFImport()   ← the same function as the Import PDF button
  → same Claude Vision progress + review table (details + thumbnails) → you edit → Confirm
  → confirmPDFImport() writes Excel and uploads the image and drawing, exactly as before
```

### Install on your Android phone

1. Open **Chrome** on the phone and go to
   `https://jmcengineering.github.io/jmc-order-tracker/jmc_order_tracker.html`
2. Tap **⋮** (top right) → **Install app** (on some phones: **Add to Home screen** → **Install**).
   You can also tap **📲 Install app** on the login screen; it shows the same steps, and an *Install now* button when Chrome offers one.
3. Open **JMC Orders** from the home screen once and sign in as `info@jmcengg.com`.
4. Done. **JMC Orders** now appears in the Android share sheet for PDFs.

### Test checklist for the phone

- [ ] The app is installed: the JMC icon is on the home screen and opens without the Chrome address bar.
- [ ] WhatsApp → open a chat with a drawing PDF → long-press the PDF (or open it) → **Share** → **JMC Orders**.
- [ ] The app opens. If asked, sign in and the screen continues by itself, with the PDF still listed.
- [ ] **New Order from Shared PDF** shows the file. Choose the client (only needed the first time).
- [ ] The import starts automatically: the progress bar reads "Page 1 of N — Claude Vision analysing…".
- [ ] The review table shows part no / name / work order / qty / dimensions. Swipe the table left to see the **thumbnails**.
- [ ] Change a value, then tap **Create…**. The order appears in the list with its image, and the drawing is in OneDrive `drawings/`.
- [ ] Share **two PDFs at once**: each opens as its own review, one after another.
- [ ] Share the **same PDF again**: you see "Already imported?" with *Skip* / *Import anyway*, and nothing is created.
- [ ] Share a photo or a Word file: it is listed as "Not accepted" with the reason.
- [ ] Turn on **flight mode**, share a PDF: the "You're offline… saved on this phone" screen appears. Turn flight mode off: it continues to sign-in and the import.

### What cannot work on the current hosting, and other limits

- **Nothing changes on the phone until this is live on GitHub Pages.** The work is on branch `claude/exciting-maxwell-8mat1p` and must be merged into the branch Pages publishes (normally `main`). No other hosting change is needed: GitHub Pages is HTTPS, which a PWA requires, and the Microsoft login redirect URL is unchanged, so no Azure change is needed either.
- **Android only.** iPhone/iPad Safari can add the app to the home screen but does not support sharing files into web apps.
- **The app must be installed and opened once** before it appears in the share sheet.
- **Admin only.** Only `info@jmcengg.com` has the Claude key. Other accounts see a message, and their shared files stay on the phone until removed.
- **You will usually sign in on each share.** Login stays in `sessionStorage` (unchanged, as decided). The shared files are kept through the sign-in and the import continues by itself.
- **Duplicate check uses the original file name.** Orders imported **before v3.2** never recorded the file name, so re-sharing an old drawing is not detected. Everything imported from v3.2 on (shared or in-app) is.
- **Offline:** the PDF is safe on the phone and imports when the app is open and online again. It can't import in the background with the app closed, because you have to review it anyway.
- 25 MB per PDF (change `MAX_BYTES` in `share-queue.js` to adjust).
