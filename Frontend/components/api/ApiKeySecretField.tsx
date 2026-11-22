"use client";

import { useState } from "react";
import { maskApiKey } from "../../lib/apiKeyDisplay";

interface ApiKeySecretFieldProps {
  secret?: string | null;
  prefix?: string | null;
  maskedKey?: string | null;
  name: string;
}

export default function ApiKeySecretField({
  secret,
  prefix,
  maskedKey,
  name,
}: ApiKeySecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const masked = maskedKey || maskApiKey(secret, prefix);
  const canReveal = Boolean(secret);
  const display = revealed && secret ? secret : masked;

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        API secret
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        The full secret is shown only when you choose to reveal it. Store it in a
        password manager; GateDelay cannot show a lost secret again.
      </p>
      <div className="flex items-center gap-2">
        <code
          data-testid="api-key-secret"
          data-revealed={revealed && canReveal ? "true" : "false"}
          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded text-sm text-gray-900 dark:text-white break-all"
        >
          {display}
        </code>
        {canReveal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed((value) => !value);
            }}
            className="px-3 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded font-medium text-sm transition-colors"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
        )}
      </div>
      <p className="sr-only">
        {revealed && canReveal
          ? `Full API secret for ${name} is visible`
          : `API secret for ${name} is masked`}
      </p>
    </div>
  );
}
