"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAccount } from "@particle-network/connectkit";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

// ── ABI (only the createMarket function) ─────────────────────────────────────
const MARKET_FACTORY_ABI = [
  {
    name: "createMarket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "resolutionDeadline", type: "uint256" },
      { name: "minLiquidity", type: "uint256" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "market", type: "address" }],
  },
] as const;

const MARKET_FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as `0x${string}`) ?? "0x0000000000000000000000000000000000000000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormValues {
  title: string;
  description: string;
  flightNumber: string;
  flightDate: string;
  outcomeYes: string;
  outcomeNo: string;
  resolutionDeadline: string;
  collateralToken: string;
  minLiquidity: string;
}

const STEPS = ["Market Details", "Outcomes", "Settings", "Preview"] as const;
type Step = 0 | 1 | 2 | 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildMetadataURI(values: FormValues): string {
  const meta = {
    title: values.title,
    description: values.description,
    flightNumber: values.flightNumber,
    flightDate: values.flightDate,
    outcomes: [values.outcomeYes, values.outcomeNo],
  };
  return `data:application/json;base64,${btoa(JSON.stringify(meta))}`;
}

function toUnixTimestamp(dateStr: string): bigint {
  return BigInt(Math.floor(new Date(dateStr).getTime() / 1000));
}

function parseMinLiquidity(val: string): bigint {
  // treat as USDC with 6 decimals
  return BigInt(Math.floor(parseFloat(val) * 1_000_000));
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors"
                style={{
                  background: done ? "#22c55e" : active ? "#3b82f6" : "var(--border)",
                  color: done || active ? "#fff" : "var(--muted)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className="text-xs hidden sm:block" style={{ color: active ? "var(--foreground)" : "var(--muted)" }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4"
                style={{ background: done ? "#22c55e" : "var(--border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{message}</p>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
      {children}{required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500";
const inputStyle = { background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" };

// ── Step 1: Market Details ────────────────────────────────────────────────────
function StepDetails({ register, errors }: { register: ReturnType<typeof useForm<FormValues>>["register"]; errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"] }) {
  return (
    <div className="space-y-4">
      <div>
        <Label required>Market Title</Label>
        <input
          {...register("title", { required: "Title is required", minLength: { value: 10, message: "At least 10 characters" } })}
          placeholder="Will AA123 arrive on time on Apr 25?"
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.title?.message} />
      </div>
      <div>
        <Label required>Description</Label>
        <textarea
          {...register("description", { required: "Description is required", minLength: { value: 20, message: "At least 20 characters" } })}
          rows={3}
          placeholder="Describe the market resolution criteria…"
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.description?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required>Flight Number</Label>
          <input
            {...register("flightNumber", {
              required: "Flight number is required",
              pattern: { value: /^[A-Z]{2}\d{1,4}$/i, message: "e.g. AA123" },
            })}
            placeholder="AA123"
            className={inputCls}
            style={inputStyle}
          />
          <FieldError message={errors.flightNumber?.message} />
        </div>
        <div>
          <Label required>Flight Date</Label>
          <input
            {...register("flightDate", { required: "Flight date is required" })}
            type="date"
            min={new Date().toISOString().split("T")[0]}
            className={inputCls}
            style={inputStyle}
          />
          <FieldError message={errors.flightDate?.message} />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Outcomes ──────────────────────────────────────────────────────────
function StepOutcomes({ register, errors }: { register: ReturnType<typeof useForm<FormValues>>["register"]; errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Define the two possible outcomes for this market. Traders will buy YES or NO shares.
      </p>
      <div>
        <Label required>YES Outcome</Label>
        <input
          {...register("outcomeYes", { required: "YES outcome is required" })}
          placeholder="Flight arrives on time (within 15 min)"
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.outcomeYes?.message} />
      </div>
      <div>
        <Label required>NO Outcome</Label>
        <input
          {...register("outcomeNo", { required: "NO outcome is required" })}
          placeholder="Flight is delayed more than 15 min"
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.outcomeNo?.message} />
      </div>
      <div
        className="rounded-lg p-3 text-xs space-y-1"
        style={{ background: "#3b82f618", border: "1px solid #3b82f644", color: "var(--foreground)" }}
      >
        <p className="font-medium">How outcomes work</p>
        <p style={{ color: "var(--muted)" }}>
          When the market resolves, one outcome wins. YES holders receive 1 USDC per share; NO holders receive nothing, and vice versa.
        </p>
      </div>
    </div>
  );
}

// ── Step 3: Settings ──────────────────────────────────────────────────────────
function StepSettings({ register, errors }: { register: ReturnType<typeof useForm<FormValues>>["register"]; errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"] }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 16);

  return (
    <div className="space-y-4">
      <div>
        <Label required>Resolution Deadline</Label>
        <input
          {...register("resolutionDeadline", {
            required: "Resolution deadline is required",
            validate: (v) => new Date(v) > new Date() || "Deadline must be in the future",
          })}
          type="datetime-local"
          min={minDate}
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.resolutionDeadline?.message} />
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>When the market will be resolved by an oracle.</p>
      </div>
      <div>
        <Label required>Collateral Token Address</Label>
        <input
          {...register("collateralToken", {
            required: "Collateral token is required",
            pattern: { value: /^0x[0-9a-fA-F]{40}$/, message: "Must be a valid EVM address" },
          })}
          placeholder="0x..."
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.collateralToken?.message} />
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>ERC-20 token used as collateral (e.g. USDC on Mantle).</p>
      </div>
      <div>
        <Label required>Minimum Liquidity (USDC)</Label>
        <input
          {...register("minLiquidity", {
            required: "Minimum liquidity is required",
            min: { value: 1, message: "Must be at least 1 USDC" },
            validate: (v) => !isNaN(parseFloat(v)) || "Must be a number",
          })}
          type="number"
          min="1"
          step="1"
          placeholder="100"
          className={inputCls}
          style={inputStyle}
        />
        <FieldError message={errors.minLiquidity?.message} />
      </div>
    </div>
  );
}

// ── Step 4: Preview ───────────────────────────────────────────────────────────
function StepPreview({ values }: { values: FormValues }) {
  const rows: [string, string][] = [
    ["Title", values.title],
    ["Description", values.description],
    ["Flight", `${values.flightNumber} on ${values.flightDate}`],
    ["YES Outcome", values.outcomeYes],
    ["NO Outcome", values.outcomeNo],
    ["Resolution Deadline", values.resolutionDeadline ? new Date(values.resolutionDeadline).toLocaleString() : "—"],
    ["Collateral Token", values.collateralToken],
    ["Min Liquidity", `${values.minLiquidity} USDC`],
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Review your market before submitting to the blockchain.
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className="flex gap-4 px-4 py-3 text-sm"
            style={{
              background: i % 2 === 0 ? "var(--card)" : "transparent",
              borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span className="w-40 shrink-0 font-medium" style={{ color: "var(--muted)" }}>{label}</span>
            <span className="break-all" style={{ color: "var(--foreground)" }}>{value || "—"}</span>
          </div>
        ))}
      </div>
      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: "#f59e0b18", border: "1px solid #f59e0b44", color: "var(--foreground)" }}
      >
        <span className="font-medium">Gas fees apply.</span>{" "}
        <span style={{ color: "var(--muted)" }}>
          Submitting will trigger a wallet transaction on Mantle. Make sure your wallet is connected and funded.
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreateMarketForm() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [step, setStep] = useState<Step>(0);
  const [txError, setTxError] = useState<string | null>(null);

  const { writeContract, data: txHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ mode: "onTouched" });

  // Fields validated per step
  const STEP_FIELDS: (keyof FormValues)[][] = [
    ["title", "description", "flightNumber", "flightDate"],
    ["outcomeYes", "outcomeNo"],
    ["resolutionDeadline", "collateralToken", "minLiquidity"],
    [],
  ];

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, 3) as Step);
  };

  const back = () => setStep((s) => Math.max(s - 1, 0) as Step);

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) { setTxError("Please connect your wallet first."); return; }
    setTxError(null);
    try {
      writeContract({
        address: MARKET_FACTORY_ADDRESS,
        abi: MARKET_FACTORY_ABI,
        functionName: "createMarket",
        args: [
          values.collateralToken as `0x${string}`,
          toUnixTimestamp(values.resolutionDeadline),
          parseMinLiquidity(values.minLiquidity),
          buildMetadataURI(values),
        ],
      });
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : "Transaction failed");
    }
  };

  // Redirect after confirmation
  if (isSuccess && txHash) {
    router.push(`/markets/${txHash}`);
  }

  const isSubmitting = isSigning || isConfirming;

  return (
    <div
      className="max-w-xl mx-auto rounded-2xl p-6 sm:p-8"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        Create Prediction Market
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Launch a new flight prediction market on Mantle.
      </p>

      <StepIndicator current={step} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {step === 0 && <StepDetails register={register} errors={errors} />}
        {step === 1 && <StepOutcomes register={register} errors={errors} />}
        {step === 2 && <StepSettings register={register} errors={errors} />}
        {step === 3 && <StepPreview values={getValues()} />}

        {/* Tx error */}
        {txError && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{ background: "#ef444418", border: "1px solid #ef444444", color: "#ef4444" }}
          >
            {txError}
          </div>
        )}

        {/* Tx hash pending */}
        {txHash && !isSuccess && (
          <div
            className="mt-4 rounded-lg px-4 py-3 text-xs break-all"
            style={{ background: "#3b82f618", border: "1px solid #3b82f644", color: "var(--foreground)" }}
          >
            <span className="font-medium">Transaction submitted:</span>{" "}
            <span style={{ color: "var(--muted)" }}>{txHash}</span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={isSubmitting}
              className="rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#3b82f6" }}
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !isConnected}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#22c55e" }}
            >
              {isSubmitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isSigning ? "Confirm in wallet…" : isConfirming ? "Confirming…" : "Create Market"}
            </button>
          )}
        </div>

        {step === 3 && !isConnected && (
          <p className="text-xs text-center mt-3" style={{ color: "#f59e0b" }}>
            Connect your wallet to submit.
          </p>
        )}
      </form>
    </div>
  );
}
