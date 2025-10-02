## kami-redis — Inspect Redis keys from your CLI

A tiny CLI to browse keys, view nicely formatted values, copy them, or delete — fast and simple.

### Demo

![Demo Gif](https://raw.githubusercontent.com/Ruhannn/redis-viewer/refs/heads/main/assets/demo.gif)

### Features

- **Pretty output** with JSON detection and syntax highlighting
- **Quick actions**: `c` copy, `d` delete, `←` back, `Ctrl+C` quit
- **Supports** `string`, `hash`, `list`, `set`, `zset`

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

### Usage

```text
Usage
   kami-redis <url>
```

Examples:

### Shortcuts

- `c`: Copy current value
- `d`: Delete current key
- `←`: Back to keys list
- `Ctrl+C`: Quit

### Supported types

- `string`, `hash`, `list`, `set`, `zset`

Unsupported types show as `(unsupported type)`.

## Feedback

If you have any feedback, feel free to reach out to [KamiRu](https://discord.com/users/819191621676695563) on Discord.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Authors

- [Ruhan](https://github.com/Ruhannn)
