const BASE = "http://<HOST>:<PORT>";
const SHARE = "FOLDER_TO_SYNC";

// SCRIPTABLE SCRIPT

const fm = FileManager.local();

const CONFIG_PATH = fm.documentsDirectory() + "/sync-config.json";

async function main() {
  let root = loadRootFolder();

  // First run -> choose folder
  if (!root) {
    root = await chooseRootFolder();

    if (!root) {
      console.log("No folder selected");
      return;
    }
  }

  console.log(`Sync root: ${root}`);
  console.log("Fetching remote manifest...");

  const remote = await fetchRemoteManifest();

  console.log(`Remote files: ${Object.keys(remote).length}`);

  let downloaded = 0;
  let skipped = 0;

  for (const [rel, remoteHashRaw] of Object.entries(remote)) {
    // Ignore any leftover backups from previous script versions
    if (rel.startsWith(".backup/")) {
      continue;
    }

    const localPath = root + "/" + rel;

    // If file does not exist, download it.
    if (!fm.fileExists(localPath)) {
      console.log(`NEW: ${rel}`);
      await downloadFile(root, rel);
      downloaded++;
    } else {
      // File exists - skip it completely
      skipped++;
    }
  }

  console.log("");
  console.log("Sync complete");
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (Already Exists): ${skipped}`);
}

async function chooseRootFolder() {
  const dir = await DocumentPicker.openFolder();

  fm.writeString(CONFIG_PATH, JSON.stringify({ root: dir }));

  return dir;
}

function loadRootFolder() {
  if (!fm.fileExists(CONFIG_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fm.readString(CONFIG_PATH)).root;
  } catch {
    return null;
  }
}

async function fetchRemoteManifest() {
  const req = new Request(`${BASE}/list/${encodeURIComponent(SHARE)}`);

  return await req.loadJSON();
}

async function downloadFile(root, rel) {
  // Encode each path segment separately so literal "/" between folders
  // is preserved in the URL
  const encodedRel = encodePathSegments(rel);

  const url = `${BASE}/download/${encodeURIComponent(SHARE)}/${encodedRel}`;

  console.log(`Downloading ${rel}`);

  const req = new Request(url);
  const data = await req.load();
  const target = root + "/" + rel;

  ensureParentDir(target);

  fm.write(target, data);
}

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

if (args.shortcutParameter === "pick") {
  await chooseRootFolder();
  console.log("Folder updated");
} else {
  await main();
}
