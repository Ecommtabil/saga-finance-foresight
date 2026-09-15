import { describe, expect, it } from "vitest";
import { selicReal } from "@/lib/mf2/types";

describe("mf2/types", () => {
  it("calcula selic real", () => {
    const r = selicReal(0.105, 0.045);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeCloseTo((1.105) / (1.045) - 1, 6);
  });
});
