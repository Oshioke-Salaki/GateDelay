"use client";

interface StatusIndicatorProps {
  status: "open" | "closed" | "resolved" | "disputed";
  resolvedAt?: string;
  outcome?: "YES" | "NO";
  variant?: "full" | "compact";
}

export default function StatusIndicator({ status, resolvedAt, outcome, variant = "compact" }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case "open": return "bg-green-500";
      case "closed": return "bg-yellow-500";
      case "resolved": return "bg-blue-500";
      case "disputed": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
      <span className="text-sm font-medium capitalize">{status}</span>
      {outcome && <span className="text-sm">{outcome}</span>}
    </div>
  );
}