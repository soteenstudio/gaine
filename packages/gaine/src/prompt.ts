import { createInterface, emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";

const c = (code: number) => (s: string) => (stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
export const color = {
  bold: c(1),
  dim: c(2),
  red: c(31),
  green: c(32),
  yellow: c(33),
  cyan: c(36),
};

export class Cancelled extends Error {}

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Choice menu with up/down arrows + Enter (also j/k, digits 1-9). Ctrl+C / Esc cancels. */
export function select<T extends string>(message: string, choices: readonly Choice<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let index = 0;
    let first = true;
    const lines = choices.length + 1;

    const render = () => {
      if (!first) stdout.write(`\x1b[${lines}A`);
      first = false;
      stdout.write(`\x1b[2K${color.cyan("◆")} ${color.bold(message)}\n`);
      choices.forEach((choice, i) => {
        const active = i === index;
        const mark = active ? color.cyan("●") : color.dim("○");
        const label = active ? choice.label : color.dim(choice.label);
        const hint = active && choice.hint ? color.dim(` (${choice.hint})`) : "";
        stdout.write(`\x1b[2K${color.dim("│")}  ${mark} ${label}${hint}\n`);
      });
    };

    const finish = (value: T) => {
      cleanup();
      stdout.write(`\x1b[${lines}A\x1b[J`);
      const picked = choices.find((x) => x.value === value)!;
      stdout.write(`${color.green("◇")} ${message} ${color.dim("·")} ${picked.label}\n`);
      resolve(value);
    };

    const onKey = (_: string, key: { name?: string; ctrl?: boolean }) => {
      if (!key) return;
      if ((key.ctrl && key.name === "c") || key.name === "escape") {
        cleanup();
        stdout.write("\n");
        reject(new Cancelled());
      } else if (key.name === "up" || key.name === "k") {
        index = (index - 1 + choices.length) % choices.length;
        render();
      } else if (key.name === "down" || key.name === "j") {
        index = (index + 1) % choices.length;
        render();
      } else if (key.name === "return") {
        finish(choices[index]!.value);
      } else if (key.name && /^[1-9]$/.test(key.name) && Number(key.name) <= choices.length) {
        finish(choices[Number(key.name) - 1]!.value);
      }
    };

    const cleanup = () => {
      stdin.off("keypress", onKey);
      stdin.setRawMode?.(false);
      stdin.pause();
      stdout.write("\x1b[?25h");
    };

    emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdout.write("\x1b[?25l");
    stdin.on("keypress", onKey);
    render();
  });
}

/** Single-line text input with a default value; repeats until `validate` passes. */
export async function text(
  message: string,
  initial: string,
  validate?: (v: string) => string | undefined,
): Promise<string> {
  for (;;) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await new Promise<string | null>((resolve) => {
      rl.once("close", () => resolve(null));
      rl.question(`${color.cyan("◆")} ${color.bold(message)} ${color.dim(`(${initial})`)}\n${color.dim("│")}  `, (a) => {
        resolve(a);
        rl.close();
      });
    });
    if (answer === null) throw new Cancelled();
    const value = answer.trim() || initial;
    const problem = validate?.(value);
    if (problem) {
      stdout.write(`${color.red("│  " + problem)}\n`);
      continue;
    }
    stdout.write(`\x1b[2A\x1b[J${color.green("◇")} ${message} ${color.dim("·")} ${value}\n`);
    return value;
  }
}
