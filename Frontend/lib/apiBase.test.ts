import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MissingApiBaseError,
  MissingBackendUrlError,
  resolveApiBase,
  resolveBackendUrl,
} from "./apiBase";

describe("resolveApiBase", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/api/");
    expect(resolveApiBase()).toBe("https://api.example.com/api");
  });

  it("falls back to localhost:4000/api in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(resolveApiBase()).toBe("http://localhost:4000/api");
  });

  it("throws in production when unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(() => resolveApiBase()).toThrow(MissingApiBaseError);
  });
});

describe("resolveBackendUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured origin without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.example.com/");
    expect(resolveBackendUrl()).toBe("https://api.example.com");
  });

  it("falls back to localhost:4000 in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    expect(resolveBackendUrl()).toBe("http://localhost:4000");
  });

  it("throws in production when unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    expect(() => resolveBackendUrl()).toThrow(MissingBackendUrlError);
  });
});
