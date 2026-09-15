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

export function terrainCacheKey(dimensionId: string, x: number, z: number, cellSize: number): string {
  const centerX = Math.floor(x / cellSize) * cellSize;
  const centerZ = Math.floor(z / cellSize) * cellSize;
  return `${dimensionId}:${centerX}:${centerZ}:${cellSize}`;
}