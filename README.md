# fnf

Simple local file sync for Scriptable.

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

Serve directories:

```bash
fnf --dirs ~/Documents ~/Downloads
```

Example with host and port:

```bash
fnf --dirs ~/Documents --host 0.0.0.0 --port 8698
```

## Scriptable

Install Scriptable from the App Store.

### 1. Copy the Script

Copy the contents of:

`fnf.js`

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

Tap **Add Bookmark** and select the folder where synced files should be stored.

---

### 5. Run the Script

Run:

- Tap the script inside Scriptable

Or open:

`scriptable:///run/fnf`

---

### 6. First Run Setup

The script will prompt for:

- Sync folder
- Server host
- Server port
- Folder name

For **Sync folder**, select one of your Scriptable folder bookmarks.

**Folder name** is the folder shared by the server, for example:

```text
Documents
Downloads
```

Files are synced into:

```text
<sync-folder>/<folder-name>/
```

Example:

```text
FNF Sync/
└── Documents/
    ├── notes.txt
    └── image.png
```

The configuration is saved and reused for future syncs.

---

## Reconfigure

To change:

- sync folder
- host
- port
- folder name

Open:

`scriptable:///run/fnf?config=1`

---

## Normal Usage

After setup, future syncs can be started with:

`scriptable:///run/fnf`
