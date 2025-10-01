import type { Buffer } from "node:buffer";

import boxen from "boxen";
import highlight from "cli-highlight";
import clipboardy from "clipboardy";
import readline from "node:readline";
import pc from "picocolors";

import { client } from "..";
import { cleanup } from "./clean-up";
import { formatValue } from "./format-value";
import { getValue } from "./get-value";

export async function viewKey(selectedKey: string): Promise<"back" | "deleted" | "quit"> {
  const type = await client.type(selectedKey);

  const value = await getValue(selectedKey, type);

  cleanup();

  console.log(
    boxen(highlight(formatValue(value), { language: "json", ignoreIllegals: true }), {
      borderColor: "cyan",
      padding: 1,
      title: selectedKey,
      borderStyle: "round",
    }),
  );
  console.log(pc.blue("Press 'd' to delete, 'c' to copy, ← to go back, Ctrl+C to quit."));

  readline.emitKeypressEvents(process.stdin);

  try {
    process.stdin.resume();
  }

  catch {}
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  return await new Promise((resolve) => {
    const onKeypress = async (str: string, key: readline.Key) => {
      if (!key) {
        return;
      }

      if (key.name === "d" && !key.ctrl && !key.meta) {
        try {
          await client.del(selectedKey);
        }
        catch {
          console.error(pc.red("Delete failed:"));
        }
        cleanup();
        resolve("deleted");
        return;
      }

      if (key.name === "c" && !key.ctrl && !key.meta) {
        try {
          clipboardy.writeSync(formatValue(value));
          cleanup();
          resolve("back");
        }
        catch (e) {
          console.error(pc.red("Copy failed:"), e);
        }
        return;
      }

      if (key.name === "left") {
        cleanup();
        resolve("back");
        return;
      }

      if ((key.ctrl && key.name === "c") || key.sequence === "\u0003") {
        cleanup();
        resolve("quit");
      }
    };

    const onData = async (chunk: Buffer | string) => {
      const s = chunk.toString();
      if (s.includes("\u0003")) {
        cleanup();
        resolve("quit");
      }
    };

    process.stdin.on("keypress", onKeypress);
    process.stdin.on("data", onData);
  });
}
