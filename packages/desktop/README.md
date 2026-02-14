# @carta/desktop

Electron desktop application for Carta.

## Architecture

Minimal Electron shell that loads `@carta/web-client`:

- **Main process** (`src/main/`): Window lifecycle, dev/prod URL resolution
- **Preload script** (`src/preload/`): Context bridge for future IPC
- **Renderer**: Loads web-client from dev server (dev) or bundled files (prod)

## Development

### Prerequisites

1. Start web-client dev server:
   ```bash
   pnpm dev
   ```

2. In another terminal, start Electron:
   ```bash
   pnpm dev:desktop
   ```

The Electron window will load `http://localhost:5173` and open DevTools automatically.

### Production Build

Build for distribution:

```bash
pnpm build:desktop    # Build web-client + compile desktop + copy renderer
pnpm package:desktop  # Package into platform-specific installer
```

Build output:
- `dist/main/` - Compiled main process
- `dist/preload/` - Compiled preload script
- `dist/renderer/` - Bundled web-client files
- `release/` - Platform installers (dmg, exe, AppImage, etc.)

## Project Structure

```
packages/desktop/
├── src/
│   ├── main/
│   │   ├── index.ts     # Main process entry point
│   │   └── config.ts    # Dev/prod URL resolution
│   └── preload/
│       └── index.ts     # Context bridge API
├── scripts/
│   └── copy-renderer.mjs  # Copy web-client dist to renderer
├── electron-builder.yml   # Packaging configuration
├── package.json
└── tsconfig.json
```

## Not Yet Implemented

Future enhancements:
- MCP server integration (local AI access)
- Filesystem storage backend (instead of IndexedDB)
- Native file dialogs
- .carta file associations
- Native menus
- Auto-update
- Custom app icon
- Preferences stored on filesystem
