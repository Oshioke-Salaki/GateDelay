"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/useToast";

interface DisputeFormData {
  marketId: string;
  reason: string;
  evidence: File[];
  description: string;
}

interface Dispute {
  id: string;
  marketId: string;
  status: "pending" | "in_review" | "resolved" | "rejected";
  reason: string;
  createdAt: string;
  evidence: string[];
  resolution?: string;
}

interface DisputeInterfaceProps {
  marketId: string;
  onDisputeCreated?: (dispute: Dispute) => void;
}

export default function DisputeInterface({ marketId, onDisputeCreated }: DisputeInterfaceProps) {
  const toast = useToast();
  const { register, handleSubmit, reset, watch } = useForm<DisputeFormData>({
    defaultValues: { marketId },
  });
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/disputes?marketId=${marketId}`);
      if (response.ok) {
        const data = await response.json();
        setDisputes(data);
      }
    } catch (error) {
      console.error("Failed to load disputes:", error);
      toast.error("Error", "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: DisputeFormData) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("marketId", data.marketId);
      formData.append("reason", data.reason);
      formData.append("description", data.description);

      if (data.evidence && data.evidence.length > 0) {
        Array.from(data.evidence).forEach((file) => {
          formData.append("evidence", file);
        });
      }

      const response = await fetch("/api/disputes", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const newDispute = await response.json();
        setDisputes([newDispute, ...disputes]);
        toast.success("Dispute Created", "Your dispute has been submitted for review");
        reset();
        setShowForm(false);
        onDisputeCreated?.(newDispute);
      } else {
        toast.error("Error", "Failed to create dispute");
      }
    } catch (error) {
      console.error("Failed to create dispute:", error);
      toast.error("Error", "An error occurred while creating the dispute");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: Dispute["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "in_review":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Dispute Button */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "Create Dispute"}
        </button>
        <button
          onClick={loadDisputes}
          disabled={loading}
          className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Dispute Creation Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Create a Dispute
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Dispute
              </label>
              <select
                {...register("reason", { required: "Please select a reason" })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a reason...</option>
                <option value="incorrect_resolution">Incorrect Resolution</option>
                <option value="data_error">Data Error</option>
                <option value="technical_issue">Technical Issue</option>
                <option value="fraud_suspicion">Fraud Suspicion</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                {...register("description", { required: "Please provide a description" })}
                rows={4}
                placeholder="Provide detailed information about your dispute..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Evidence Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Evidence (Optional)
              </label>
              <input
                type="file"
                multiple
                {...register("evidence")}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB per file)
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Dispute"}
            </button>
          </form>
        </div>
      )}

      {/* Disputes List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Disputes ({disputes.length})
        </h3>

        {disputes.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">No disputes yet</p>
          </div>
        ) : (
          disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedDispute(selectedDispute?.id === dispute.id ? null : dispute)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {dispute.reason.replace(/_/g, " ").toUpperCase()}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    dispute.status
                  )}`}
                >
                  {dispute.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Expanded Details */}
              {selectedDispute?.id === dispute.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{dispute.reason}</p>
                  </div>

                  {dispute.evidence && dispute.evidence.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Evidence
                      </p>
                      <div className="space-y-1">
                        {dispute.evidence.map((file, idx) => (
                          <a
                            key={idx}
                            href={file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm block"
                          >
                            📎 Evidence {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {dispute.resolution && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Resolution
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{dispute.resolution}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
