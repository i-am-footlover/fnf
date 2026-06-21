// =========================
// SCRIPTABLE FOLDER SYNC
// =========================
//
// Invocation (from the QR code / shortcut link the server prints):
//   scriptable:///run/fnf?host=...&port=...&name=...

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

  // =========================
  // FETCH MANIFEST
  // =========================

  let remote;

  try {
    remote = await fetchRemoteManifest(BASE);
  } catch (e) {
    console.error("Manifest fetch failed");
    console.error(String(e));
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

  for (const rel of remote) {
    const localPath = syncRoot + "/" + rel;

    // Skip existing files
    if (fm.fileExists(localPath)) {
      skipped++;
      continue;
    }

    console.log(`NEW: ${rel}`);

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
