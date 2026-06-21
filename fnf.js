const fm = FileManager.local();

async function main() {
  const root = await DocumentPicker.openFolder();

  if (!root) {
    console.log("No folder selected");
    return;
  }

  const host = await prompt("Server Host", "192.168.1.1");

  if (!host) return;

  const port = await prompt("Server Port", "8698");

  if (!port) return;

  const share = await prompt("Share Name", "");

  if (!share) return;

  const BASE = `http://${host}:${port}`;

  // Final sync directory:
  // <picked-folder>/<share>/

  const syncRoot = root + "/" + share;

  if (!fm.fileExists(syncRoot)) {
    fm.createDirectory(syncRoot, true);
  }

  console.log(`Host: ${host}:${port}`);
  console.log(`Share: ${share}`);
  console.log(`Sync root: ${syncRoot}`);
  console.log("");

  // =========================
  // FETCH MANIFEST
  // =========================

  let remote;

  try {
    remote = await fetchRemoteManifest(BASE, share);
  } catch (e) {
    console.error("Manifest fetch failed");
    console.error(String(e));
    return;
  }

  console.log(`Remote files: ${Object.keys(remote).length}`);

  console.log("");

  // =========================
  // SYNC FILES
  // =========================

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [rel] of Object.entries(remote)) {
    if (rel.startsWith(".backup/")) {
      continue;
    }

    const localPath = syncRoot + "/" + rel;

    // Skip existing files

    if (fm.fileExists(localPath)) {
      skipped++;
      continue;
    }

    console.log(`NEW: ${rel}`);

    try {
      await downloadFile(BASE, share, syncRoot, rel);

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
// PROMPT
// =========================

async function prompt(title, value = "") {
  const alert = new Alert();

  alert.title = title;

  alert.addTextField("", value);

  alert.addAction("OK");

  alert.addCancelAction("Cancel");

  // IMPORTANT:
  // use present()
  // NOT presentAlert()

  const result = await alert.present();

  if (result === -1) {
    return null;
  }

  return alert.textFieldValue(0).trim();
}

// =========================
// NETWORK
// =========================

async function fetchRemoteManifest(BASE, SHARE) {
  const url = `${BASE}/list/${encodeURIComponent(SHARE)}`;

  console.log(`GET ${url}`);

  const req = new Request(url);

  let json;

  try {
    json = await req.loadJSON();
  } catch (e) {
    throw new Error(`Network error\n${e}`);
  }

  // HTTP errors

  if (req.response && req.response.statusCode >= 400) {
    throw new Error(`HTTP ${req.response.statusCode}`);
  }

  return json;
}

async function downloadFile(BASE, SHARE, root, rel) {
  const encodedRel = encodePathSegments(rel);

  const url =
    `${BASE}/download/` + `${encodeURIComponent(SHARE)}/` + `${encodedRel}`;

  console.log(`Downloading ${rel}`);

  const req = new Request(url);

  let data;

  try {
    data = await req.load();
  } catch (e) {
    throw new Error(`Network error\n${e}`);
  }

  // HTTP errors

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

function encodePathSegments(rel) {
  return rel.split("/").map(encodeURIComponent).join("/");
}

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

await main();
