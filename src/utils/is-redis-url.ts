export function isRedisUrl(url: string): boolean {
  let parsed;
  try {
    parsed = new URL(url);
  }
  catch {
    return false;
  }

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    return false;
  }

  if (!parsed.hostname) {
    return false;
  }

  if (parsed.port && Number.isNaN(Number(parsed.port))) {
    return false;
  }

  return true;
}
