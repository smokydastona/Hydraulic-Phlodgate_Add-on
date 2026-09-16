import { describe, expect, it } from "vitest";
import {
  containerKey,
  copyForPlayer,
  decideOpenAction,
  LootrRecord,
  LootrState,
  MAX_SERIALIZED_LENGTH,
  parseLootrState,
  rollTrinketDrop,
  sanitizeDescriptor,
  serializeLootrState,
  withTrinketInserted,
} from "./LootrPlan";

const TRINKETS = ["phlodgate:speed_ring", "phlodgate:water_necklace", "phlodgate:fire_charm"] as const;

function record(partial: Partial<LootrRecord> = {}): LootrRecord {
  return { snapshot: [], players: {}, touched: 0, ...partial };
}

describe("containerKey", () => {
  it("floors coordinates so any point in a block maps to one key", () => {
    expect(containerKey("minecraft:overworld", 10.9, 64.2, -3.7)).toBe("minecraft:overworld:10:64:-4");
    expect(containerKey("minecraft:overworld", 10, 64, -4)).toBe("minecraft:overworld:10:64:-4");
  });

  it("separates identical coordinates in different dimensions", () => {
    expect(containerKey("minecraft:nether", 0, 0, 0)).not.toBe(containerKey("minecraft:overworld", 0, 0, 0));
  });
});

describe("sanitizeDescriptor", () => {
  it("accepts a well-formed descriptor and clamps the amount", () => {
    expect(sanitizeDescriptor({ slot: 2, typeId: "minecraft:diamond", amount: 9999 })).toEqual({
      slot: 2,
      typeId: "minecraft:diamond",
      amount: 255,
    });
  });

  it("rejects malformed, negative, and empty entries", () => {
    expect(sanitizeDescriptor(undefined)).toBeUndefined();
    expect(sanitizeDescriptor({ slot: -1, typeId: "minecraft:dirt", amount: 1 })).toBeUndefined();
    expect(sanitizeDescriptor({ slot: 0, typeId: "", amount: 1 })).toBeUndefined();
    expect(sanitizeDescriptor({ slot: 0, typeId: "minecraft:dirt", amount: 0 })).toBeUndefined();
    expect(sanitizeDescriptor({ slot: 1.5, typeId: "minecraft:dirt", amount: 1 })).toBeUndefined();
  });

  it("keeps valid enchantments and drops invalid ones", () => {
    const descriptor = sanitizeDescriptor({
      slot: 0,
      typeId: "minecraft:diamond_sword",
      amount: 1,
      enchantments: [
        { id: "sharpness", level: 3 },
        { id: "", level: 2 },
        { id: "unbreaking", level: 0 },
      ],
    });
    expect(descriptor?.enchantments).toEqual([{ id: "sharpness", level: 3 }]);
  });
});

describe("parseLootrState", () => {
  it("returns an empty store for missing or malformed JSON", () => {
    expect(parseLootrState(undefined)).toEqual({});
    expect(parseLootrState("")).toEqual({});
    expect(parseLootrState("{ not json")).toEqual({});
    expect(parseLootrState("[1,2,3]")).toEqual({});
  });

  it("round-trips a real store and discards corrupt item entries", () => {
    const state: LootrState = {
      "minecraft:overworld:1:2:3": record({
        snapshot: [{ slot: 0, typeId: "minecraft:gold_ingot", amount: 4 }],
        players: { "player-a": [{ slot: 1, typeId: "minecraft:emerald", amount: 2 }] },
        lastOpener: "player-a",
        touched: 7,
      }),
    };

    const parsed = parseLootrState(serializeLootrState(state));
    expect(parsed["minecraft:overworld:1:2:3"].snapshot).toHaveLength(1);
    expect(parsed["minecraft:overworld:1:2:3"].players["player-a"]).toHaveLength(1);
    expect(parsed["minecraft:overworld:1:2:3"].lastOpener).toBe("player-a");

    const corrupt = parseLootrState(
      JSON.stringify({ "k": { snapshot: [{ slot: 0, typeId: "", amount: 1 }], players: "nope", touched: "x" } })
    );
    expect(corrupt["k"].snapshot).toEqual([]);
    expect(corrupt["k"].players).toEqual({});
    expect(corrupt["k"].touched).toBe(0);
  });
});

describe("serializeLootrState", () => {
  it("evicts least recently touched containers to stay inside the property budget", () => {
    const state: LootrState = {};
    for (let index = 0; index < 400; index++) {
      state[`minecraft:overworld:${index}:64:0`] = record({
        touched: index,
        snapshot: Array.from({ length: 27 }, (_unused, slot) => ({
          slot,
          typeId: "minecraft:golden_apple",
          amount: 3,
        })),
      });
    }

    const serialized = serializeLootrState(state);
    expect(serialized.length).toBeLessThanOrEqual(MAX_SERIALIZED_LENGTH);

    const parsed = parseLootrState(serialized);
    const keys = Object.keys(parsed);
    expect(keys.length).toBeGreaterThan(0);
    // The most recently touched container must survive eviction.
    expect(parsed["minecraft:overworld:399:64:0"]).toBeDefined();
    expect(parsed["minecraft:overworld:0:64:0"]).toBeUndefined();
  });
});

describe("decideOpenAction", () => {
  it("snapshots generated loot the first time a container is opened", () => {
    expect(decideOpenAction(undefined, "player-a")).toEqual({ kind: "snapshot", loadFor: "player-a" });
  });

  it("does nothing when the same player re-opens their own copy", () => {
    expect(decideOpenAction(record({ lastOpener: "player-a" }), "player-a")).toEqual({ kind: "none" });
  });

  it("persists the previous player's copy before loading the new player's", () => {
    expect(decideOpenAction(record({ lastOpener: "player-a" }), "player-b")).toEqual({
      kind: "load",
      loadFor: "player-b",
      persistFor: "player-a",
    });
  });

  it("loads without persisting when no one held the container", () => {
    expect(decideOpenAction(record(), "player-b")).toEqual({ kind: "load", loadFor: "player-b", persistFor: undefined });
  });

  it("ignores an empty player id", () => {
    expect(decideOpenAction(undefined, "")).toEqual({ kind: "none" });
  });
});

describe("copyForPlayer", () => {
  it("gives a first-time looter a detached copy of the original loot", () => {
    const stored = record({ snapshot: [{ slot: 0, typeId: "minecraft:diamond", amount: 1 }] });
    const copy = copyForPlayer(stored, "player-a");

    expect(copy).toEqual(stored.snapshot);
    copy[0].amount = 64;
    expect(stored.snapshot[0].amount).toBe(1);
  });

  it("returns a player's own partially looted copy once they have one", () => {
    const stored = record({
      snapshot: [{ slot: 0, typeId: "minecraft:diamond", amount: 1 }],
      players: { "player-a": [] },
    });
    expect(copyForPlayer(stored, "player-a")).toEqual([]);
  });
});

describe("rollTrinketDrop", () => {
  it("drops a trinket only when the roll lands under the configured chance", () => {
    expect(rollTrinketDrop(0.05, 0, 12, TRINKETS)).toBe("phlodgate:speed_ring");
    expect(rollTrinketDrop(0.5, 0, 12, TRINKETS)).toBeUndefined();
  });

  it("never drops at zero chance and always drops at full chance", () => {
    expect(rollTrinketDrop(0, 0, 0, TRINKETS)).toBeUndefined();
    expect(rollTrinketDrop(0.99, 0, 100, TRINKETS)).toBe("phlodgate:speed_ring");
  });

  it("spreads picks across the whole catalog and stays in range at the boundary", () => {
    expect(rollTrinketDrop(0, 0.99, 100, TRINKETS)).toBe("phlodgate:fire_charm");
    expect(rollTrinketDrop(0, 1, 100, TRINKETS)).toBe("phlodgate:fire_charm");
    expect(rollTrinketDrop(0, 0.5, 100, TRINKETS)).toBe("phlodgate:water_necklace");
  });

  it("handles an empty catalog and non-finite input safely", () => {
    expect(rollTrinketDrop(0, 0, 100, [])).toBeUndefined();
    expect(rollTrinketDrop(Number.NaN, 0, 100, TRINKETS)).toBeUndefined();
  });
});

describe("withTrinketInserted", () => {
  it("uses the first free slot", () => {
    const items = [{ slot: 0, typeId: "minecraft:bread", amount: 2 }];
    expect(withTrinketInserted(items, "phlodgate:speed_ring", 27)).toContainEqual({
      slot: 1,
      typeId: "phlodgate:speed_ring",
      amount: 1,
    });
  });

  it("leaves a completely full container untouched", () => {
    const items = Array.from({ length: 27 }, (_unused, slot) => ({ slot, typeId: "minecraft:stone", amount: 1 }));
    expect(withTrinketInserted(items, "phlodgate:speed_ring", 27)).toHaveLength(27);
  });
});
