import { describe, expect, it } from "vitest";
import CryptoJS from "crypto-js";
import { encryptWalletData, decryptWalletData, migrateLegacyWalletData } from "./walletEncryption";

describe("authenticated wallet exports", () => {
  const fixture = JSON.stringify({ metadata: { version: "1.0" }, transactions: [] });
  it("round trips and randomizes exports", async () => {
    const first = await encryptWalletData(fixture, "password123", "json");
    expect((await decryptWalletData(first, "password123")).data).toBe(fixture);
    expect(await encryptWalletData(fixture, "password123", "json")).not.toBe(first);
  });
  it("rejects wrong passwords, modified ciphertext and metadata", async () => {
    const file = await encryptWalletData(fixture, "password123", "json");
    await expect(decryptWalletData(file, "wrong")).rejects.toThrow("Incorrect password or damaged");
    for (const mutate of [
      (e: any) => { e.ciphertext = (e.ciphertext[0] === "A" ? "B" : "A") + e.ciphertext.slice(1); },
      (e: any) => { e.format = "csv"; },
      (e: any) => { e.kdf.iterations = 1; },
      (e: any) => { e.version = 3; },
    ]) {
      const envelope = JSON.parse(file); mutate(envelope);
      await expect(decryptWalletData(JSON.stringify(envelope), "password123")).rejects.toThrow();
    }
  });
  it("requires explicit legacy migration", async () => {
    const old = CryptoJS.AES.encrypt(fixture, "password123").toString();
    await expect(decryptWalletData(old, "password123")).rejects.toThrow("Legacy");
    const migrated = await migrateLegacyWalletData(old, "password123", "newpassword");
    expect(await decryptWalletData(migrated, "newpassword")).toEqual({ data: fixture, format: "json", legacy: false });
  });
});
