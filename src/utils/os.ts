const platform = globalThis.process?.platform || "";

export const isWindows = /^win/i.test(platform);

export const isLinux = /^linux/i.test(platform);

export const isMacOS = /^darwin/i.test(platform);

export const isWSL = isLinux && (!!process.env.WSL_DISTRO_NAME || /microsoft/i.test(process.env.OS ?? ""));
