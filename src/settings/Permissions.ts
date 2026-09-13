import { Player, PlayerPermissionLevel } from "@minecraft/server";

/** World-scope settings may only be changed by operators; player-scope settings are always self-service. */
export function isOperator(player: Player): boolean {
  try {
    return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
  } catch {
    return false;
  }
}

export function requireOperator(player: Player): boolean {
  if (isOperator(player)) return true;
  player.onScreenDisplay.setActionBar("§cDenied: this is a world setting and requires operator permission.");
  return false;
}
