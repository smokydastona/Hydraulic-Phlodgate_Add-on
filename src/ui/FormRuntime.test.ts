import { describe, expect, it } from "vitest";
import { readModalValues, readSelection } from "./FormValidation";

describe("FormRuntime response validation", () => {
  it("rejects canceled or short modal responses", () => {
    expect(readModalValues({ canceled: true, formValues: [true] }, 1)).toBeUndefined();
    expect(readModalValues({ canceled: false, formValues: [] }, 1)).toBeUndefined();
    expect(readModalValues({ canceled: false, formValues: ["ok"] }, 1)).toEqual(["ok"]);
  });

  it("accepts only non-negative integer selections", () => {
    expect(readSelection({ canceled: false, selection: 2 })).toBe(2);
    expect(readSelection({ canceled: false, selection: -1 })).toBeUndefined();
    expect(readSelection({ canceled: false, selection: 1.5 })).toBeUndefined();
    expect(readSelection({ canceled: true, selection: 0 })).toBeUndefined();
  });
});