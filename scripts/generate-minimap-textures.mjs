/** Generates the editable minimap art set (frames, block tiles, cave tiles, entity icons, waypoint icons).
 *  Existing files are never overwritten, so hand-drawn replacements survive every rebuild. */
import { deflateSync } from "node:zlib";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packNames = ["RP", "RP_Aggressive", "RP_Extreme"];
const outputDirectory = ["textures", "ui", "phlodgate", "minimap"];

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, shader) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rows[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = shader(x, y, width, height);
      rows[offset++] = Math.max(0, Math.min(255, Math.round(r)));
      rows[offset++] = Math.max(0, Math.min(255, Math.round(g)));
      rows[offset++] = Math.max(0, Math.min(255, Math.round(b)));
      rows[offset++] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Nine-slice style panel: translucent fill, solid 2px border, brighter corner studs. */
function panelShader(fill, border, corner, round) {
  return (x, y, width, height) => {
    const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
    if (round) {
      const cx = (width - 1) / 2;
      const cy = (height - 1) / 2;
      const radius = Math.min(cx, cy);
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > radius) return [0, 0, 0, 0];
      if (distance > radius - 2) return [...border, 255];
    } else if (edge < 2) {
      const stud = (x < 6 || x > width - 7) && (y < 6 || y > height - 7);
      return [...(stud ? corner : border), 255];
    }
    const checker = ((x >> 2) + (y >> 2)) % 2 === 0 ? 8 : -8;
    return [fill[0] + checker, fill[1] + checker, fill[2] + checker, fill[3]];
  };
}

/** Solid map tile with a subtle two-tone dither so adjacent tiles stay readable at small scale. */
function tileShader(base, accent) {
  return (x, y) => {
    const dither = ((x >> 1) + (y >> 1)) % 2 === 0;
    const color = dither ? base : accent;
    const bevel = y < 1 ? 16 : y > 14 ? -16 : 0;
    return [color[0] + bevel, color[1] + bevel, color[2] + bevel, 255];
  };
}

/** Centered icon shape on a transparent background. */
function iconShader(shape, body, outline) {
  return (x, y, width, height) => {
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const nx = (x - cx) / (width / 2);
    const ny = (y - cy) / (height / 2);

    let inside = false;
    let rim = false;
    if (shape === "circle") {
      const d = Math.hypot(nx, ny);
      inside = d <= 0.82;
      rim = d > 0.6 && d <= 0.82;
    } else if (shape === "diamond") {
      const d = Math.abs(nx) + Math.abs(ny);
      inside = d <= 0.9;
      rim = d > 0.66 && d <= 0.9;
    } else if (shape === "arrow") {
      inside = ny >= -0.85 && ny <= 0.85 && Math.abs(nx) <= (0.85 - ny) * 0.55;
      rim = inside && (Math.abs(nx) > (0.85 - ny) * 0.36 || ny > 0.6);
    } else if (shape === "pin") {
      const headDistance = Math.hypot(nx, ny + 0.28);
      inside = headDistance <= 0.62 || (Math.abs(nx) <= 0.14 && ny >= 0.1 && ny <= 0.92);
      rim = headDistance > 0.42 && headDistance <= 0.62;
    } else {
      inside = Math.abs(nx) <= 0.82 && Math.abs(ny) <= 0.82;
      rim = inside && (Math.abs(nx) > 0.62 || Math.abs(ny) > 0.62);
    }

    if (!inside) return [0, 0, 0, 0];
    return [...(rim ? outline : body), 255];
  };
}

const frames = {
  frame_square: [64, 64, panelShader([16, 20, 28, 190], [96, 214, 230], [236, 250, 255], false)],
  frame_circle: [64, 64, panelShader([16, 20, 28, 190], [96, 214, 230], [236, 250, 255], true)],
  frame_cave: [64, 64, panelShader([26, 18, 14, 205], [206, 138, 62], [250, 214, 148], false)],
};

const blockTiles = {
  block_water: [[38, 92, 186], [46, 108, 205]],
  block_lava: [[214, 88, 34], [238, 132, 44]],
  block_grass: [[74, 150, 68], [88, 170, 78]],
  block_sand: [[212, 194, 134], [226, 210, 156]],
  block_snow: [[228, 238, 244], [244, 250, 252]],
  block_ice: [[150, 204, 232], [176, 222, 242]],
  block_stone: [[124, 124, 130], [140, 140, 146]],
  block_ore: [[92, 96, 108], [188, 168, 96]],
  block_wood: [[124, 90, 52], [142, 106, 64]],
  block_leaves: [[56, 118, 58], [68, 138, 66]],
  block_path: [[150, 128, 96], [164, 142, 108]],
  block_unknown: [[58, 60, 68], [70, 72, 80]],
};

const caveTiles = {
  cave_floor: [[86, 74, 62], [102, 88, 72]],
  cave_wall: [[44, 38, 34], [56, 48, 42]],
  cave_air: [[22, 20, 24], [30, 28, 32]],
  cave_lava: [[198, 74, 28], [236, 118, 36]],
  cave_ore: [[74, 70, 78], [196, 176, 104]],
};

const icons = {
  entity_player: ["arrow", [96, 220, 240], [236, 252, 255]],
  entity_companion: ["circle", [118, 220, 150], [232, 255, 238]],
  entity_passive: ["circle", [214, 198, 120], [250, 242, 206]],
  entity_hostile: ["diamond", [214, 84, 84], [252, 206, 206]],
  entity_boss: ["diamond", [176, 74, 200], [244, 208, 252]],
  entity_villager: ["circle", [160, 132, 96], [238, 220, 190]],
  entity_item: ["square", [216, 176, 84], [250, 232, 186]],
  entity_machine: ["square", [92, 198, 214], [220, 248, 252]],
  waypoint_default: ["pin", [240, 200, 84], [255, 244, 200]],
  waypoint_active: ["pin", [118, 232, 128], [226, 255, 230]],
  waypoint_death: ["pin", [226, 96, 96], [255, 214, 214]],
  waypoint_home: ["pin", [128, 176, 244], [222, 236, 255]],
  waypoint_machine: ["pin", [96, 214, 230], [220, 250, 255]],
  waypoint_offscreen: ["arrow", [240, 216, 120], [255, 248, 214]],
  marker_north: ["diamond", [236, 240, 248], [150, 160, 180]],
  marker_center: ["circle", [255, 255, 255], [120, 200, 230]],
};

const textures = new Map();
for (const [name, [width, height, shader]] of Object.entries(frames)) {
  textures.set(name, encodePng(width, height, shader));
}
for (const [name, [base, accent]] of [...Object.entries(blockTiles), ...Object.entries(caveTiles)]) {
  textures.set(name, encodePng(16, 16, tileShader(base, accent)));
}
for (const [name, [shape, body, outline]] of Object.entries(icons)) {
  textures.set(name, encodePng(32, 32, iconShader(shape, body, outline)));
}

let written = 0;
for (const packName of packNames) {
  const directory = path.join(root, packName, ...outputDirectory);
  mkdirSync(directory, { recursive: true });
  for (const [name, png] of textures) {
    const texturePath = path.join(directory, `${name}.png`);
    if (existsSync(texturePath)) continue;
    writeFileSync(texturePath, png);
    written++;
  }
}

console.log(
  `Minimap art set: ${textures.size} textures per pack across ${packNames.length} resource packs (${written} newly written, existing files preserved).`
);
