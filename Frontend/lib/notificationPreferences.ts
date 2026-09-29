export type NotificationEventType =
  | "trade_confirmation"
  | "trade_filled"
  | "dispute_opened"
  | "market_resolved"
  | "system";

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  optedOutTypes: NotificationEventType[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export function getNotificationAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("accessToken") ?? window.localStorage.getItem("access_token");
}

async function requestPreferences(
  method: "GET" | "PATCH",
  token: string,
  body?: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const response = await fetch(`${API_BASE}/notifications/preferences`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let message = `Notification preferences request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.message ?? payload.error ?? message;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<NotificationPreferences>;
}

export function getNotificationPreferences(token: string) {
  return requestPreferences("GET", token);
}

export function updateNotificationPreferences(
  token: string,
  updates: Partial<NotificationPreferences>,
) {
  return requestPreferences("PATCH", token, updates);
}