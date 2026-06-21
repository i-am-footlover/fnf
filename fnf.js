// =========================
// SCRIPTABLE FOLDER SYNC
// =========================
//
// Invocation (from the QR code / shortcut link the server prints):
//   scriptable:///run/fnf?host=...&port=...&name=...&openEditor=true

const fm = FileManager.local();

// Config file
const CONFIG_PATH = fm.documentsDirectory() + "/fnf-sync-config.json";

// =========================
// MAIN
// =========================

async function main() {
  const { host, port, name } = args.queryParameters;

  if (!host || !port || !name) {
    console.error("Missing host, port or name query parameter");
    return;
  }

  const root = await getRoot();

  if (!root) {
    console.log("No root folder configured, aborting");
    return;
  }

  const BASE = `http://${host}:${port}`;

  // Final sync directory:
  // <bookmarked-root>/<folder-name>/

  const syncRoot = root + "/" + name;

  if (!fm.fileExists(syncRoot)) {
    fm.createDirectory(syncRoot, true);
  }

  console.log(`Host: ${host}:${port}`);
  console.log(`Folder: ${name}`);
  console.log(`Sync root: ${syncRoot}`);
  console.log("");

  const progress = new ProgressBar(`Syncing "${name}"`, `${host}:${port}`);
  await progress.present();
  await progress.update(0, "Fetching file list…");

  // =========================
  // FETCH MANIFEST
  // =========================

  let remote;

  try {
    remote = await fetchRemoteManifest(BASE);
  } catch (e) {
    console.error("Manifest fetch failed");
    console.error(String(e));

    await progress.fail("Could not fetch the file list");
    await progress.waitForDismiss();

    return;
  }

  console.log(`Remote files: ${remote.length}`);
  console.log("");

  // =========================
  // SYNC FILES
  // =========================

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const total = remote.length;

  if (total === 0) {
    await progress.update(100, "Nothing to sync");
  }

  for (let i = 0; i < remote.length; i++) {
    const rel = remote[i];
    const pct = Math.round(((i + 1) / total) * 100);
    const localPath = syncRoot + "/" + rel;

    // Skip existing files
    if (fm.fileExists(localPath)) {
      skipped++;
      await progress.update(pct, `Skipped ${i + 1}/${total}: ${rel}`);
      continue;
    }

    console.log(`NEW: ${rel}`);
    await progress.update(pct, `Downloading ${i + 1}/${total}: ${rel}`);

    try {
      await downloadFile(BASE, syncRoot, rel);

      downloaded++;
    } catch (e) {
      console.error(`FAILED: ${rel}`);
      console.error(String(e));

      failed++;
    }
  }

  // =========================
  // DONE
  // =========================

  console.log("");
  console.log("==========");
  console.log("Sync Complete");
  console.log("==========");

  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);

  await progress.complete(downloaded, skipped, failed);
  await progress.waitForDismiss();
}

// =========================
// PROGRESS UI (WebView bar)
// =========================
//
// Presents a small HTML page with a progress bar inside a WebView.
// `present()` is intentionally NOT awaited internally - that lets the
// sync loop keep running while the bar is on screen. We store the
// promise and await it later (waitForDismiss) so the script doesn't
// exit until the user has actually seen and dismissed the result.

class ProgressBar {
  constructor(title, subtitle) {
    this.title = title;
    this.subtitle = subtitle || "";
    this.webView = new WebView();
    this.dismissPromise = null;
    this.closed = false;
  }

  async present() {
    await this.webView.loadHTML(this._html());

    this.dismissPromise = this.webView.present(false).then(() => {
      this.closed = true;
    });
  }

  async update(percent, status) {
    await this._eval(`setProgress(${percent}, ${JSON.stringify(status)})`);
  }

  async complete(downloaded, skipped, failed) {
    const summary = `Downloaded ${downloaded} · Skipped ${skipped} · Failed ${failed}`;
    const hadFailures = failed > 0;

    await this._eval(`setDone(${JSON.stringify(summary)}, ${hadFailures})`);
  }

  async fail(message) {
    await this._eval(`setError(${JSON.stringify(message)})`);
  }

  async waitForDismiss() {
    if (this.dismissPromise) {
      await this.dismissPromise;
    }
  }

  async _eval(js) {
    if (this.closed) return;

    try {
      await this.webView.evaluateJavaScript(js, false);
    } catch (e) {
      // User likely closed the bar early - ignore.
    }
  }

  _html() {
    return `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, sans-serif;
    background: #1c1c1e;
    color: #fff;
    margin: 0;
    padding: 28px 24px;
  }
  h2 {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }
  .subtitle {
    font-size: 12px;
    color: #8e8e93;
    margin: 0 0 18px 0;
  }
  .track {
    background: #3a3a3c;
    border-radius: 10px;
    height: 18px;
    overflow: hidden;
  }
  #bar {
    background: #0a84ff;
    height: 100%;
    width: 0%;
    transition: width 0.25s ease, background-color 0.25s ease;
  }
  #pct {
    margin-top: 10px;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
  }
  #status {
    margin-top: 14px;
    font-size: 13px;
    color: #9b9b9d;
    word-break: break-all;
    min-height: 16px;
  }
</style>
</head>
<body>
  <h2>${this.title}</h2>
  <div class="subtitle">${this.subtitle}</div>
  <div class="track"><div id="bar"></div></div>
  <div id="pct">0%</div>
  <div id="status">Starting…</div>

  <script>
    function setProgress(pct, status) {
      document.getElementById('bar').style.width = pct + '%';
      document.getElementById('pct').textContent = pct + '%';
      document.getElementById('status').textContent = status;
    }
    function setDone(summary, hadFailures) {
      const bar = document.getElementById('bar');
      bar.style.width = '100%';
      bar.style.background = hadFailures ? '#ff9f0a' : '#34c759';
      document.getElementById('pct').textContent = 'Done';
      document.getElementById('status').textContent = summary;
    }
    function setError(message) {
      const bar = document.getElementById('bar');
      bar.style.background = '#ff453a';
      document.getElementById('pct').textContent = 'Error';
      document.getElementById('status').textContent = message;
    }
  </script>
</body>
</html>`;
  }
}

// =========================
// ROOT FOLDER (bookmark-based)
// =========================

function loadRootBookmarkName() {
  if (fm.fileExists(CONFIG_PATH)) {
    try {
      const raw = fm.readString(CONFIG_PATH);
      const config = JSON.parse(raw);

      if (config.bookmarkName) {
        return config.bookmarkName;
      }
    } catch (e) {
      console.error("Invalid config file");
    }
  }

  return null;
}

function saveRootBookmarkName(bookmarkName) {
  fm.writeString(CONFIG_PATH, JSON.stringify({ bookmarkName }, null, 2));
}

// Resolves the configured root folder to an actual path, prompting for
// (and persisting) a bookmark name if none is set yet, or if the saved
// bookmark no longer exists.
async function getRoot() {
  let bookmarkName = loadRootBookmarkName();

  if (!bookmarkName) {
    bookmarkName = await configureRoot();
  } else if (!fm.bookmarkExists(bookmarkName)) {
    console.error(`Bookmark "${bookmarkName}" not found`);
    bookmarkName = await configureRoot();
  }

  if (!bookmarkName) {
    return null;
  }

  return fm.bookmarkedPath(bookmarkName);
}

// Prompts for a bookmark name and validates + saves it.
async function configureRoot() {
  const existing = loadRootBookmarkName();

  const bookmarkName = await prompt(
    "Root Folder Bookmark Name",
    existing || "",
  );

  if (!bookmarkName) {
    return null;
  }

  if (!fm.bookmarkExists(bookmarkName)) {
    const alert = new Alert();

    alert.title = "Bookmark Not Found";
    alert.message =
      `No bookmark named "${bookmarkName}" exists yet.\n\n` +
      `Add one in Scriptable's settings (Settings > File Bookmarks) ` +
      `pointing at your sync folder, then try again.`;

    alert.addAction("OK");

    await alert.present();

    return null;
  }

  saveRootBookmarkName(bookmarkName);

  console.log(`Root bookmark set: ${bookmarkName}`);
  console.log("");

  return bookmarkName;
}

// =========================
// PROMPT
// =========================

async function prompt(title, value = "") {
  const alert = new Alert();

  alert.title = title;

  alert.addTextField("", value);

  alert.addAction("OK");

  alert.addCancelAction("Cancel");

  const result = await alert.present();

  if (result === -1) {
    return null;
  }

  return alert.textFieldValue(0).trim();
}

// =========================
// NETWORK
// =========================

async function fetchRemoteManifest(BASE) {
  const url = `${BASE}/list`;

  console.log(`GET ${url}`);

  const req = new Request(url);

  let json;

  try {
    json = await req.loadJSON();
  } catch (e) {
    throw new Error(`Network error\n${e}`);
  }

  // HTTP status errors

  if (req.response && req.response.statusCode >= 400) {
    throw new Error(`HTTP ${req.response.statusCode}`);
  }

  return json;
}

async function downloadFile(BASE, root, rel) {
  const url = `${BASE}/download/` + `${encodeURIComponent(rel)}`;

  console.log(`Downloading ${rel}`);

  const req = new Request(url);

  let data;

  try {
    data = await req.load();
  } catch (e) {
    throw new Error(`Network error\n${e}`);
  }

  // HTTP status errors

  if (req.response && req.response.statusCode >= 400) {
    throw new Error(`HTTP ${req.response.statusCode}`);
  }

  const target = root + "/" + rel;

  ensureParentDir(target);

  fm.write(target, data);
}

// =========================
// HELPERS
// =========================

function ensureParentDir(path) {
  const parts = path.split("/");

  parts.pop();

  let current = "";

  for (const part of parts) {
    if (!part) continue;

    current += "/" + part;

    if (!fm.fileExists(current)) {
      fm.createDirectory(current);
    }
  }
}

// =========================
// SHORTCUT PARAMS
// =========================

if (args.queryParameters.resetRoot === "1") {
  const bookmarkName = await configureRoot();

  if (bookmarkName) {
    console.log("Root folder reconfigured");
  } else {
    console.log("Reconfiguration cancelled");
  }
} else {
  await main();
}
