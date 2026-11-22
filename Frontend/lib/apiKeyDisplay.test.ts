import { describe, expect, it } from "vitest";
import { maskApiKey } from "./apiKeyDisplay";

describe("maskApiKey", () => {
  it("never returns the full secret", () => {
    const secret = "gdk_abcdefghijklmnopqrstuvwxyz012345";
    const masked = maskApiKey(secret, "gdk_abcdef");
    expect(masked).not.toContain("ghijklmnopqrstuvwxyz012345");
    expect(masked).toContain("•");
    expect(masked.startsWith("gdk_abcdef")).toBe(true);
  });
});
