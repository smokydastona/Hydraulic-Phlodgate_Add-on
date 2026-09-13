import { system } from "@minecraft/server";
import { log } from "./Logger";

/** Wraps system.runInterval with try/catch so one feature's runtime error never kills the whole tick loop for other subsystems. */
export function safeInterval(name: string, callback: () => void, tickInterval: number): number {
  return system.runInterval(() => {
    try {
      callback();
    } catch (err) {
      log(`Interval "${name}" threw and was skipped this cycle: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  }, tickInterval);
}

export function clearSafeInterval(id: number): void {
  system.clearRun(id);
}
