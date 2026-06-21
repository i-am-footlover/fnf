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

Use `fnf.js` inside Scriptable to sync files.

Edit these values:

```js
const BASE = "http://<HOST>:<PORT>";
const SHARE = "FOLDER_TO_SYNC";
```

Replace:

* `<HOST>` with your server IP
* `<PORT>` with the port used by `fnf`
* `FOLDER_TO_SYNC` with one of the directories passed to `--dirs`
