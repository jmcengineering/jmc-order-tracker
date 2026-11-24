# jmc-order-tracker

JMC Engineering order management, a single-page app hosted on GitHub Pages:
<https://jmcengineering.github.io/jmc-order-tracker/jmc_order_tracker.html>

- Sign-in: Microsoft 365 (MSAL). Access is controlled by the *Access List* sheet.
- Data: the OneDrive Excel workbook plus the `tool_images/`, `drawings/`, `3d_models/` and `wirecut_programs/` folders, through Microsoft Graph.
- PDF import: Claude Vision reads each drawing's title block (admin only; the key is in the hidden *Config* sheet).

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## Share drawings (PDFs and photos) from WhatsApp to the Order Tracker (v3.2 + v3.3)

### What changed

| File | What it does |
|---|---|
| `manifest.webmanifest` | Makes the site installable as **JMC Orders** and registers it as an Android share target (`share_target` → `./share-target`, POST, multipart): PDFs in field `pdf`, JPG/PNG/WebP photos in field `image`. |
| `sw.js` | Service worker. It receives the shared files, stores them on the phone, and redirects (303) to the app. It also caches the app so it opens offline. It never caches or touches Microsoft login, Graph or Claude calls. |
| `share-queue.js` | The small IndexedDB queue used by both the service worker and the page. It checks each file (PDF or JPG/PNG/WebP, 25 MB max) and groups all photos from one share into one drawing set. |
| `icons/` | App icons generated from `jmc_logo.png` (192, 512, maskable 512, Apple touch icon, favicon). |
| `jmc_order_tracker.html` | Links the manifest, registers the worker, and adds the **New Order from Shared Drawing** screen, the **📲 Install app** hint and the offline screen. Turns shared photos into one PDF before the import. Keeps the sign-in in the installed app. Version **v3.3**. |

**How a shared drawing flows (no second import path):**

```
WhatsApp → Share → JMC Orders
  → sw.js receives POST ./share-target, saves each PDF (and the photos, as one set) in IndexedDB, 303 → jmc_order_tracker.html
  → (installed app: already signed in; otherwise sign in, and the files wait on the phone)
  → "New Order from Shared Drawing" screen → choose client (remembered next time)
  → photos only: combined into ONE PDF on the phone (one A3-sized page per photo, jsPDF)
  → for each PDF: A.pendingPDFFile = file → startPDFImport()   ← the same function as the Import PDF button
  → same Claude Vision progress + review table (details + thumbnails) → you edit → Confirm
  → confirmPDFImport() writes Excel and uploads the image and drawing, exactly as before
```

### Install on your Android phone

1. Open **Chrome** on the phone and go to
   `https://jmcengineering.github.io/jmc-order-tracker/jmc_order_tracker.html`
2. Tap **⋮** (top right) → **Install app** (on some phones: **Add to Home screen** → **Install**).
   You can also tap **📲 Install app** on the login screen; it shows the same steps, and an *Install now* button when Chrome offers one.
3. Open **JMC Orders** from the home screen once and sign in as `info@jmcengg.com`. The installed app remembers the sign-in until you press **Sign out**. Microsoft may occasionally ask again when its own session expires.
4. Done. **JMC Orders** now appears in the Android share sheet for PDFs and photos.

**Already installed v3.2?** Chrome refreshes an installed app's settings by itself, which can take a day. If **JMC Orders** doesn't appear when you share a photo, long-press the app icon → **Uninstall** (or App info → Uninstall), then install it again from Chrome. Your orders are not affected; they live in OneDrive.

### Test checklist for the phone

- [ ] The app is installed: the JMC icon is on the home screen and opens without the Chrome address bar.
- [ ] WhatsApp → open a chat with a drawing PDF → long-press the PDF (or open it) → **Share** → **JMC Orders**.
- [ ] The app opens. If asked, sign in and the screen continues by itself, with the PDF still listed.
- [ ] **New Order from Shared PDF** shows the file. Choose the client (only needed the first time).
- [ ] The import starts automatically: the progress bar reads "Page 1 of N — Claude Vision analysing…".
- [ ] The review table shows part no / name / work order / qty / dimensions. Swipe the table left to see the **thumbnails**.
- [ ] Change a value, then tap **Create…**. The order appears in the list with its image, and the drawing is in OneDrive `drawings/`.
- [ ] Share **two PDFs at once**: each opens as its own review, one after another.
- [ ] Share a second PDF a minute later: **no sign-in screen** this time.
- [ ] Share **one photo** of a drawing: one review row → **Create 1 order**.
- [ ] Select **3 photos** of one tool's drawings in WhatsApp → Share → JMC Orders: one review with 3 rows → **Create 1 parent + 3 parts**. Check the drawing in OneDrive `drawings/` is a 3-page PDF.
- [ ] Share the **same PDF again**: you see "Already imported?" with *Skip* / *Import anyway*, and nothing is created.
- [ ] Share a Word file: it is listed as "Not accepted" with the reason.
- [ ] Turn on **flight mode**, share a PDF: the "You're offline… saved on this phone" screen appears. Turn flight mode off: it continues to sign-in and the import.

### What cannot work on the current hosting, and other limits

- **Nothing changes on the phone until this is live on GitHub Pages.** The work is on branch `claude/exciting-maxwell-8mat1p` and must be merged into the branch Pages publishes (normally `main`). No other hosting change is needed: GitHub Pages is HTTPS, which a PWA requires, and the Microsoft login redirect URL is unchanged, so no Azure change is needed either.
- **Android only.** iPhone/iPad Safari can add the app to the home screen but does not support sharing files into web apps.
- **The app must be installed and opened once** before it appears in the share sheet.
- **Admin only.** Only `info@jmcengg.com` has the Claude key. Other accounts see a message, and their shared files stay on the phone until removed.
- **Sign-in:** the installed app keeps you signed in between shares (v3.3). If Microsoft's own session expires (roughly daily for this kind of app, longer if you use Microsoft 365 regularly on the phone), you sign in once and the shared files continue by themselves. Normal browser tabs still sign in per tab, as before.
- **Photos are only as readable as WhatsApp sends them.** WhatsApp shrinks normal photos, which can make small title-block text unreadable to Claude; the review then shows "Manual" rows to fill in. For best results send the drawing as a **Document** (or in **HD**), or share the PDF. The photo's title block must be in the bottom-right corner, as on a normal drawing sheet, and the photo should be straight, not at an angle.
- **iPhone photos in HEIC format** can't be read by the browser. They are refused with a message; share them as JPG (WhatsApp normally converts them).
- **Duplicate check uses the original file name.** Orders imported **before v3.2** never recorded the file name, so re-sharing an old drawing is not detected. Everything imported from v3.2 on (shared or in-app) is.
- **Offline:** the PDF is safe on the phone and imports when the app is open and online again. It can't import in the background with the app closed, because you have to review it anyway.
- 25 MB per PDF (change `MAX_BYTES` in `share-queue.js` to adjust).
