import { Player, system } from "@minecraft/server";
import { log } from "../util/Logger";
import { FormResponse } from "./FormValidation";

export interface FormLike<Response extends FormResponse> {
  show(player: Player): Promise<Response>;
}

export interface FormRuntimeOptions {
  maxBusyRetries?: number;
  retryDelayTicks?: number;
  context: string;
}

const DEFAULT_MAX_BUSY_RETRIES = 3;
const DEFAULT_RETRY_DELAY_TICKS = 2;

function waitTicks(ticks: number): Promise<void> {
  return new Promise((resolve) => system.runTimeout(resolve, Math.max(1, ticks)));
}

function isBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("busy") || message.toLowerCase().includes("already showing");
}

export async function showFormWithRetry<Response extends FormResponse>(
  player: Player,
  createForm: () => FormLike<Response>,
  options: FormRuntimeOptions
): Promise<Response | undefined> {
  const maxBusyRetries = Math.max(0, Math.min(5, Math.floor(options.maxBusyRetries ?? DEFAULT_MAX_BUSY_RETRIES)));
  const retryDelayTicks = Math.max(1, Math.min(20, Math.floor(options.retryDelayTicks ?? DEFAULT_RETRY_DELAY_TICKS)));

  for (let attempt = 0; attempt <= maxBusyRetries; attempt++) {
    try {
      return await createForm().show(player);
    } catch (error) {
      if (!isBusyError(error) || attempt >= maxBusyRetries) {
        log(`${options.context} form failed: ${String(error)}`);
        return undefined;
      }
      await waitTicks(retryDelayTicks);
    }
  }

  return undefined;
}

