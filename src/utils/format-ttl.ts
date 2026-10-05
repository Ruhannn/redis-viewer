function formatDuration(ttlSeconds: number): string | null {
  if (ttlSeconds < 0)
    return null;

  if (ttlSeconds < 60)
    return `${ttlSeconds} sec`;

  const minutes = Math.floor(ttlSeconds / 60);

  if (minutes < 60)
    return `${minutes} min`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24)
    return `${hours} hr`;

  const days = Math.floor(hours / 24);

  return `${days} day`;
}

export function formatTtl(ttlSeconds: number): string | null {
  return formatDuration(ttlSeconds);
}
