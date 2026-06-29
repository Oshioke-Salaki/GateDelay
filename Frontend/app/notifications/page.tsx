"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/useToast";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";

interface NotificationPreferences {
  email: {
    priceAlerts: boolean;
    tradeConfirmations: boolean;
    marketResolution: boolean;
    disputes: boolean;
    weeklyDigest: boolean;
  };
  push: {
    priceAlerts: boolean;
    tradeConfirmations: boolean;
    marketResolution: boolean;
    disputes: boolean;
  };
  inApp: {
    priceAlerts: boolean;
    tradeConfirmations: boolean;
    marketResolution: boolean;
    disputes: boolean;
  };
  frequency: "immediate" | "hourly" | "daily" | "weekly";
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: {
    priceAlerts: true,
    tradeConfirmations: true,
    marketResolution: true,
    disputes: true,
    weeklyDigest: true,
  },
  push: {
    priceAlerts: true,
    tradeConfirmations: true,
    marketResolution: true,
    disputes: false,
  },
  inApp: {
    priceAlerts: true,
    tradeConfirmations: true,
    marketResolution: true,
    disputes: true,
  },
  frequency: "immediate",
};

function NotificationsPageContent() {
  const toast = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/notifications/preferences");
        if (response.ok) {
          const data = await response.json();
          setPreferences(data);
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        toast.success("Preferences Saved", "Your notification preferences have been updated");
      } else {
        toast.error("Save Failed", "Failed to save preferences");
      }
    } catch (error) {
      toast.error("Error", "An error occurred while saving preferences");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (
    channel: keyof NotificationPreferences,
    type: string,
    value: boolean
  ) => {
    if (channel === "frequency") return;
    setPreferences((prev) => ({
      ...prev,
      [channel]: {
        ...(prev[channel] as Record<string, boolean>),
        [type]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Notification Preferences
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage how and when you receive notifications
          </p>
        </div>

        <div className="space-y-6">
          {/* Notification Frequency */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Notification Frequency
            </h2>
            <div className="space-y-3">
              {(["immediate", "hourly", "daily", "weekly"] as const).map((freq) => (
                <label key={freq} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="frequency"
                    value={freq}
                    checked={preferences.frequency === freq}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        frequency: e.target.value as typeof freq,
                      }))
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-3 text-gray-700 dark:text-gray-300 capitalize">
                    {freq}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Email Notifications */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Email Notifications
            </h2>
            <div className="space-y-3">
              {Object.entries(preferences.email).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => toggleNotification("email", key, e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Push Notifications */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Push Notifications
            </h2>
            <div className="space-y-3">
              {Object.entries(preferences.push).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => toggleNotification("push", key, e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* In-App Notifications */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              In-App Notifications
            </h2>
            <div className="space-y-3">
              {Object.entries(preferences.inApp).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-gray-700 dark:text-gray-300 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => toggleNotification("inApp", key, e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
            <button
              onClick={() => setPreferences(DEFAULT_PREFERENCES)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <PageErrorBoundary>
      <NotificationsPageContent />
    </PageErrorBoundary>
  );
}
