# Matter CLI

A CLI and interactive TUI for the [Matter](https://getmatter.com) reading app. Designed for both AI agents (structured JSON) and humans (interactive terminal UI).

## Install

**macOS / Linux:**

```sh
curl -fsSL https://cli.getmatter.com/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://cli.getmatter.com/install.ps1 | iex
```

**From source:**

```sh
git clone https://github.com/getmatterapp/matter-cli.git
cd matter-cli
bun install
bun run src/cli.tsx --help
```

## Auth

```sh
# Opens browser to copy API token
matter login

# Or pass token directly (for automation)
matter login mat_yourtoken
echo "$MATTER_TOKEN" | matter login
```

## Usage

### CLI Mode

All commands output JSON by default. Use `--plain` for human-readable output.

```sh
# Account
matter account
matter account --plain

# Items
matter items list --status queue --plain
matter items list --content-type article --favorite --limit 10
matter items get itm_r9f3a
matter items save --url "https://example.com/article"
matter items update itm_r9f3a --status archive --favorite true
matter items delete itm_r9f3a

# Annotations
matter annotations list --item itm_r9f3a
matter annotations get ann_k3m9p
matter annotations update ann_k3m9p --note "Important point"
matter annotations delete ann_k3m9p

# Tags
matter tags list
matter tags rename tag_n5j2x --name "new name"
matter tags delete tag_n5j2x
matter tags add --item itm_r9f3a --name "my tag"
matter tags remove --item itm_r9f3a --tag tag_n5j2x

# Self-update (also happens automatically — see below)
matter update
matter version
```

### Interactive TUI

Launch by running `matter` with no arguments, or explicitly with `matter tui`:

```sh
matter
matter tui
```

Navigate with arrow keys, Enter to select, Escape/q to go back/quit, type to filter commands.

### Pagination

List commands support cursor-based pagination:

```sh
# First page
matter items list --limit 10

# Next page (use next_cursor from previous response)
matter items list --limit 10 --cursor <cursor>

# Fetch all pages at once
matter items list --all
```

### Auto-update

The CLI updates itself automatically. On each run, it checks for new releases in the background and downloads them to a staging area. The update is applied on the next invocation — zero wait time. You'll see a one-liner when it happens:

```
Updated matter to v0.2.0.
```

Run `matter update` to update immediately instead of waiting for the next run.

### Readonly Mode

Enable readonly mode to prevent write operations:

```sh
# Toggle in TUI settings, or edit ~/.config/matter/config.json
```

## Output Format

**JSON (default):**
```json
{
  "object": "list",
  "results": [...],
  "has_more": true,
  "next_cursor": "cur_abc123"
}
```

**Plain text (`--plain`):**
```
itm_r9f3a  How to Do Great Work          paulgraham.com  queue     35%
itm_k8w2p  The Art of Finishing           example.com     archive  100%
```

Errors go to stderr. Exit code 0 for success, 1 for errors.

## Config

Configuration is stored at `~/.config/matter/config.json`.

## Building

```sh
# Type-check
bun run typecheck

# Build all platform binaries
bun run build

# Build for a specific platform
bun run scripts/build.ts darwin-arm64
```

## Tech Stack

- **Bun** — runtime, bundler, compiler
- **TypeScript** — strict mode
- **Commander** — CLI routing
- **OpenTUI** — native Zig TUI rendering with React reconciler
- **React** — component model for TUI

## License

MIT
