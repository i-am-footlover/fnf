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

[fnf](./fnf.js)

---

### 2. Create a New Script

Open:

`scriptable:///add`

This opens the “New Script” screen in Scriptable.

---

### 3. Paste the Script

Paste the copied code into the editor.

Save the script as:

`fnf`

---

### 4. Run the Script

Run:

* Click on the script inside Scriptable

Or open:

`scriptable:///run/fnf`

---

### 5. First Run Setup

The script will prompt for:

* Destination folder
* Server host
* Server port
* Share name (shared folder name)

Files are synced into:

`<destination-folder>/<share-name>/`

---

## Reconfigure

To change:

* destination folder
* host
* port
* share

Open:

`scriptable:///run/fnf?config=1`

---

## Reset Saved Config

To remove the saved configuration:

`scriptable:///run/fnf?reset=1`

This clears:

* saved destination folder
* host
* port
* share

The next run will prompt setup again.

---

## Normal Usage

After setup, future syncs can be started with:

`scriptable:///run/fnf`
