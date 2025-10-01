import inquirer from "inquirer";

import { client } from "..";
import { gracefulExit } from "./graceful-exit";

export async function promptForKey() {
  const keys = await client.keys("*");
  if (keys.length === 0)
    return null;

  try {
    const { selectedKey } = await inquirer.prompt({
      type: "list",
      name: "selectedKey",
      message: "Select a key to view its value:",
      choices: keys,
      pageSize: 20,
      theme: {
        icon: {
          cursor: ">",
        },
        prefix: "0_0",
      },
    });
    return selectedKey;
  }
  catch {
    await gracefulExit(0);
  }
}
