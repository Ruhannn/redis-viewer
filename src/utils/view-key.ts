import boxen from "boxen";
import { highlight } from "cli-highlight";
import { exec } from "node:child_process";
import readline from "node:readline";
import pc from "picocolors";

import { client } from "..";
import { getCopyCmd } from "./copy-to-clipboard";
import { formatValue } from "./format-value";
import { getValue } from "./get-value";
import { isWindows } from "./os";

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
  const f_value = formatValue(value);
  console.clear();
  console.log(
    boxen(highlight(f_value, { language: "json", ignoreIllegals: true }), {
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
        const cmd = getCopyCmd(f_value);

        exec(cmd, isWindows ? { shell: "powershell.exe" } : {}, (error) => {
          if (error) {
            console.error(`Copy failed: ${error}`);
          }
        });

        cleanup();
        console.clear();
        resolve("back");
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
