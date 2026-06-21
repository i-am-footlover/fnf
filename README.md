# fnf

Simple local file sync server for Scriptable.

## Install

```bash
cargo install --git https://github.com/i-am-footlover/fnf
```

## Usage

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

Run `fnf.js` in Scriptable.

The script will prompt for:

* Destination folder
* Server host
* Server port
* Share name (Name of folders exposed through server)

Files are synced into:

```txt id="a3rnup"
<destination-folder>/<share-name>/
```
