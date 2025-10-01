import boxen from "boxen";
import { highlight } from "cli-highlight";
// import clipboard from "clipboardy";
import readline from "node:readline";
import pc from "picocolors";

import { client } from "..";
import { formatValue } from "./format-value";
import { getValue } from "./get-value";

let keypressInitialized = false;
function initKeypress() {
  if (!keypressInitialized && process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    keypressInitialized = true;
  }
}

export async function viewKey(selectedKey: string): Promise<string> {
  const type = await client.type(selectedKey);
  const value = await getValue(selectedKey, type);

  console.clear();
  console.log(
    boxen(highlight(formatValue(value), { language: "json", ignoreIllegals: true }), {
      borderColor: "cyan",
      padding: 1,
      title: selectedKey,
      borderStyle: "round",
    }),
  );
  console.log(pc.dim("d: delete | c: copy | ←: back | ctrl+c: quit"));

  initKeypress();

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (resolved)
        return;
      resolved = true;

      // eslint-disable-next-line ts/no-use-before-define
      process.stdin.removeListener("keypress", onKeypress);

      if (process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        }
        catch {}
      }
      process.stdin.pause();
    };

    const onKeypress = async (_: any, key: any) => {
      if (!key || resolved)
        return;

      if (key.ctrl && key.name === "c") {
        cleanup();
        console.clear();
        resolve("quit");
        return;
      }

      if (key.name === "d") {
        cleanup();
        try {
          await client.del(selectedKey);
        }
        catch {}
        console.clear();
        resolve("deleted");
        return;
      }

      if (key.name === "c") {
        try {
          // await clipboard.write("dfsdf");
          console.log("Copied to clipboard!");
        }
        catch (err) {
          console.log("Error copying:", err);
        }

        cleanup();
        console.clear();
        resolve("back");
        return;
      }

      if (key.name === "left") {
        cleanup();
        console.clear();
        resolve("back");
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);
  });
}
