import { escapeForLinux, escapeForPowerShell, isLinux, isMacOS, isWayland, isWindows, isX11 } from "./os";

export function getCopyCmd(value: string): string {
  if (isWindows) {
    return `powershell -Command "Set-Clipboard -Value ${escapeForPowerShell(value)}"`;
  }
  if (isLinux) {
    if (isWayland) {
      return `echo ${escapeForLinux(value)} | wl-copy`;
    }
    if (isX11) {
      return `echo ${escapeForLinux(value)} | xclip -selection clipboard`;
    }
  }
  if (isMacOS) {
    return `echo ${escapeForLinux(value)} | pbcopy`;
  }
  return "";
}
