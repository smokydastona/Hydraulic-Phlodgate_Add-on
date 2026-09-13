import { describe, it, expect } from "vitest";
import { arrowForDelta, findWaypoint, formatDistance, isSameDimension } from "./WaypointMath";

describe("arrowForDelta", () => {
  it("points up for 0 delta", () => {
    expect(arrowForDelta(0)).toBe("\u2191");
  });
  it("points right for +90 delta", () => {
    expect(arrowForDelta(90)).toBe("\u2192");
  });
  it("points left for -90 delta", () => {
    expect(arrowForDelta(-90)).toBe("\u2190");
  });
  it("points down for 180 delta", () => {
    expect(arrowForDelta(180)).toBe("\u2193");
  });
});

describe("formatDistance", () => {
  it("shows whole blocks under 1000", () => {
    expect(formatDistance(42.6)).toBe("43 blocks");
  });
  it("shows k-notation at or above 1000", () => {
    expect(formatDistance(1500)).toBe("1.5k blocks");
  });
});

describe("isSameDimension / findWaypoint", () => {
  const waypoints = [
    { id: "1", name: "Base", dimensionId: "minecraft:overworld", x: 0, y: 64, z: 0 },
    { id: "2", name: "Portal", dimensionId: "minecraft:nether", x: 10, y: 60, z: 10 },
  ];

  it("matches dimension correctly", () => {
    expect(isSameDimension(waypoints[0], "minecraft:overworld")).toBe(true);
    expect(isSameDimension(waypoints[0], "minecraft:nether")).toBe(false);
  });

  it("finds a waypoint by id", () => {
    expect(findWaypoint(waypoints, "2")?.name).toBe("Portal");
    expect(findWaypoint(waypoints, "missing")).toBeUndefined();
  });
});
