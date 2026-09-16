import { describe, it, expect } from "vitest";
import {
  buildRadarStrip,
  CARDINAL_BEARINGS,
  cardinalEntriesForYaw,
  cellSizeForMinimapScale,
  DEFAULT_RADAR_WIDTH,
  nearestEntries,
  radarIndexForDelta,
  RADAR_CENTER_CHAR,
  RADAR_TRACK_CHAR,
  withinRadius,
} from "./MinimapMath";
import { angularDelta } from "../../util/Vector";

describe("radarIndexForDelta", () => {
  it("maps 0 delta to the center index", () => {
    expect(radarIndexForDelta(0, 21)).toBe(10);
  });
  it("maps -180 and 180 to the opposite edges", () => {
    expect(radarIndexForDelta(-180, 21)).toBe(0);
    expect(radarIndexForDelta(180, 21)).toBe(20);
  });
  it("clamps to track bounds for out-of-range deltas", () => {
    expect(radarIndexForDelta(540, 21)).toBeGreaterThanOrEqual(0);
    expect(radarIndexForDelta(540, 21)).toBeLessThanOrEqual(20);
  });
});

describe("cellSizeForMinimapScale", () => {
  it("maps supported zoom levels to bounded terrain cell sizes", () => {
    expect([1, 2, 4, 8].map(cellSizeForMinimapScale)).toEqual([16, 8, 4, 2]);
  });

  it("falls back to the default coverage for invalid values", () => {
    expect(cellSizeForMinimapScale(3)).toBe(16);
  });
});

describe("buildRadarStrip", () => {
  it("produces a track of the requested width filled with the track glyph by default", () => {
    const strip = buildRadarStrip([], [], 5);
    expect(strip.length).toBe(5);
    expect(strip.split("").every((c) => c === RADAR_TRACK_CHAR || c === RADAR_CENTER_CHAR)).toBe(true);
  });

  it("places the player-facing marker in the center when nothing else occupies it", () => {
    const strip = buildRadarStrip([], [], DEFAULT_RADAR_WIDTH);
    expect(strip[10]).toBe(RADAR_CENTER_CHAR);
  });

  it("places a waypoint glyph at the index matching its delta", () => {
    const strip = buildRadarStrip([{ glyph: "B", delta: 0, distance: 10 }], [], DEFAULT_RADAR_WIDTH);
    expect(strip[10]).toBe("B");
  });

  it("lets the nearest waypoint win when two share the same index", () => {
    const strip = buildRadarStrip(
      [
        { glyph: "F", delta: 5, distance: 500 },
        { glyph: "N", delta: 5, distance: 5 },
      ],
      [],
      DEFAULT_RADAR_WIDTH
    );
    const index = radarIndexForDelta(5, DEFAULT_RADAR_WIDTH);
    expect(strip[index]).toBe("N");
  });

  it("draws cardinal glyphs at their rotated positions", () => {
    const cardinals = cardinalEntriesForYaw(0, angularDelta);
    const strip = buildRadarStrip([], cardinals, DEFAULT_RADAR_WIDTH);
    // At yaw 0 the player faces south (bearing 0) -> south is directly ahead -> center index.
    expect(strip[10]).toBe("S");
  });
});

describe("cardinalEntriesForYaw", () => {
  it("returns all four cardinal directions", () => {
    const cardinals = cardinalEntriesForYaw(90, angularDelta);
    expect(cardinals.map((c) => c.glyph).sort()).toEqual(["E", "N", "S", "W"]);
  });

  it("matches the documented bearing convention", () => {
    expect(CARDINAL_BEARINGS.N).toBe(180);
    expect(CARDINAL_BEARINGS.S).toBe(0);
    expect(CARDINAL_BEARINGS.E).toBe(270);
    expect(CARDINAL_BEARINGS.W).toBe(90);
  });
});

describe("withinRadius", () => {
  it("includes points exactly at the radius", () => {
    expect(withinRadius(128, 128)).toBe(true);
  });
  it("excludes points beyond the radius", () => {
    expect(withinRadius(129, 128)).toBe(false);
  });
});

describe("nearestEntries", () => {
  const entries = [
    { name: "Far", delta: 0, distance: 500 },
    { name: "Near", delta: 0, distance: 10 },
    { name: "Mid", delta: 0, distance: 100 },
  ];

  it("sorts by ascending distance and limits results", () => {
    expect(nearestEntries(entries, 2).map((e) => e.name)).toEqual(["Near", "Mid"]);
  });

  it("returns an empty array for a non-positive limit", () => {
    expect(nearestEntries(entries, 0)).toEqual([]);
  });
});
