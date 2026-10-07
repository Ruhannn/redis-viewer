import boxen from "boxen";
import { highlight } from "cli-highlight";
import { Effect } from "effect";
import readline from "node:readline";
import pc from "picocolors";

import type { RedisConnection } from "../redis-client";

import { formatUnknownCause, RedisError } from "../redis-client";
import { copyToClipboard } from "./copy-to-clipboard";
import { formatTtl } from "./format-ttl";
import { formatValue } from "./format-value";
import { getValue } from "./get-value";

let keypressInitialized = false;
function initKeypress() {
  if (!keypressInitialized && process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    keypressInitialized = true;
  }
}

type Keypress = {
  ctrl?: boolean;
  name?: string;
  sequence?: string;
};

export type ViewAction = "back" | "deleted" | "quit";

const getKeyType = Effect.fn("getKeyType")(function* (
  client: RedisConnection,
  selectedKey: string,
): Effect.fn.Return<string, RedisError> {
  return yield* Effect.tryPromise({
    try: () => client.type(selectedKey),
    catch: cause => new RedisError({ operation: "get key type", cause }),
  });
});

const getKeyTtl = Effect.fn("getKeyTtl")(function* (
  client: RedisConnection,
  selectedKey: string,
): Effect.fn.Return<number, RedisError> {
  return yield* Effect.tryPromise({
    try: () => client.ttl(selectedKey),
    catch: cause => new RedisError({ operation: "get key ttl", cause }),
  });
});

const deleteKey = Effect.fn("deleteKey")(function* (
  client: RedisConnection,
  selectedKey: string,
): Effect.fn.Return<void, RedisError> {
  yield* Effect.tryPromise({
    try: () => client.del(selectedKey),
    catch: cause => new RedisError({ operation: "delete key", cause }),
  });
});

const renderKey = Effect.fnUntraced(function* (selectedKey: string, formattedValue: string, ttlSeconds: number): Effect.fn.Return<void> {
  yield* Effect.sync(() => {
    console.clear();
    console.log(
      boxen(highlight(formattedValue, { language: "json", ignoreIllegals: true }), {
        borderColor: "cyan",
        padding: 1,
        title: selectedKey,
        borderStyle: "round",
      }),
    );
    const ttlLabel = formatTtl(ttlSeconds);
    if (ttlLabel)
      console.log(pc.yellow(ttlLabel));
    console.log(pc.dim("d: delete | c: copy | ←: back | ctrl+c: quit"));
  });
});

function readViewAction(
  client: RedisConnection,
  selectedKey: string,
  formattedValue: string,
): Effect.Effect<ViewAction, RedisError> {
  return Effect.callback<ViewAction, RedisError>((resume) => {
    let resolved = false;
    let confirmingDelete = false;
    let copying = false;
    let onKeypress: ((input: string | undefined, key: Keypress) => void) | undefined;

    const cleanup = () => {
      if (resolved)
        return;

      resolved = true;

      if (onKeypress)
        process.stdin.removeListener("keypress", onKeypress);

      if (process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        }
        catch {}
      }
      process.stdin.pause();
    };

    onKeypress = (_: string | undefined, key: Keypress) => {
      if (!key || resolved)
        return;

      if (key.ctrl && key.name === "c") {
        cleanup();
        resume(Effect.sync(() => console.clear()).pipe(Effect.as("quit" as const)));
        return;
      }

      if (confirmingDelete) {
        const pressed = key.sequence?.toLowerCase() ?? key.name;

        if (pressed !== "y") {
          if (pressed === "n" || key.name === "escape") {
            confirmingDelete = false;
            console.log(pc.dim("Delete cancelled"));
          }

          return;
        }

        confirmingDelete = false;
        cleanup();
        resume(deleteKey(client, selectedKey).pipe(
          Effect.tap(() => Effect.sync(() => {
            console.clear();
            console.log(pc.green(`Deleted ${selectedKey}`));
          })),
          Effect.as("deleted" as const),
        ));
        return;
      }

      if (key.name === "d") {
        confirmingDelete = true;
        console.log(pc.yellow(`Delete ${selectedKey}? Press y to confirm, n or Esc to cancel.`));
        return;
      }

      if (key.name === "c") {
        if (copying)
          return;

        copying = true;
        void Effect.runPromise(copyToClipboard(formattedValue)).then((copyResult) => {
          copying = false;

          if (!copyResult.ok) {
            console.log(pc.yellow(`Clipboard unavailable: ${copyResult.message}`));
            return;
          }

          console.log(pc.green(`Copied value to clipboard via ${copyResult.method}`));
        }).catch((error: unknown) => {
          copying = false;
          console.error(pc.red("Copy failed:"), formatUnknownCause(error));
        });
        return;
      }

      if (key.name === "left") {
        cleanup();
        resume(Effect.sync(() => console.clear()).pipe(Effect.as("back" as const)));
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);

    return Effect.sync(cleanup);
  });
}

export const viewKey = Effect.fn("viewKey")(function* (
  client: RedisConnection,
  selectedKey: string,
): Effect.fn.Return<ViewAction, RedisError> {
  const type = yield* getKeyType(client, selectedKey);
  const ttlSeconds = yield* getKeyTtl(client, selectedKey);
  const value = yield* getValue(client, selectedKey, type);
  const formattedValue = yield* formatValue(value);

  yield* renderKey(selectedKey, formattedValue, ttlSeconds);
  yield* Effect.sync(initKeypress);

  return yield* readViewAction(client, selectedKey, formattedValue);
});
