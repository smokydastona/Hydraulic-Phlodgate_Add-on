import { Player } from "@minecraft/server";

/** Food telemetry is intentionally not rendered; vanilla hunger remains the sole food HUD. */
 export function buildFoodLines(_player: Player): string[] | undefined {
   return undefined;
}
