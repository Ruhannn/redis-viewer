import { client } from "..";

export async function getValue(selectedKey: string, type: string): Promise<unknown> {
  switch (type) {
    case "string":
      return client.get(selectedKey);
    case "hash":
      return client.hGetAll(selectedKey);
    case "list":
      return client.lRange(selectedKey, 0, -1);
    case "set":
      return client.sMembers(selectedKey);
    case "zset":
      return client.zRangeWithScores(selectedKey, 0, -1);
    default:
      return "(unsupported type)";
  }
}
