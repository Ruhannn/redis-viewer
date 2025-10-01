import { client } from "..";

export async function getValue(key: string, type: string) {
  switch (type) {
    case "string":
      return client.get(key);
    case "hash":
      return client.hGetAll(key);
    case "list":
      return client.lRange(key, 0, -1);
    case "set":
      return client.sMembers(key);
    case "zset":
      return client.zRangeWithScores(key, 0, -1);
    default:
      return "(unsupported type)";
  }
}
