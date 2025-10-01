/* eslint-disable style/no-tabs */
import meow from "meow";
import pc from "picocolors";
import { createClient } from "redis";

import { cleanup } from "./utils/clean-up";
import { gracefulExit } from "./utils/graceful-exit";
import { isRedisUrl } from "./utils/is-redis-url";
import { promptForKey } from "./utils/prompt-for-key";
import { viewKey } from "./utils/view-key";

const cli = meow(
  `
	Usage
	   kami-redis <url>
`,
  {
    importMeta: import.meta,
  },
);

const [url] = cli.input;

if (!url) {
  console.log(cli.help);
  process.exit(1);
}

if (!isRedisUrl(url)) {
  console.log(cli.help);
  console.log(pc.red("Provided URL is not a valid Redis URL"));
  process.exit(1);
}

export const client = createClient({ url });

async function main() {
  try {
    cleanup();
    await client.connect();

    while (true) {
      const selectedKey = await promptForKey();
      if (!selectedKey) {
        console.log("No keys in Redis!");
        await client.quit();
        process.exit(0);
      }

      const action = await viewKey(selectedKey);

      if (action === "quit") {
        await gracefulExit(0);
      }
      else if (action === "deleted") {
        continue;
      }
      else if (action === "back") {
        continue;
      }
    }
  }
  catch (err) {
    console.error(pc.red("Unexpected error:"), err);
    try {
      await client.quit();
    }
    catch {
      process.exit(1);
    }
  }
}

main();
