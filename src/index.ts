import { Effect, Schema } from "effect";
import meow from "meow";
import pc from "picocolors";

import type { RedisConnection, RedisError } from "./redis-client";
import type { PromptCancelled } from "./utils/prompt-for-key";

import { formatRedisError, formatUnknownCause, withRedisClient } from "./redis-client";
import { isRedisUrl } from "./utils/is-redis-url";
import { promptForKey } from "./utils/prompt-for-key";
import { viewKey } from "./utils/view-key";

type CliConfig = {
  keyLimit: number;
  pattern: string;
  url: string;
};

class CliValidationError extends Schema.TaggedError<CliValidationError>()("CliValidationError", {
  help: Schema.String,
  message: Schema.String,
}) {}

const parseCli = Effect.fn("parseCli")(function* (): Effect.fn.Return<CliConfig, CliValidationError> {
  const cli = yield* Effect.sync(() => meow(`
Usage
  $ kami-redis <url>

Options
  --pattern, -p  Redis key pattern to browse (default: *)
  --limit, -l    Maximum keys to load into the selector (default: 500)

Examples
  $ kami-redis redis://localhost:6379
  $ kami-redis redis://localhost:6379 --pattern "user:*"
`, {
    importMeta: import.meta,
    flags: {
      limit: {
        type: "number",
        shortFlag: "l",
        default: 500,
      },
      pattern: {
        type: "string",
        shortFlag: "p",
        default: "*",
      },
    },
  }));
  const [url] = cli.input;
  const pattern = cli.flags.pattern.trim() || "*";
  const keyLimit = cli.flags.limit;

  if (!url) {
    return yield* new CliValidationError({
      help: cli.help,
      message: "",
    });
  }

  if (!isRedisUrl(url)) {
    return yield* new CliValidationError({
      help: cli.help,
      message: "Invalid Redis URL",
    });
  }

  if (!Number.isInteger(keyLimit) || keyLimit < 1) {
    return yield* new CliValidationError({
      help: cli.help,
      message: "Key limit must be a positive integer",
    });
  }

  return { keyLimit, pattern, url };
});

const browseKeys = Effect.fn("browseKeys")(function* (
  client: RedisConnection,
  config: CliConfig,
): Effect.fn.Return<void, PromptCancelled | RedisError> {
  yield* Effect.sync(() => console.clear());

  let selectedKeyDefault: string | undefined;
  while (true) {
    const selectedKey = yield* promptForKey(client, {
      defaultKey: selectedKeyDefault,
      pattern: config.pattern,
      limit: config.keyLimit,
    });

    if (!selectedKey) {
      yield* Effect.sync(() => console.log(
        config.pattern === "*" ? "No keys in Redis" : `No keys match pattern ${config.pattern}`,
      ));
      return;
    }

    selectedKeyDefault = selectedKey;
    const action = yield* viewKey(client, selectedKey);

    if (action === "quit")
      return;
  }
});

const resetStdin = Effect.sync(() => {
  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    }
    catch {}
  }

  try {
    process.stdin.pause();
  }
  catch {}
});

const program = parseCli().pipe(
  Effect.flatMap(config => withRedisClient(
    config.url,
    client => browseKeys(client, config),
  )),
  Effect.catchTags({
    CliValidationError: error => Effect.sync(() => {
      console.log(error.help);
      if (error.message)
        console.log(pc.red(error.message));
      process.exitCode = 1;
    }),
    RedisError: error => resetStdin.pipe(
      Effect.tap(() => Effect.sync(() => {
        console.error(pc.red(formatRedisError(error)));
        process.exitCode = 1;
      })),
    ),
    PromptCancelled: () => resetStdin.pipe(
      Effect.tap(() => Effect.sync(() => console.clear())),
    ),
  }),
  Effect.catch(error => resetStdin.pipe(
    Effect.tap(() => Effect.sync(() => {
      console.error(pc.red("Unexpected error:"), formatUnknownCause(error));
      process.exitCode = 1;
    })),
  )),
);

const abortController = new AbortController();
let interrupted = false;

process.once("SIGINT", () => {
  interrupted = true;
  abortController.abort();
});

Effect.runPromise(program, { signal: abortController.signal }).catch((error: unknown) => {
  if (interrupted) {
    process.exitCode = 0;
    return;
  }

  console.error(pc.red("Unexpected error:"), formatUnknownCause(error));
  process.exitCode = 1;
});
