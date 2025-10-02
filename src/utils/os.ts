const platform = globalThis.process?.platform || "";

export const isWindows = /^win/i.test(platform);

export const isLinux = /^linux/i.test(platform);

export const isMacOS = /^darwin/i.test(platform);

export const isWayland = !!process.env.WAYLAND_DISPLAY;
export const isX11 = !!process.env.DISPLAY && !isWayland;
export const isPowerShell = process.env.PSModulePath !== undefined;

export function escapeForPowerShell(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function escapeForCmd(value: string) {
  return value.replace(/"/g, "\"\"");
}

export function escapeForLinux(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
