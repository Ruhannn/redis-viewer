import { Effect, Schema } from "effect";
import readline from "node:readline";
import pc from "picocolors";

import type { RedisConnection } from "../redis-client";

import { RedisError } from "../redis-client";
import { formatTtl } from "./format-ttl";

export type PromptForKeyOptions = {
  defaultKey?: string;
  limit?: number;
  pattern?: string;
};

export class PromptCancelled extends Schema.TaggedError<PromptCancelled>()("PromptCancelled", {}) {}

const DEFAULT_KEY_LIMIT = 500;
const PAGE_SIZE = 20;
const SCAN_COUNT = 100;

type Keypress = {
  ctrl?: boolean;
  name?: string;
};

type KeyRow = {
  key: string;
  ttlLabel: string | null;
};

type ScanResult = {
  hitLimit: boolean;
  keys: string[];
};

let keypressInitialized = false;
function initKeypress() {
  if (!keypressInitialized && process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    keypressInitialized = true;
  }
}

const scanKeys = Effect.fn("scanKeys")(function* (
  client: RedisConnection,
  pattern: string,
  limit: number,
): Effect.fn.Return<ScanResult, RedisError> {
  return yield* Effect.tryPromise({
    async try() {
      const keys: string[] = [];
      let hitLimit = false;

      for await (const batch of client.scanIterator({ MATCH: pattern, COUNT: SCAN_COUNT })) {
        for (const key of batch) {
          keys.push(key);

          if (keys.length >= limit) {
            hitLimit = true;
            break;
          }
        }

        if (hitLimit)
          break;
      }

      keys.sort((a, b) => a.localeCompare(b));
      return { hitLimit, keys };
    },
    catch: cause => new RedisError({ operation: "scan keys", cause }),
  });
});

const loadKeyRows = Effect.fn("loadKeyRows")(function* (
  client: RedisConnection,
  keys: string[],
): Effect.fn.Return<KeyRow[], RedisError> {
  return yield* Effect.tryPromise({
    async try() {
      return Promise.all(keys.map(async key => ({
        key,
        ttlLabel: formatTtl(await client.ttl(key)),
      })));
    },
    catch: cause => new RedisError({ operation: "load key expiry timers", cause }),
  });
});

function renderKeyList(rows: KeyRow[], active: number, message: string) {
  console.clear();
  console.log(`0_0 ${message}: ${pc.dim("(Use ↑/↓, Enter/→ to open)")}`);

  const pageStart = Math.max(0, Math.min(active - Math.floor(PAGE_SIZE / 2), rows.length - PAGE_SIZE));
  const pageEnd = Math.min(rows.length, pageStart + PAGE_SIZE);
  const keyColumnWidth = Math.max(...rows.slice(pageStart, pageEnd).map(row => row.key.length));

  for (let index = pageStart; index < pageEnd; index++) {
    const row = rows[index]!;
    const cursor = index === active ? pc.cyan(">") : " ";
    const paddedKey = row.key.padEnd(keyColumnWidth);
    const key = index === active ? pc.cyan(paddedKey) : paddedKey;
    const timer = row.ttlLabel ? pc.dim(`  ${row.ttlLabel}`) : "";

    console.log(`${cursor} ${key}${timer}`);
  }
}

function selectKey(rows: KeyRow[], message: string, defaultKey?: string): Promise<string> {
  const defaultIndex = defaultKey ? rows.findIndex(row => row.key === defaultKey) : -1;
  let active = defaultIndex >= 0 ? defaultIndex : 0;

  if (!process.stdin.isTTY)
    return Promise.resolve(rows[active]!.key);

  const { promise, reject, resolve } = Promise.withResolvers<string>();
  let resolved = false;
  let onKeypress: ((input: string | undefined, key: Keypress) => void) | undefined;

  initKeypress();

  const cleanup = () => {
    if (resolved)
      return;

    resolved = true;
    if (onKeypress)
      process.stdin.removeListener("keypress", onKeypress);

    try {
      process.stdin.setRawMode(false);
    }
    catch {}

    process.stdin.pause();
  };

  const done = () => {
    const selectedKey = rows[active]!.key;
    cleanup();
    console.clear();
    resolve(selectedKey);
  };

  const cancel = () => {
    cleanup();
    reject(new PromptCancelled());
  };

  onKeypress = (_input: string | undefined, key: Keypress) => {
    if (!key || resolved)
      return;

    if (key.ctrl && key.name === "c") {
      cancel();
      return;
    }

    if (key.name === "up") {
      active = (active - 1 + rows.length) % rows.length;
      renderKeyList(rows, active, message);
      return;
    }

    if (key.name === "down") {
      active = (active + 1) % rows.length;
      renderKeyList(rows, active, message);
      return;
    }

    if (key.name === "return" || key.name === "enter" || key.name === "right")
      done();
  };

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("keypress", onKeypress);
  renderKeyList(rows, active, message);

  return promise;
}

export const promptForKey = Effect.fn("promptForKey")(function* (
  client: RedisConnection,
  options: PromptForKeyOptions = {},
): Effect.fn.Return<string | null, PromptCancelled | RedisError> {
  const pattern = options.pattern?.trim() || "*";
  const limit = options.limit ?? DEFAULT_KEY_LIMIT;
  const { hitLimit, keys } = yield* scanKeys(client, pattern, limit);

  if (keys.length === 0)
    return null;

  const rows = yield* loadKeyRows(client, keys);
  const scope = pattern === "*" ? "keys" : `matching ${pattern}`;
  const count = `${keys.length}${hitLimit ? "+" : ""}`;
  const message = `Select a key (${count} ${scope})`;
  const defaultKey = options.defaultKey && keys.includes(options.defaultKey)
    ? options.defaultKey
    : undefined;

  return yield* Effect.tryPromise({
    try: () => selectKey(rows, message, defaultKey),
    catch: error => error instanceof PromptCancelled ? error : new PromptCancelled(),
  });
});
