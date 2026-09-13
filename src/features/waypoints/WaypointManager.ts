import { Player } from "@minecraft/server";
import { log } from "../../util/Logger";
import { WaypointRecord } from "./WaypointMath";

const WAYPOINTS_KEY = "phlodgate:waypoints";
const ACTIVE_KEY = "phlodgate:active_waypoint";
const MAX_WAYPOINTS_PER_PLAYER = 50;

function readWaypoints(player: Player): WaypointRecord[] {
  const raw = player.getDynamicProperty(WAYPOINTS_KEY) as string | undefined;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WaypointRecord[]) : [];
  } catch (err) {
    log(`Failed to parse waypoints for ${player.name}, resetting: ${String(err)}`);
    return [];
  }
}

function writeWaypoints(player: Player, waypoints: WaypointRecord[]): void {
  player.setDynamicProperty(WAYPOINTS_KEY, JSON.stringify(waypoints));
}

export function listWaypoints(player: Player): WaypointRecord[] {
  return readWaypoints(player);
}

export function addWaypoint(player: Player, name: string): { ok: true; waypoint: WaypointRecord } | { ok: false; reason: string } {
  const waypoints = readWaypoints(player);
  if (waypoints.length >= MAX_WAYPOINTS_PER_PLAYER) {
    return { ok: false, reason: `Waypoint limit reached (${MAX_WAYPOINTS_PER_PLAYER}). Remove one first.` };
  }
  const trimmedName = name.trim().slice(0, 32);
  if (trimmedName.length === 0) {
    return { ok: false, reason: "Waypoint name cannot be empty." };
  }
  const loc = player.location;
  const waypoint: WaypointRecord = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name: trimmedName,
    dimensionId: player.dimension.id,
    x: Math.round(loc.x * 10) / 10,
    y: Math.round(loc.y * 10) / 10,
    z: Math.round(loc.z * 10) / 10,
  };
  writeWaypoints(player, [...waypoints, waypoint]);
  return { ok: true, waypoint };
}

export function renameWaypoint(player: Player, id: string, newName: string): boolean {
  const waypoints = readWaypoints(player);
  const target = waypoints.find((w) => w.id === id);
  if (!target) return false;
  target.name = newName.trim().slice(0, 32) || target.name;
  writeWaypoints(player, waypoints);
  return true;
}

export function removeWaypoint(player: Player, id: string): boolean {
  const waypoints = readWaypoints(player);
  const next = waypoints.filter((w) => w.id !== id);
  if (next.length === waypoints.length) return false;
  writeWaypoints(player, next);
  if (getActiveWaypointId(player) === id) setActiveWaypointId(player, undefined);
  return true;
}

export function getActiveWaypointId(player: Player): string | undefined {
  return player.getDynamicProperty(ACTIVE_KEY) as string | undefined;
}

export function setActiveWaypointId(player: Player, id: string | undefined): void {
  if (id === undefined) {
    player.setDynamicProperty(ACTIVE_KEY, undefined);
  } else {
    player.setDynamicProperty(ACTIVE_KEY, id);
  }
}

export function getActiveWaypoint(player: Player): WaypointRecord | undefined {
  const id = getActiveWaypointId(player);
  if (!id) return undefined;
  return readWaypoints(player).find((w) => w.id === id);
}
