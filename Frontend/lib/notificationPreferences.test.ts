import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("notification preferences API", () => {
  it("loads preferences with the bearer token", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://backend.test/api");
    const preferences = { email: true, push: false, inApp: true, optedOutTypes: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => preferences,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getNotificationPreferences } = await import("./notificationPreferences");
    await expect(getNotificationPreferences("jwt-value")).resolves.toEqual(preferences);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.test/api/notifications/preferences",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-value" }),
      }),
    );
  });

  it("patches preference updates and reports API failures", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://backend.test/api");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ optedOutTypes: ["market_resolved"] }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: "Unauthorized" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { updateNotificationPreferences } = await import("./notificationPreferences");
    await expect(updateNotificationPreferences("jwt-value", { optedOutTypes: ["market_resolved"] }))
      .resolves.toMatchObject({ optedOutTypes: ["market_resolved"] });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ optedOutTypes: ["market_resolved"] }),
    });
    await expect(updateNotificationPreferences("jwt-value", { email: false }))
      .rejects.toThrow("Unauthorized");
  });
});
