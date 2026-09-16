import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packNames = ["RP", "RP_Aggressive", "RP_Extreme"];

const species = {
  wolf: [64, 32, [39, 64, 72], [60, 224, 190], [224, 245, 238]],
  cat: [64, 32, [56, 45, 74], [238, 180, 62], [244, 232, 210]],
  fox: [48, 32, [43, 68, 62], [236, 112, 68], [239, 228, 199]],
  snow_fox: [48, 32, [56, 72, 85], [102, 211, 232], [238, 250, 252]],
  creaking: [64, 128, [47, 43, 32], [202, 139, 52], [255, 220, 100]],
  rabbit: [64, 32, [62, 52, 72], [218, 103, 153], [245, 226, 232]],
  spider: [64, 32, [34, 43, 47], [40, 205, 188], [225, 255, 243]],
  cave_spider: [64, 32, [31, 48, 62], [72, 177, 230], [200, 242, 255]],
  sniffer: [192, 128, [48, 70, 57], [223, 88, 71], [238, 207, 91]],
  ravager: [128, 128, [48, 52, 58], [72, 190, 173], [218, 231, 226]],
  copper_golem: [64, 64, [78, 47, 39], [226, 126, 68], [78, 218, 190]],
  zoglin: [128, 64, [66, 50, 57], [218, 83, 112], [246, 211, 195]],
  axolotl: [64, 64, [48, 58, 79], [72, 210, 221], [247, 170, 198]],
  baby_piglin: [128, 64, [68, 49, 46], [231, 166, 76], [243, 218, 187]],
  baby_armadillo: [64, 64, [73, 58, 48], [210, 142, 75], [245, 222, 170]],
  baby_axolotl: [64, 64, [42, 58, 76], [95, 220, 220], [248, 175, 205]],
  baby_bee: [64, 64, [45, 45, 39], [245, 194, 47], [250, 239, 186]],
  baby_camel: [128, 128, [74, 58, 44], [221, 159, 84], [244, 220, 176]],
  baby_cat: [64, 32, [55, 45, 68], [215, 122, 203], [243, 226, 246]],
  baby_cow: [64, 32, [48, 56, 55], [83, 199, 166], [235, 226, 206]],
  baby_donkey: [64, 64, [55, 50, 48], [173, 137, 96], [232, 215, 184]],
  baby_fox: [48, 32, [57, 52, 48], [226, 106, 65], [247, 220, 187]],
  baby_goat: [64, 64, [55, 61, 65], [118, 196, 206], [239, 239, 224]],
  baby_hoglin: [128, 64, [62, 45, 48], [198, 88, 87], [239, 187, 158]],
  baby_horse: [64, 64, [55, 48, 43], [191, 129, 72], [239, 216, 174]],
  baby_llama: [128, 64, [67, 55, 45], [205, 157, 91], [242, 220, 181]],
  baby_mooshroom: [64, 32, [65, 43, 46], [214, 71, 72], [248, 224, 205]],
  baby_mule: [64, 64, [54, 50, 48], [158, 128, 91], [228, 211, 177]],
  baby_ocelot: [64, 32, [62, 56, 40], [223, 174, 62], [248, 229, 175]],
  baby_pig: [64, 32, [73, 52, 63], [238, 132, 157], [251, 215, 220]],
  baby_polar_bear: [128, 64, [56, 68, 76], [112, 203, 224], [245, 250, 248]],
  baby_rabbit: [64, 32, [60, 51, 68], [203, 117, 187], [242, 224, 235]],
  baby_sheep: [64, 32, [54, 59, 70], [93, 185, 230], [244, 244, 239]],
  baby_chicken: [64, 32, [66, 61, 42], [238, 192, 62], [249, 245, 214]],
  baby_sniffer: [192, 128, [45, 65, 55], [213, 94, 73], [236, 203, 89]],
  baby_strider: [64, 64, [70, 42, 42], [221, 83, 65], [245, 185, 109]],
  baby_turtle: [128, 64, [38, 70, 63], [71, 202, 128], [213, 238, 184]],
  baby_panda: [64, 64, [31, 38, 43], [82, 209, 185], [235, 242, 237]],
  baby_wolf: [64, 32, [47, 59, 65], [76, 207, 184], [236, 243, 235]],
  tadpole: [32, 32, [39, 57, 68], [81, 192, 210], [222, 244, 238]],
};

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

function createTexture(width, height, base, accent, highlight, seed) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rows[offset++] = 0;
    for (let x = 0; x < width; x++) {
      const circuit = ((x + seed) % 16 === 0 || (y + seed * 3) % 16 === 0) && ((x + y) % 5 !== 0);
      const node = ((x + seed * 5) % 16 <= 1 && (y + seed * 7) % 16 <= 1);
      const shade = ((x >> 3) + (y >> 3) + seed) % 3 === 0 ? -10 : 6;
      const color = node ? highlight : circuit ? accent : base.map((channel) => Math.max(0, Math.min(255, channel + shade)));
      rows[offset++] = color[0];
      rows[offset++] = color[1];
      rows[offset++] = color[2];
      rows[offset++] = 255;
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

let seed = 1;
for (const [speciesId, [width, height, base, accent, highlight]] of Object.entries(species)) {
  const png = createTexture(width, height, base, accent, highlight, seed++);
  for (const packName of packNames) {
    const directory = path.join(root, packName, "textures", "entity", "phlodgate");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, `companion_${speciesId}.png`), png);
  }
}

console.log(`Generated ${Object.keys(species).length} unique companion textures in ${packNames.length} resource packs.`);