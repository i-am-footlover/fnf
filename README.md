# fnf

Simple local files and folders sync.

## Server

### Install

```bash
cargo install --git https://github.com/i-am-footlover/fnf
```

### Usage

Show help:

```bash
fnf --help
```

Serve a directory:

```bash
fnf --dir ~/Documents
```

Example with host and port:

```bash
fnf --dir ~/Documents --host 0.0.0.0 --port 8698
```

When the server starts, it prints a QR code (and a scriptable:// link). Scan it from your iOS device to run the sync.

## Scriptable

Install Scriptable from the App Store.

### 1. Copy the Script

Copy the contents of:

[`fnf.js`](./fnf.js)

---

### 2. Create a New Script

Open:

`scriptable:///add`

This opens the New Script screen in Scriptable.

---

### 3. Paste the Script

Paste the copied code into the editor.

Save the script as:

`fnf`

---

### 4. Create a Folder Bookmark

In Scriptable, open:

**Settings → File Bookmarks**

Tap **Add Bookmark**, select the folder where synced files should be stored, and give it a name. You'll type this name into the script in Step 6.

---

### 5. Run the Script

Scan the QR code printed by the server (or open the link it prints). This launches:

`scriptable:///run/fnf?host=...&port=...&name=...`

`host`, `port`, and `name` (the shared directory's name).

---

### 6. First Run Setup

The script will prompt for:

- Root folder bookmark name

Enter the exact name you gave the bookmark in Step 4.

Files are synced into:

```text
<bookmarked-root>/<name>/
```

Example:

```text
FNF Sync/
└── Documents/
    ├── notes.txt
    └── image.png
```

The bookmark name is saved and reused for future syncs.

---

### Reconfigure Root

To change the root folder bookmark, open:

`scriptable:///run/fnf?resetRoot=1`

Or install [`fnf-reset-root.js`](./fnf-reset-root.js) using the same process as [`fnf.js`](./fnf.js) in [Steps 1–3](#1-copy-the-script).

Save the script as:

`fnf-reset-root`

Then just tap the `fnf-reset-root` script inside Scriptable to reconfigure.
