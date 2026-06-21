// =========================
// SCRIPTABLE FOLDER SYNC
// =========================

const fm = FileManager.local();

// Config file
// Stores:
// - root folder
// - host
// - port
// - share

const CONFIG_PATH = fm.documentsDirectory() + "/fnf-sync-config.json";

// =========================
// MAIN
// =========================

async function main() {
  const config = await getConfig();

  if (!config) {
    console.log("Setup cancelled");
    return;
  }

  const { root, host, port, share } = config;

  const BASE = `http://${host}:${port}`;

  // Final sync directory:
  // <destination-folder>/<share>/

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
    // Ignore backups

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
// CONFIG
// =========================

async function getConfig() {
  // Existing config

  if (fm.fileExists(CONFIG_PATH)) {
    try {
      const raw = fm.readString(CONFIG_PATH);

      const config = JSON.parse(raw);

      if (config.root && config.host && config.port && config.share) {
        return config;
      }
    } catch (e) {
      console.error("Invalid config file");
    }
  }

  // First run setup

  return await configure();
}

async function configure() {
  // Pick destination folder

  const root = await DocumentPicker.openFolder();

  if (!root) {
    return null;
  }

  // Server host

  const host = await prompt("Server Host", "192.168.1.");

  if (!host) {
    return null;
  }

  // Server port

  const port = await prompt("Server Port", "8698");

  if (!port) {
    return null;
  }

  // Share name

  const share = await prompt("Share Name", "");

  if (!share) {
    return null;
  }

  const config = {
    root,
    host,
    port,
    share,
  };

  saveConfig(config);

  console.log("Config saved");
  console.log("");

  return config;
}

function saveConfig(config) {
  fm.writeString(CONFIG_PATH, JSON.stringify(config, null, 2));
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
  const url = `${BASE}/list/` + `${encodeURIComponent(SHARE)}`;

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

// =========================
// SHORTCUT PARAMS
// =========================

// script
// -> normal sync
//
// script?reset=1
// -> clear saved config
//
// script?config=1
// -> force reconfigure

if (args.queryParameters.reset === "1") {
  if (fm.fileExists(CONFIG_PATH)) {
    fm.remove(CONFIG_PATH);

    console.log("Saved config cleared");
  } else {
    console.log("No saved config");
  }
} else if (args.queryParameters.config === "1") {
  const config = await configure();

  if (config) {
    console.log("Reconfiguration complete");
  } else {
    console.log("Reconfiguration cancelled");
  }
} else {
  await main();
}
