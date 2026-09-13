import { describe, expect, it } from "vitest";
import {
  evaluateCompanionStatus,
  findCompanionSignalObjective,
  extractModdedNamespaces,
  extractNamespace,
  isModdedNamespace,
} from "./CompanionDetector";

describe("CompanionDetector namespace utilities", () => {
  it("extracts namespace prefix correctly", () => {
    expect(extractNamespace("minecraft:dirt")).toBe("minecraft");
    expect(extractNamespace("hydraulic:machine")).toBe("hydraulic");
    expect(extractNamespace("create:crushing_wheel")).toBe("create");
    expect(extractNamespace("iron_pickaxe")).toBe("minecraft");
  });

  it("identifies modded vs built-in namespaces", () => {
    expect(isModdedNamespace("minecraft")).toBe(false);
    expect(isModdedNamespace("phlodgate")).toBe(false);
    expect(isModdedNamespace("hydraulic")).toBe(true);
    expect(isModdedNamespace("hydraulic_test_mod")).toBe(true);
    expect(isModdedNamespace("create")).toBe(true);
    expect(isModdedNamespace("techreborn")).toBe(true);
  });

  it("extracts unique modded namespaces from item/entity IDs", () => {
    const list = [
      "minecraft:diamond",
      "hydraulic:fluid_pipe",
      "hydraulic_test_mod:processing_machine",
      "hydraulic:fluid_pipe",
      "minecraft:stick",
      "create:cogwheel",
      "phlodgate:control_room_remote",
    ];
    expect(extractModdedNamespaces(list)).toEqual(["create", "hydraulic", "hydraulic_test_mod"]);
  });

  it("recognizes Hydraulic's canonical scoreboard handshake", () => {
    expect(findCompanionSignalObjective(["sidebar", "phlodgate_bridge"])).toBe("phlodgate_bridge");
    expect(findCompanionSignalObjective(["PHLODGATE_BRIDGE"])).toBe("PHLODGATE_BRIDGE");
    expect(findCompanionSignalObjective(["hydraulic_status"])).toBeUndefined();
  });
});

describe("CompanionDetector evaluateCompanionStatus", () => {
  it("defaults to standalone when in auto mode with no evidence", () => {
    const status = evaluateCompanionStatus("auto", {}, 100);
    expect(status.active).toBe(false);
    expect(status.detected).toBe(false);
    expect(status.mode).toBe("auto");
    expect(status.lastCheckedTick).toBe(100);
    expect(status.evidence[0]).toContain("No Hydraulic-Phlodgate server signal detected");
  });

  it("activates companion mode in auto mode when dynamic property exists", () => {
    const status = evaluateCompanionStatus(
      "auto",
      {
        hasWorldDynamicProperty: true,
        dynamicPropertyKey: "hydraulic:version",
        dynamicPropertyValue: "0.3.0",
      },
      120
    );
    expect(status.active).toBe(true);
    expect(status.detected).toBe(true);
    expect(status.evidence.some((e) => e.includes("hydraulic:version"))).toBe(true);
  });

  it("activates companion mode when modded items are present in auto mode", () => {
    const status = evaluateCompanionStatus(
      "auto",
      {
        moddedNamespacesInInventory: ["hydraulic", "ae2"],
      },
      150
    );
    expect(status.active).toBe(true);
    expect(status.detected).toBe(true);
    expect(status.detectedNamespaces).toEqual(["ae2", "hydraulic"]);
  });

  it("forces companion mode active when mode is 'enabled' even without signals", () => {
    const status = evaluateCompanionStatus("enabled", {}, 200);
    expect(status.active).toBe(true);
    expect(status.detected).toBe(false);
    expect(status.mode).toBe("enabled");
    expect(status.evidence.some((e) => e.includes("manually forced enabled"))).toBe(true);
  });

  it("forces standalone mode when mode is 'disabled' even if modded items exist", () => {
    const status = evaluateCompanionStatus(
      "disabled",
      {
        hasWorldDynamicProperty: true,
        moddedNamespacesInInventory: ["hydraulic"],
      },
      250
    );
    expect(status.active).toBe(false);
    expect(status.detected).toBe(true);
    expect(status.mode).toBe("disabled");
    expect(status.evidence.some((e) => e.includes("manually disabled"))).toBe(true);
  });
});
