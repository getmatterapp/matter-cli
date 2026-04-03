import { Command } from "commander";

const LLMS_TXT_URL = "https://matter-d988c870.mintlify.app/llms.txt";

const preamble = `# Matter CLI Documentation

Matter is a read-it-later app. The CLI manages your reading library from the terminal.
All commands output JSON by default. Add --plain for human-readable text.
IDs are prefixed strings: itm_ (items), ann_ (annotations), tag_ (tags), aut_ (authors).
API tokens start with mat_. Run 'matter login' to authenticate.

## Important: Sort Order

When a user is asking about their library, use library_position or inbox_position —
these match what they see in the app. The default sort (--order updated) is for
building incremental sync, NOT for answering user questions about their reading list.
It bumps on any field change (tags, annotations, re-extraction), not just reading.

Sort values for 'matter items list --order':
  library_position - App queue/archive order (manual drag-and-drop). Use this for most user queries.
  inbox_position   - Inbox feed order (pinned sources first, then by date). Use for inbox queries.
  updated          - Last-modified timestamp (any field change). Use for sync operations only.

## Common Intents

When a user asks...                         Use this command
"my reading list / queue"                   matter items list --status queue --order library_position
"what have I been reading"                  matter items list --status archive --order library_position --limit 10
"finished / archived articles"              matter items list --status archive --order library_position
"what's new in my inbox"                    matter items list --status inbox --order inbox_position
"all my saved articles"                     matter items list --status queue,archive --order library_position
"all favorites"                             matter items list --favorite --status queue,archive --order library_position
"podcasts in my queue"                      matter items list --status queue --content-type podcast --order library_position
"everything (inbox + library)"              matter items list --status inbox,queue,archive --order library_position
"find article about <topic>"                matter search "<topic>" --type items
"articles by <author>"                      matter search "by:<author>" --type items
"articles from <site>"                      matter search "site:<domain>" --type items
"highlights from an article"                matter annotations list --item <item_id> --all
"all my tags"                               matter tags list

## Full API & CLI Reference
`;

async function fetchLlmsTxt(): Promise<string> {
  const res = await fetch(LLMS_TXT_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch docs from ${LLMS_TXT_URL}: HTTP ${res.status}`);
  }
  return res.text();
}

export const docsCommand = new Command("docs")
  .description("Full reference docs for the Matter CLI and API")
  .option("--offline", "Show built-in reference only (no network fetch)")
  .action(async (opts) => {
    try {
      if (opts.offline) {
        console.log(preamble.trimEnd());
        return;
      }

      const llmsTxt = await fetchLlmsTxt();
      console.log(preamble + llmsTxt);
    } catch (err) {
      // Fall back to preamble-only on network failure
      console.log(preamble.trimEnd());
      console.error(`\n(Could not fetch full docs: ${(err as Error).message})`);
      process.exit(1);
    }
  });
