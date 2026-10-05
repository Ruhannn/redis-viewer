// cspell:words xclip xsel
import { Effect } from "effect";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";

import { isLinux, isMacOS, isWindows, isWSL } from "./os";

export type CopyResult = | { method: string; ok: true } | { message: string; ok: false };

type ClipboardCommand = {
  args: string[];
  command: string;
  method: string;
};

const COPY_TIMEOUT_MS = 800;

function clipboardCommands(): ClipboardCommand[] {
  if (isWindows) {
    return [
      {
        command: "powershell.exe",
        args: ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
        method: "Windows PowerShell Set-Clipboard",
      },
      {
        command: "pwsh.exe",
        args: ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
        method: "PowerShell Set-Clipboard",
      },
      { command: "clip.exe", args: [], method: "Windows clip.exe" },
    ];
  }

  if (isMacOS)
    return [{ command: "pbcopy", args: [], method: "macOS pbcopy" }];

  if (isLinux) {
    const commands: ClipboardCommand[] = [];

    if (isWSL)
      commands.push({ command: "clip.exe", args: [], method: "WSL clip.exe" });

    if (process.env.WAYLAND_DISPLAY)
      commands.push({ command: "wl-copy", args: [], method: "Wayland wl-copy" });

    if (process.env.DISPLAY) {
      commands.push(
        { command: "xclip", args: ["-selection", "clipboard"], method: "X11 xclip" },
        { command: "xsel", args: ["--clipboard", "--input"], method: "X11 xsel" },
      );
    }

    commands.push(
      { command: "termux-clipboard-set", args: [], method: "Termux clipboard" },
    );

    return commands;
  }

  return [
    { command: "pbcopy", args: [], method: "pbcopy" },
    { command: "wl-copy", args: [], method: "wl-copy" },
    { command: "xclip", args: ["-selection", "clipboard"], method: "xclip" },
    { command: "xsel", args: ["--clipboard", "--input"], method: "xsel" },
  ];
}

function copyWithCommand(value: string, candidate: ClipboardCommand): Effect.Effect<CopyResult> {
  return Effect.callback<CopyResult>((resume) => {
    const child = spawn(candidate.command, candidate.args, {
      detached: !isWindows,
      stdio: ["pipe", "ignore", "ignore"],
      windowsHide: true,
    });

    let settled = false;

    let timeout: NodeJS.Timeout;
    const settle = (result: CopyResult) => {
      if (settled)
        return;

      settled = true;
      clearTimeout(timeout);
      resume(Effect.succeed(result));
    };

    timeout = setTimeout(() => {
      child.stdin.destroy();
      child.unref();
      settle({ ok: true, method: candidate.method });
    }, COPY_TIMEOUT_MS);

    child.once("error", (error) => {
      settle({ ok: false, message: error.message });
    });

    child.once("close", (code) => {
      if (code === 0) {
        settle({ ok: true, method: candidate.method });
        return;
      }

      settle({
        ok: false,
        message: `${candidate.command} exited with code ${code}`,
      });
    });

    child.stdin.end(value);

    return Effect.sync(() => {
      if (settled)
        return;

      settled = true;
      clearTimeout(timeout);
      child.stdin.destroy();
      child.kill();
    });
  });
}

const copyWithOsc52 = Effect.fnUntraced(function* (value: string): Effect.fn.Return<CopyResult> {
  return yield* Effect.sync<CopyResult>(() => {
    if (!process.stdout.isTTY)
      return { ok: false, message: "stdout is not a TTY" };

    const encoded = Buffer.from(value).toString("base64");
    process.stdout.write(`\u001B]52;c;${encoded}\u0007`);
    return { ok: true, method: "terminal OSC 52" };
  });
});

export const copyToClipboard = Effect.fn("copyToClipboard")(function* (value: string): Effect.fn.Return<CopyResult> {
  const errors: string[] = [];

  for (const candidate of clipboardCommands()) {
    const result = yield* copyWithCommand(value, candidate);

    if (result.ok)
      return result;

    errors.push(`${candidate.method}: ${result.message}`);
  }

  const osc52Result = yield* copyWithOsc52(value);

  if (osc52Result.ok)
    return osc52Result;

  errors.push(`OSC 52: ${osc52Result.message}`);

  return {
    ok: false,
    message: `No supported clipboard command worked (${errors.join("; ")})`,
  };
});
