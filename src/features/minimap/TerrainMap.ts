/** Atlas-inspired terrain sampling helpers that do not depend on the Bedrock runtime. */

export type TerrainGlyph = "~" | "^" | "#" | "." | "=" | "*" | "?";

export interface TerrainCell {
  glyph: TerrainGlyph;
  height: number;
  typeId: string;
}

export interface TerrainGrid {
  centerX: number;
  centerZ: number;
  cellSize: number;
  width: number;
  cells: TerrainCell[];
}

export interface CompanionVectorTarget {
  id: string;
  name: string;
  glyph: string;
  x: number;
  z: number;
  colorCode?: string;
  kind?: string;
  enabled?: boolean;
  priority?: number;
  range?: { min?: number; max?: number };
  label?: string;
  category?: string;
}

export function getCompanionTargetColor(kind?: string, fallback = "§f"): string {
  const normalized = (kind ?? "unknown").toLowerCase();
  if (normalized.includes("boss") || normalized.includes("raid") || normalized.includes("elite")) return "§c";
  if (normalized.includes("friend") || normalized.includes("ally") || normalized.includes("player")) return "§a";
  if (normalized.includes("death") || normalized.includes("grave") || normalized.includes("marker")) return "§6";
  if (normalized.includes("machine") || normalized.includes("factory") || normalized.includes("device")) return "§b";
  if (normalized.includes("mob") || normalized.includes("entity") || normalized.includes("creature")) return "§d";
  return fallback;
}

export function buildTerrainPreviewPattern(seed = 0, width = 5): string[] {
  const palette = ["§8█", "§7█", "§a█", "§9█", "§6█", "§b█"];
  const lines: string[] = [];

  for (let row = 0; row < width; row++) {
    let line = "";
    for (let column = 0; column < width; column++) {
      const baseIndex = ((row * 3 + column + seed) % palette.length);
      const isCenter = row === Math.floor(width / 2) && column === Math.floor(width / 2);
      line += isCenter ? "§fX" : palette[baseIndex];
    }
    lines.push(line);
  }

  return lines;
}

/** Classifies a top block into a compact, readable map glyph. */
export function terrainGlyphForTypeId(typeId: string): TerrainGlyph {
  const normalized = typeId.toLowerCase();
  if (normalized.includes("water") || normalized.includes("bubble_column")) return "~";
  if (normalized.includes("lava")) return "^";
  if (normalized.includes("grass") || normalized.includes("moss") || normalized.includes("leaves")) return ".";
  if (normalized.includes("sand") || normalized.includes("gravel")) return "=";
  if (normalized.includes("snow") || normalized.includes("ice")) return "*";
  if (normalized.includes("air") || normalized.includes("cave_air") || normalized.includes("void_air")) return "?";
  return "#";
}

/** Renders a richer pseudo-pixel glyph for HUD and Field Map presentation. */
export function pixelTerrainGlyphForTypeId(typeId: string): string {
  const normalized = typeId.toLowerCase();
  if (normalized.includes("water") || normalized.includes("bubble_column")) return "§9█";
  if (normalized.includes("lava")) return "§c█";
  if (normalized.includes("grass") || normalized.includes("moss") || normalized.includes("leaves")) return "§a█";
  if (normalized.includes("sand") || normalized.includes("gravel")) return "§6█";
  if (normalized.includes("snow") || normalized.includes("ice")) return "§f█";
  if (normalized.includes("stone") || normalized.includes("deepslate") || normalized.includes("andesite") || normalized.includes("diorite") || normalized.includes("granite")) return "§7█";
  if (normalized.includes("log") || normalized.includes("wood") || normalized.includes("planks")) return "§e█";
  if (normalized.includes("ore") || normalized.includes("coal") || normalized.includes("iron") || normalized.includes("gold") || normalized.includes("copper")) return "§8█";
  return "§8█";
}

export function formatTerrainGrid(grid: TerrainGrid): string[] {
  const lines: string[] = [];
  const half = Math.floor(grid.width / 2);
  for (let row = 0; row < grid.width; row++) {
    let line = "";
    for (let column = 0; column < grid.width; column++) {
      const cell = grid.cells[row * grid.width + column];
      line += row === half && column === half ? "X" : cell?.glyph ?? "?";
    }
    lines.push(line);
  }
  return lines;
}

export function formatTerrainGridPixels(grid: TerrainGrid): string[] {
  const lines: string[] = [];
  const half = Math.floor(grid.width / 2);
  for (let row = 0; row < grid.width; row++) {
    let line = "";
    for (let column = 0; column < grid.width; column++) {
      const cell = grid.cells[row * grid.width + column];
      const key = row === half && column === half ? "§fX" : pixelTerrainGlyphForTypeId(cell?.typeId ?? "minecraft:air");
      line += key;
    }
    lines.push(line);
  }
  return lines;
}

export function parseCompanionVectorPayload(raw: string | undefined): CompanionVectorTarget[] {
  if (!raw || raw.trim() === "") return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    const root = parsed as Record<string, unknown> | undefined;
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(root?.targets)
        ? root.targets
        : Array.isArray(root?.entries)
          ? root.entries
          : Array.isArray(root?.objects)
            ? root.objects
            : [];

    const parsedTargets: CompanionVectorTarget[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const target = item as Record<string, unknown>;
      const id = String(target.id ?? target.uuid ?? target.name ?? `companion:${parsedTargets.length}`);
      const name = String(target.name ?? target.label ?? target.title ?? id);
      const glyph = String(target.glyph ?? target.icon ?? target.symbol ?? target.marker ?? "◇");
      const positionObject = typeof target.position === "object" && target.position !== null ? (target.position as Record<string, unknown>) : undefined;
      const relativeObject = typeof target.relative === "object" && target.relative !== null ? (target.relative as Record<string, unknown>) : undefined;
      const x = Number(target.x ?? target.posX ?? target.offsetX ?? target.dx ?? positionObject?.x ?? relativeObject?.x ?? 0);
      const z = Number(target.z ?? target.posZ ?? target.offsetZ ?? target.dz ?? positionObject?.z ?? relativeObject?.z ?? 0);
      const enabledValue = target.enabled ?? target.visible ?? target.active ?? true;
      const enabled = enabledValue !== false;
      const kind = typeof target.kind === "string" ? target.kind : typeof target.type === "string" ? target.type : typeof target.category === "string" ? target.category : "unknown";
      const colorCode = typeof target.colorCode === "string" ? target.colorCode : getCompanionTargetColor(kind);
      const priority = Number(target.priority ?? target.score ?? target.weight ?? 0);
      const range = typeof target.range === "object" && target.range !== null ? (target.range as { min?: number; max?: number }) : undefined;
      const label = typeof target.label === "string" ? target.label : name;
      const category = typeof target.category === "string" ? target.category : kind;

      if (!Number.isFinite(x) || !Number.isFinite(z) || !enabled) continue;

      parsedTargets.push({
        id,
        name,
        glyph,
        x,
        z,
        colorCode,
        kind,
        enabled,
        priority: Number.isFinite(priority) ? priority : 0,
        range,
        label,
        category,
      });
    }

    return parsedTargets.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  } catch {
    return [];
  }
}

export function terrainCacheKey(dimensionId: string, x: number, z: number, cellSize: number): string {
  const centerX = Math.floor(x / cellSize) * cellSize;
  const centerZ = Math.floor(z / cellSize) * cellSize;
  return `${dimensionId}:${centerX}:${centerZ}:${cellSize}`;
}