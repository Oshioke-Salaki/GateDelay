"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IPFSStorageStatus = "idle" | "uploading" | "stored" | "retrieving" | "error";

export interface IPFSUploadResult {
  hash: string;
  url: string;
}

export interface IPFSStatus {
  stored: boolean;
  pinned: boolean;
  gatewayUrl: string;
}

export interface UseIPFSReturn {
  /** Current operation status */
  status: IPFSStorageStatus;
  /** Last uploaded/retrieved hash */
  hash: string | null;
  /** Gateway URL for the current hash */
  gatewayUrl: string | null;
  /** Storage status from the gateway endpoint */
  storageStatus: IPFSStatus | null;
  /** Last error message */
  error: string | null;
  /** Upload JSON data to IPFS */
  uploadJSON: (data: unknown, metadata?: { name?: string }) => Promise<IPFSUploadResult>;
  /** Retrieve data from IPFS by hash */
  retrieve: (hash: string) => Promise<unknown>;
  /** Pin an existing hash */
  pin: (hash: string, name?: string) => Promise<void>;
  /** Get gateway URL for a hash */
  getGatewayUrl: (hash: string) => string;
  /** Reset state */
  reset: () => void;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function uploadJSONApi(
  data: unknown,
  metadata?: { name?: string }
): Promise<IPFSUploadResult> {
  const res = await fetch("/api/ipfs/upload-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, metadata }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json.data;
}

async function retrieveApi(hash: string): Promise<unknown> {
  const res = await fetch(`/api/ipfs/retrieve/${hash}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Retrieval failed");
  return json.data;
}

async function pinApi(hash: string, name?: string): Promise<void> {
  const res = await fetch(`/api/ipfs/pin/${hash}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Pin failed");
}

async function fetchStorageStatusApi(hash: string): Promise<IPFSStatus> {
  const res = await fetch(`/api/ipfs/gateway/${hash}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Status check failed");
  return json.data;
}

const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// ─── useIPFS Hook ─────────────────────────────────────────────────────────────

export function useIPFS(initialHash?: string): UseIPFSReturn {
  const [status, setStatus] = useState<IPFSStorageStatus>("idle");
  const [hash, setHash] = useState<string | null>(initialHash ?? null);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(
    initialHash ? `${DEFAULT_GATEWAY}${initialHash}` : null
  );
  const [error, setError] = useState<string | null>(null);

  const { data: storageStatus } = useQuery({
    queryKey: ["ipfs-status", hash],
    queryFn: () => fetchStorageStatusApi(hash!),
    enabled: !!hash,
    refetchInterval: hash ? 5000 : false,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ data, metadata }: { data: unknown; metadata?: { name?: string } }) =>
      uploadJSONApi(data, metadata),
  });

  const retrieveMutation = useMutation({
    mutationFn: retrieveApi,
  });

  const pinMutation = useMutation({
    mutationFn: ({ hash: h, name }: { hash: string; name?: string }) => pinApi(h, name),
  });

  const uploadJSON = useCallback(
    async (data: unknown, metadata?: { name?: string }): Promise<IPFSUploadResult> => {
      setStatus("uploading");
      setError(null);
      try {
        const result = await uploadMutation.mutateAsync({ data, metadata });
        setHash(result.hash);
        setGatewayUrl(result.url);
        setStatus("stored");
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        setStatus("error");
        throw err;
      }
    },
    [uploadMutation]
  );

  const retrieve = useCallback(
    async (targetHash: string): Promise<unknown> => {
      setStatus("retrieving");
      setError(null);
      try {
        const data = await retrieveMutation.mutateAsync(targetHash);
        setHash(targetHash);
        setGatewayUrl(`${DEFAULT_GATEWAY}${targetHash}`);
        setStatus("stored");
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Retrieval failed";
        setError(msg);
        setStatus("error");
        throw err;
      }
    },
    [retrieveMutation]
  );

  const pin = useCallback(
    async (targetHash: string, name?: string): Promise<void> => {
      setError(null);
      try {
        await pinMutation.mutateAsync({ hash: targetHash, name });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Pin failed";
        setError(msg);
        throw err;
      }
    },
    [pinMutation]
  );

  const getGatewayUrl = useCallback((targetHash: string): string => {
    return `${DEFAULT_GATEWAY}${targetHash}`;
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setHash(null);
    setGatewayUrl(null);
    setError(null);
  }, []);

  return {
    status,
    hash,
    gatewayUrl,
    storageStatus: storageStatus ?? null,
    error,
    uploadJSON,
    retrieve,
    pin,
    getGatewayUrl,
    reset,
  };
}
