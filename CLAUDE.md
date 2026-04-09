# Matter CLI

CLI and TUI for the Matter reading app (https://getmatter.com).

## Quick Reference

```sh
bun install          # Install dependencies
bun run dev          # Run CLI in dev mode (bun run src/cli.tsx)
bun run typecheck    # Type-check with tsc --noEmit
bun run build        # Cross-compile binaries for all platforms
```

## Architecture

- **Entry point:** `src/cli.tsx` — detects CLI vs TUI mode via argv and TTY
- **API client:** `src/api.ts` — typed fetch-based client, all Matter API endpoints
- **Auth:** `src/auth.ts` — token validation and storage
- **Config:** `src/config.ts` — `~/.config/matter/config.json` management
- **Commands:** `src/commands/*.ts` — one file per resource (items, annotations, tags, account, login, tui, update)
- **TUI:** `src/tui/*.tsx` — OpenTUI React components (command palette, item browser, item detail, settings)
- **Self-update:** `src/update.ts` — background download to staging on each run, apply on next startup; `matter update` for immediate manual update

## Key Conventions

- All CLI commands output JSON by default, `--plain` for human-readable text
- Errors go to stderr, data to stdout
- Exit code 0 = success, 1 = error
- Write operations check `requireWritable()` (readonly mode guard)
- Auth is validated on save via `GET /me`
- API tokens are prefixed `mat_`
- IDs are prefixed strings: `itm_`, `ann_`, `tag_`, `act_`, `aut_`
- Annotations are scoped to items: `GET /v1/items/{item_id}/annotations`
- Tag-item ops are item-scoped: `POST /v1/items/{item_id}/tags`, `DELETE /v1/items/{item_id}/tags/{tag_id}`
- Error format: `{ error: { code, message, field? } }`

## Dependencies

Runtime: `commander`, `@opentui/core`, `@opentui/react`, `react`, `open`. Nothing else.

## Agent-Friendly Docs

`matter docs` outputs a preamble with critical agent guidance (sort order gotcha, intent-to-command
mappings) followed by an index of all docs pages with `.md` URLs from the docs site. Agents can
fetch individual pages for deeper detail. `matter docs --offline` outputs just the preamble.

## API

Base URL: `https://api.getmatter.com/public/v1/`
Auth: Bearer token in `Authorization` header.
Full docs: https://docs.getmatter.com/api
LLM-optimized docs: https://docs.getmatter.com/llms-full.txt

## TUI

Uses `@opentui/react` (React reconciler over native Zig rendering core). Components are lowercase JSX: `<box>`, `<text>`, `<input>`, `<select>`, `<scrollbox>`. Hooks: `useKeyboard`, `useRenderer`, `useTerminalDimensions`. App init: `createCliRenderer()` + `createRoot(renderer).render(<App />)`.

TSX files must use `jsxImportSource: "@opentui/react"` (set in tsconfig.json).

If OpenTUI has blocking issues, the fallback is `ink` + `@inkjs/ui` — same JSX model, just different imports.
