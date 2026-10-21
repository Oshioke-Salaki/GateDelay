"use client";
import { useState } from "react";
import { decryptWalletData, migrateLegacyWalletData } from "../../lib/walletEncryption";

/** Recovery downloads data for inspection; it never imports signing credentials or overwrites local history. */
export default function RecoverWalletData() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function recover() {
    if (!file || !password || busy) return;
    setBusy(true); setMessage("");
    try {
      const content = await file.text();
      const result = await decryptWalletData(content, password, legacy);
      const output = result.legacy ? await migrateLegacyWalletData(content, password, password) : result.data;
      const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.legacy ? "gate_delay_migrated." + result.format + ".enc" : "gate_delay_recovered." + result.format;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(result.legacy ? "Legacy file migrated to v2. Original integrity could not be verified." : "Export authenticated and recovered. Check your downloads.");
      setPassword("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recovery failed."); }
    finally { setBusy(false); }
  }
  return <details className="mb-5 text-sm">
    <summary>Recover or migrate an exported data file</summary>
    <div className="space-y-3 mt-3">
      <input aria-label="Encrypted data file" type="file" accept=".enc" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setMessage(""); }} />
      <input aria-label="Export password" type="password" autoComplete="off" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="w-full border rounded p-2" />
      <label className="block"><input type="checkbox" checked={legacy} disabled={busy} onChange={e => setLegacy(e.target.checked)} /> Allow migration of a trusted legacy file. Legacy integrity cannot be verified; migration downloads a new encrypted v2 file using this password.</label>
      <button type="button" disabled={busy || !file || !password} onClick={recover} className="border rounded p-2">{busy ? "Recovering…" : "Recover data / migrate legacy"}</button>
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
