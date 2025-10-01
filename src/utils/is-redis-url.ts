export function isRedisUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "redis:" || parsed.protocol === "rediss:")
      && !!parsed.hostname
      && (!parsed.port || !Number.isNaN(Number(parsed.port)))
    );
  }
  catch {
    return false;
  }
}
