import { describe, expect, it } from "vitest";
import { CONTROL_ROOM_MENU, validateMenuCatalog, visibleMenuEntries } from "./MenuCatalog";

describe("MenuCatalog", () => {
  it("ships a valid control room catalog within action-form limits", () => {
    expect(validateMenuCatalog(CONTROL_ROOM_MENU)).toEqual([]);
  });

  it("hides operator-only routes for regular players", () => {
    expect(visibleMenuEntries(CONTROL_ROOM_MENU, false).some((entry) => entry.action === "world_settings")).toBe(false);
    expect(visibleMenuEntries(CONTROL_ROOM_MENU, true).some((entry) => entry.action === "world_settings")).toBe(true);
  });

  it("reports duplicate and malformed entries", () => {
    expect(validateMenuCatalog([
      { id: "same", label: "A", description: "A", action: "about" },
      { id: "same", label: "", description: "", action: "about" },
    ])).toEqual([
      "entries[1].id is duplicated: same",
      "entries[1].label is empty",
      "entries[1].description is empty",
    ]);
  });
});