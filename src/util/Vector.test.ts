import { describe, it, expect } from "vitest";
import { angularDelta, bearingDegrees, clamp, distance3D, distanceXZ, lerp } from "./Vector";

describe("distance3D", () => {
  it("computes euclidean distance", () => {
    expect(distance3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5);
  });
});

describe("distanceXZ", () => {
  it("ignores the y axis", () => {
    expect(distanceXZ({ x: 0, y: 100, z: 0 }, { x: 3, y: -50, z: 4 })).toBeCloseTo(5);
  });
});

describe("bearingDegrees", () => {
  it("returns 0 when target is directly south (+Z)", () => {
    expect(bearingDegrees({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 })).toBeCloseTo(0);
  });
  it("returns 90 when target is directly west (-X)", () => {
    expect(bearingDegrees({ x: 0, y: 0, z: 0 }, { x: -10, y: 0, z: 0 })).toBeCloseTo(90);
  });
  it("returns 180 when target is directly north (-Z)", () => {
    expect(bearingDegrees({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -10 })).toBeCloseTo(180);
  });
  it("returns 270 when target is directly east (+X)", () => {
    expect(bearingDegrees({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 })).toBeCloseTo(270);
  });
  it("stays in [0, 360)", () => {
    const b = bearingDegrees({ x: 5, y: 0, z: 5 }, { x: 1, y: 0, z: 1 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("angularDelta", () => {
  it("returns 0 when already facing the target", () => {
    expect(angularDelta(90, 90)).toBeCloseTo(0);
  });
  it("wraps correctly across the 0/360 boundary", () => {
    expect(angularDelta(350, 10)).toBeCloseTo(20);
    expect(angularDelta(10, 350)).toBeCloseTo(-20);
  });
  it("returns 180 for the opposite direction", () => {
    expect(Math.abs(angularDelta(0, 180))).toBeCloseTo(180);
  });
});

describe("clamp", () => {
  it("clamps to range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("interpolates and clamps t", () => {
    expect(lerp(0, 10, 0.5)).toBeCloseTo(5);
    expect(lerp(0, 10, -1)).toBeCloseTo(0);
    expect(lerp(0, 10, 2)).toBeCloseTo(10);
  });
});
