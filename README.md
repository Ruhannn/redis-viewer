## kami-redis — Inspect Redis keys from your CLI

A tiny CLI to browse Redis keys safely, view nicely formatted values, copy them, or delete with confirmation — fast and simple.

### Demo

![Demo Gif](https://raw.githubusercontent.com/Ruhannn/redis-viewer/refs/heads/main/assets/demo.gif)

### Features

- **Pretty output** with JSON detection and syntax highlighting
- **Safe key browsing** with incremental `SCAN`, `--pattern` filtering, and a selector limit
- **Quick actions**: `c` copy with feedback, `d` delete with confirmation, `←` back, `Ctrl+C` quit
- **Supports** `string`, `hash`, `list`, `set`, `zset`
- **Clipboard support** for macOS (`pbcopy`), Windows/PowerShell (`Set-Clipboard`/`clip.exe`), WSL (`clip.exe`), Linux Wayland (`wl-copy`), Linux X11 (`xclip`/`xsel`), Termux, and OSC 52 terminal fallback

### Install

```bash
# global
npm install -g kami-redis
# or
bun install -g kami-redis
```

### Quick start

```bash
kami-redis redis://localhost:6379
# TLS
kami-redis rediss://user:pass@host:6380/0
```

### Seed local test data

```bash
bun run seed
# or target another Redis URL
bun run seed redis://localhost:6379
```

The seed script writes deterministic `kami:test:*` keys covering core Redis types: `string`, `hash`, `list`, `set`, `zset`, and `stream`.

### Usage

```text
Usage
   kami-redis <url> [--pattern <glob>] [--limit <number>]

Options
   --pattern, -p  Redis key pattern to browse (default: *)
   --limit, -l    Maximum keys to load into the selector (default: 500)
```

Examples:

```bash
kami-redis redis://localhost:6379 --pattern "user:*"
kami-redis redis://localhost:6379 --limit 1000
```

### Shortcuts

- `Enter` or `→`: Open the selected key
- `c`: Copy current value and show copy status
- `d`: Ask for `y` confirmation, then delete current key
- `←`: Back to keys list
- `Ctrl+C`: Quit

### Supported types

- `string`, `hash`, `list`, `set`, `zset`, `stream`
- Redis Stack module keys for JSON (`ReJSON-RL` / `json`), TimeSeries (`TSDB-TYPE`), and vector sets (`vectorset`) when available

Values stay clean; large collections show a capped preview, and expiring keys show a minimal timer like `15 min`, `30 sec`, or `2 hr`.

### Errors

Connection and Redis command failures are handled through Effect and printed as concise messages, for example:

```text
Redis connection failed while trying to connect: connect ECONNREFUSED 127.0.0.1:6379
```

The CLI exits with code `1` for validation, connection, scan, read, delete, and seed failures.

## Feedback

If you have any feedback, feel free to reach out to [KamiRu](https://discord.com/users/819191621676695563) on Discord.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Authors

- [Ruhan](https://github.com/Ruhannn)
