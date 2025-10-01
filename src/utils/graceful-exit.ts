import { client } from "..";
import { cleanup } from "./clean-up";

export async function gracefulExit(code = 0) {
  try {
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      }
      catch {}
    }
    try {
      process.stdin.pause();
    }
    catch {
      await client.quit();
    }
  }
  catch {}
  finally {
    cleanup();
    process.exit(code);
  }
}
