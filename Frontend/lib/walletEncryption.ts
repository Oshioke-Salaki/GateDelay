import CryptoJS from "crypto-js";

const encoder = new TextEncoder();
const iterations = 600000;
const failure = "Incorrect password or damaged wallet export.";
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(failure);
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function encryptWalletData(data: string, password: string, format: "json" | "csv"): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const header = { application: "GateDelay.wallet-data", version: 2, format, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: encode(salt) }, cipher: { name: "AES-GCM", nonce: encode(nonce), tagLength: 128 } };
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128, additionalData: encoder.encode(JSON.stringify(header)) }, await key(password, salt), encoder.encode(data));
  return JSON.stringify({ ...header, ciphertext: encode(new Uint8Array(ciphertext)) });
}
/** Legacy files have no authentication. They require explicit opt-in and must be re-exported as v2. */
export async function decryptWalletData(file: string, password: string, allowLegacy = false): Promise<{ data: string; format: "json" | "csv"; legacy: boolean }> {
  if (file.trim().startsWith("U2FsdGVkX1")) {
    if (!allowLegacy) throw new Error("Legacy export is unauthenticated. Enable legacy migration only for a trusted file.");
    try {
      const data = CryptoJS.AES.decrypt(file.trim(), password).toString(CryptoJS.enc.Utf8);
      let format: "json" | "csv" = "csv";
      if (data.trim().startsWith("{")) {
        const parsed = JSON.parse(data);
        if (parsed.metadata?.version !== "1.0" || !Array.isArray(parsed.transactions)) throw new Error(failure);
        format = "json";
      } else if (!data.startsWith('"Hash","Description","Timestamp","WalletAddress"')) throw new Error(failure);
      return { data, format, legacy: true };
    } catch { throw new Error(failure); }
  }
  try {
    const envelope = JSON.parse(file);
    const { ciphertext, ...header } = envelope;
    if (header.application !== "GateDelay.wallet-data" || header.version !== 2 || !["json", "csv"].includes(header.format) || header.kdf?.name !== "PBKDF2" || header.kdf?.hash !== "SHA-256" || header.kdf?.iterations !== iterations || header.cipher?.name !== "AES-GCM" || header.cipher?.tagLength !== 128) throw new Error(failure);
    const salt = decode(header.kdf.salt);
    const nonce = decode(header.cipher.nonce);
    const encrypted = decode(ciphertext);
    if (salt.length !== 16 || nonce.length !== 12 || encrypted.length < 16) throw new Error(failure);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128, additionalData: encoder.encode(JSON.stringify(header)) }, await key(password, salt), encrypted);
    return { data: new TextDecoder("utf-8", { fatal: true }).decode(plaintext), format: header.format, legacy: false };
  } catch { throw new Error(failure); }
}
export async function migrateLegacyWalletData(file: string, oldPassword: string, newPassword: string): Promise<string> {
  const result = await decryptWalletData(file, oldPassword, true);
  return encryptWalletData(result.data, newPassword, result.format);
}
