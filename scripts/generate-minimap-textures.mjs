/** Generates the editable minimap frames. The icon set is vendored CC0 art (see vendor-minimap-icons.mjs).
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

const frames = {
  frame_square: [64, 64, panelShader([16, 20, 28, 190], [96, 214, 230], [236, 250, 255], false)],
  frame_circle: [64, 64, panelShader([16, 20, 28, 190], [96, 214, 230], [236, 250, 255], true)],
  frame_cave: [64, 64, panelShader([26, 18, 14, 205], [206, 138, 62], [250, 214, 148], false)],
};

const textures = new Map();
for (const [name, [width, height, shader]] of Object.entries(frames)) {
  textures.set(name, encodePng(width, height, shader));
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
  `Minimap frames: ${textures.size} textures per pack across ${packNames.length} resource packs (${written} newly written, existing files preserved).`
);
