import meow from "meow";
import pc from "picocolors";
import { createClient } from "redis";

import { isRedisUrl } from "./utils/is-redis-url";
import { promptForKey } from "./utils/prompt-for-key";
import { viewKey } from "./utils/view-key";

const cli = meow(`Usage: kami-redis <url>`, { importMeta: import.meta });
const [url] = cli.input;

if (!url) {
  console.log(cli.help);
  process.exit(1);
}

if (!isRedisUrl(url)) {
  console.log(cli.help);
  console.log(pc.red("Invalid Redis URL"));
  process.exit(1);
}

export const client = createClient({ url });

async function main() {
  try {
    console.clear();
    await client.connect();

    while (true) {
      const selectedKey = await promptForKey();

      if (!selectedKey) {
        console.log("No keys in Redis");
        await client.quit();
        process.exit(0);
      }

      const action = await viewKey(selectedKey);

      if (action === "quit") {
        await client.quit();
        process.exit(0);
      }
    }
  }
  catch (err) {
    console.error(pc.red("Error:"), err);
    try {
      await client.quit();
    }
    catch {}
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  try {
    await client.quit();
  }
  catch {}
  process.exit(0);
});

main();
