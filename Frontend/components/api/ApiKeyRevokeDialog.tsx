"use client";

export type RevokeDialogState = "confirm" | "revoking" | "revoked" | "error";

interface ApiKeyRevokeDialogProps {
  keyName: string;
  maskedSecret: string;
  state: RevokeDialogState;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ApiKeyRevokeDialog({
  keyName,
  maskedSecret,
  state,
  errorMessage,
  onCancel,
  onConfirm,
}: ApiKeyRevokeDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-api-key-title"
      data-testid="api-key-revoke-dialog"
      data-state={state}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={state === "revoking" ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="revoke-api-key-title"
          className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
        >
          {state === "revoked" ? "API key revoked" : "Revoke API key?"}
        </h2>

        {state === "confirm" && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Revoking <strong>{keyName}</strong> immediately disables this
              credential. Any integration still sending{" "}
              <code className="text-xs">{maskedSecret}</code> will be rejected.
              This cannot be undone; create a new key if you still need access.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded text-sm font-medium bg-gray-200 dark:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                data-testid="confirm-revoke"
                className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white"
              >
                Revoke key
              </button>
            </div>
          </>
        )}

        {state === "revoking" && (
          <p data-testid="revoke-pending">Revoking {keyName}…</p>
        )}

        {state === "revoked" && (
          <>
            <p data-testid="revoke-success">
              {keyName} has been revoked and can no longer authenticate.
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="mt-4 px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white"
            >
              Done
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <p role="alert" data-testid="revoke-error">
              {errorMessage || "The key could not be revoked. Try again."}
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={onCancel} className="px-4 py-2 rounded text-sm">
                Close
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white"
              >
                Retry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
