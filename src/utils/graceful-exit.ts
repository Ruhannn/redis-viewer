import { client } from "..";

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
    console.clear();
    process.exit(code);
  }
}
