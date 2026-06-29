"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/useToast";
import { PageErrorBoundary } from "@/app/components/ui/PageErrorBoundary";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  createdAt: string;
  lastUsed?: string;
  usageCount: number;
  isActive: boolean;
}

interface ApiKeyStats {
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  lastRequestTime?: string;
}

function ApiKeysPageContent() {
  const toast = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setLoading(true);
    try {
      const [keysRes, statsRes] = await Promise.all([
        fetch("/api/api-keys"),
        fetch("/api/api-keys/stats"),
      ]);

      if (keysRes.ok) {
        const data = await keysRes.json();
        setApiKeys(data);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
      toast.error("Error", "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Validation", "Please enter a key name");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (response.ok) {
        const newKey = await response.json();
        setApiKeys([newKey, ...apiKeys]);
        setNewKeyName("");
        setShowCreateForm(false);
        toast.success("Key Created", "Your API key has been created");
      } else {
        toast.error("Error", "Failed to create API key");
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
      toast.error("Error", "An error occurred while creating the key");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== keyId));
        setSelectedKey(null);
        toast.success("Key Deleted", "Your API key has been deleted");
      } else {
        toast.error("Error", "Failed to delete API key");
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast.error("Error", "An error occurred while deleting the key");
    }
  };

  const handleRegenerateKey = async (keyId: string) => {
    if (!confirm("Regenerating will invalidate the current key. Continue?")) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}/regenerate`, {
        method: "POST",
      });

      if (response.ok) {
        const updatedKey = await response.json();
        setApiKeys(apiKeys.map((k) => (k.id === keyId ? updatedKey : k)));
        setSelectedKey(updatedKey);
        toast.success("Key Regenerated", "Your API key has been regenerated");
      } else {
        toast.error("Error", "Failed to regenerate API key");
      }
    } catch (error) {
      console.error("Failed to regenerate API key:", error);
      toast.error("Error", "An error occurred while regenerating the key");
    }
  };

  const handleToggleKey = async (keyId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        const updatedKey = await response.json();
        setApiKeys(apiKeys.map((k) => (k.id === keyId ? updatedKey : k)));
        setSelectedKey(updatedKey);
        toast.success(
          "Key Updated",
          `API key has been ${!isActive ? "enabled" : "disabled"}`
        );
      } else {
        toast.error("Error", "Failed to update API key");
      }
    } catch (error) {
      console.error("Failed to toggle API key:", error);
      toast.error("Error", "An error occurred while updating the key");
    }
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
    toast.success("Copied", "API key copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            API Key Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your API keys for third-party integrations
          </p>
        </div>

        {/* Usage Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Requests</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalRequests.toLocaleString()}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Requests Today</p>
              <p className="text-3xl font-bold text-blue-600">{stats.requestsToday}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">This Month</p>
              <p className="text-3xl font-bold text-blue-600">
                {stats.requestsThisMonth.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Create Key Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            {showCreateForm ? "Cancel" : "Create New Key"}
          </button>
        </div>

        {/* Create Key Form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Create New API Key
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleCreateKey}
                disabled={creating}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {creating ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        )}

        {/* API Keys List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Your API Keys ({apiKeys.length})
          </h2>

          {apiKeys.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No API keys yet</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Create Your First Key
              </button>
            </div>
          ) : (
            apiKeys.map((key) => (
              <div
                key={key.id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedKey(selectedKey?.id === key.id ? null : key)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {key.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        key.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {key.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedKey?.id === key.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
                    {/* Key Display */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        API Key
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded text-sm text-gray-900 dark:text-white break-all">
                          {copiedKeyId === key.id ? "Copied!" : key.maskedKey}
                        </code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(key.key, key.id);
                          }}
                          className="px-3 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded font-medium text-sm transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Usage Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Uses</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {key.usageCount}
                        </p>
                      </div>
                      {key.lastUsed && (
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Last Used</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {new Date(key.lastUsed).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleKey(key.id, key.isActive);
                        }}
                        className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded text-sm transition-colors"
                      >
                        {key.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerateKey(key.id);
                        }}
                        className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded text-sm transition-colors"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteKey(key.id);
                        }}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <PageErrorBoundary>
      <ApiKeysPageContent />
    </PageErrorBoundary>
  );
}
