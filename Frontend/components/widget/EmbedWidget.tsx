"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Code2, ExternalLink, LayoutPanelTop, MonitorPlay } from "lucide-react";
import { useToast } from "@/hooks/useToast";

type WidgetTheme = "light" | "dark" | "sand";
type WidgetLayout = "compact" | "stacked";
type EmbedMode = "iframe" | "inline";

interface WidgetConfig {
  title: string;
  marketLabel: string;
  theme: WidgetTheme;
  layout: WidgetLayout;
  accentColor: string;
  width: number;
  height: number;
  borderRadius: number;
  showPrice: boolean;
  showVolume: boolean;
  showChange: boolean;
}

interface EmbedWidgetProps {
  initialConfig?: Partial<WidgetConfig>;
}

type ToggleKey = "showPrice" | "showVolume" | "showChange";

const DEFAULT_CONFIG: WidgetConfig = {
  title: "GateDelay Market Widget",
  marketLabel: "JFK delay probability",
  theme: "light",
  layout: "stacked",
  accentColor: "#0f766e",
  width: 360,
  height: 224,
  borderRadius: 20,
  showPrice: true,
  showVolume: true,
  showChange: true,
};

function getThemeTokens(theme: WidgetTheme) {
  switch (theme) {
    case "dark":
      return {
        background: "#05131a",
        foreground: "#f5fbff",
        muted: "#9fb3c8",
        panel: "#0d2029",
      };
    case "sand":
      return {
        background: "#f7efe2",
        foreground: "#1f2937",
        muted: "#6b7280",
        panel: "#fffaf2",
      };
    default:
      return {
        background: "#f8fbfc",
        foreground: "#102a43",
        muted: "#627d98",
        panel: "#ffffff",
      };
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildWidgetMarkup(config: WidgetConfig): string {
  const tokens = getThemeTokens(config.theme);
  const changeMarkup = config.showChange
    ? `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:${tokens.muted};text-transform:uppercase;letter-spacing:0.12em;">24h</span><span style="font-size:14px;font-weight:700;color:#16a34a;">+3.4%</span></div>`
    : "";
  const priceMarkup = config.showPrice
    ? `<div><div style="font-size:12px;color:${tokens.muted};text-transform:uppercase;letter-spacing:0.12em;">Price</div><div style="margin-top:6px;font-size:28px;font-weight:800;color:${tokens.foreground};">62.5¢</div></div>`
    : "";
  const volumeMarkup = config.showVolume
    ? `<div><div style="font-size:12px;color:${tokens.muted};text-transform:uppercase;letter-spacing:0.12em;">Volume</div><div style="margin-top:6px;font-size:16px;font-weight:700;color:${tokens.foreground};">$1.28M</div></div>`
    : "";
  const layoutDirection = config.layout === "compact" ? "row" : "column";
  const statsColumns = config.layout === "compact" ? "1fr 1fr" : "repeat(2, minmax(0, 1fr))";

  return `
<section style="box-sizing:border-box;width:100%;height:100%;padding:18px;border-radius:${config.borderRadius}px;background:linear-gradient(160deg, ${tokens.panel} 0%, ${tokens.background} 100%);border:1px solid rgba(148,163,184,0.24);display:flex;flex-direction:${layoutDirection};justify-content:space-between;gap:18px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div>
    <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:${config.accentColor}22;color:${config.accentColor};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">GateDelay Embed</div>
    <h1 style="margin:14px 0 6px;font-size:20px;line-height:1.2;color:${tokens.foreground};">${config.title}</h1>
    <p style="margin:0;font-size:14px;line-height:1.5;color:${tokens.muted};">${config.marketLabel}</p>
  </div>
  <div style="display:grid;grid-template-columns:${statsColumns};gap:12px;">
    ${priceMarkup}
    ${volumeMarkup}
    ${changeMarkup}
    <div style="display:flex;align-items:flex-end;justify-content:flex-end;">
      <div style="height:56px;width:100%;border-radius:14px;background:linear-gradient(135deg, ${config.accentColor}33 0%, ${config.accentColor}0f 100%);position:relative;overflow:hidden;">
        <div style="position:absolute;left:14px;right:14px;bottom:14px;height:2px;background:${config.accentColor};transform:skewX(-18deg);"></div>
        <div style="position:absolute;left:24px;bottom:20px;width:14px;height:14px;border-radius:999px;background:${config.accentColor};"></div>
        <div style="position:absolute;left:48%;bottom:28px;width:14px;height:14px;border-radius:999px;background:${config.accentColor};"></div>
        <div style="position:absolute;right:24px;bottom:38px;width:14px;height:14px;border-radius:999px;background:${config.accentColor};"></div>
      </div>
    </div>
  </div>
</section>`.trim();
}

function buildPreviewHtml(config: WidgetConfig): string {
  const tokens = getThemeTokens(config.theme);
  const widgetMarkup = buildWidgetMarkup(config);

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${tokens.background};">
    ${widgetMarkup}
  </body>
</html>`.trim();
}

function buildEmbedCode(mode: EmbedMode, config: WidgetConfig): string {
  const previewHtml = buildPreviewHtml(config);
  const widgetMarkup = buildWidgetMarkup(config);

  if (mode === "inline") {
    return `<div id="gatedelay-widget"></div>
<script>
  (() => {
    const root = document.getElementById("gatedelay-widget");
    if (!root) return;
    root.style.width = "${config.width}px";
    root.style.height = "${config.height}px";
    root.innerHTML = ${JSON.stringify(widgetMarkup)};
  })();
</script>`;
  }

  return `<iframe
  title="GateDelay market widget"
  width="${config.width}"
  height="${config.height}"
  loading="lazy"
  style="border:0;border-radius:${config.borderRadius}px;overflow:hidden;"
  srcdoc="${escapeHtmlAttribute(previewHtml)}"
></iframe>`;
}

function StepInstruction({ step, detail }: { step: string; detail: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        {step}
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
        {detail}
      </p>
    </div>
  );
}

export default function EmbedWidget({ initialConfig }: EmbedWidgetProps) {
  const toast = useToast();
  const [embedMode, setEmbedMode] = useState<EmbedMode>("iframe");
  const [config, setConfig] = useState<WidgetConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const toggleControls: { key: ToggleKey; label: string }[] = [
    { key: "showPrice", label: "Show price" },
    { key: "showVolume", label: "Show volume" },
    { key: "showChange", label: "Show 24h change" },
  ];

  const previewHtml = useMemo(() => buildPreviewHtml(config), [config]);
  const embedCode = useMemo(() => buildEmbedCode(embedMode, config), [config, embedMode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    toast.success("Embed code copied", "Paste the snippet into any external site that accepts HTML embeds.");
  };

  return (
    <section
      className="rounded-3xl p-6 space-y-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-500" />
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Embed Widget Builder
            </h2>
          </div>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
            Customize the widget, generate production-ready embed code, and verify the output in a live preview before publishing.
          </p>
        </div>

        <div
          className="inline-flex items-center gap-2 rounded-2xl px-4 py-2"
          style={{ background: "rgba(34, 197, 94, 0.12)", color: "#16a34a" }}
        >
          <CheckCircle2 className="w-4 h-4" />
          Preview acts as your embed test
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div
            className="rounded-2xl p-4 space-y-4"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div>
              <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Widget title
              </label>
              <input
                value={config.title}
                onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Market label
              </label>
              <input
                value={config.marketLabel}
                onChange={(event) => setConfig((current) => ({ ...current, marketLabel: event.target.value }))}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Theme
                </label>
                <select
                  value={config.theme}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, theme: event.target.value as WidgetTheme }))
                  }
                  className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="sand">Sand</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Layout
                </label>
                <select
                  value={config.layout}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, layout: event.target.value as WidgetLayout }))
                  }
                  className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <option value="stacked">Stacked</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Width
                </label>
                <input
                  type="number"
                  min={280}
                  max={720}
                  value={config.width}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, width: Number(event.target.value) || current.width }))
                  }
                  className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Height
                </label>
                <input
                  type="number"
                  min={180}
                  max={640}
                  value={config.height}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, height: Number(event.target.value) || current.height }))
                  }
                  className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Accent color
                </label>
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={(event) => setConfig((current) => ({ ...current, accentColor: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-xl border"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                  Radius
                </label>
                <input
                  type="number"
                  min={0}
                  max={36}
                  value={config.borderRadius}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      borderRadius: Number(event.target.value) || current.borderRadius,
                    }))
                  }
                  className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                Embed mode
              </label>
              <select
                value={embedMode}
                onChange={(event) => setEmbedMode(event.target.value as EmbedMode)}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <option value="iframe">Iframe</option>
                <option value="inline">Inline HTML</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {toggleControls.map((item) => (
                <label
                  key={item.key}
                  className="inline-flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {item.label}
                  <input
                    type="checkbox"
                    checked={config[item.key]}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <LayoutPanelTop className="w-4 h-4 text-emerald-500" />
                <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Generated Code
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  color: "#0f766e",
                  background: "rgba(15, 118, 110, 0.12)",
                  border: "1px solid rgba(15, 118, 110, 0.24)",
                }}
              >
                <Clipboard className="w-4 h-4" />
                Copy embed code
              </button>
            </div>

            <pre
              className="rounded-2xl p-4 overflow-x-auto text-xs leading-6"
              style={{
                background: "#05131a",
                color: "#d1fae5",
                border: "1px solid rgba(16, 185, 129, 0.18)",
              }}
            >
              {embedCode}
            </pre>
          </div>

          <div
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <MonitorPlay className="w-4 h-4 text-emerald-500" />
              <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Widget Preview
              </h3>
            </div>

            <iframe
              title="GateDelay widget preview"
              srcDoc={previewHtml}
              className="w-full rounded-2xl"
              style={{
                height: config.height,
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
            />

            <div className="flex flex-wrap gap-3 text-sm" style={{ color: "var(--muted)" }}>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Customization updates both preview and code instantly
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4 text-emerald-500" />
                Use the preview as a pre-publish functionality check
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <StepInstruction
              step="1. Add the snippet"
              detail="Paste the generated iframe or inline HTML into the host CMS, marketing page, or docs site."
            />
            <StepInstruction
              step="2. Match the container"
              detail="Set the parent container width to the same value shown in the builder so the widget does not clip."
            />
            <StepInstruction
              step="3. Verify behavior"
              detail="Compare the live preview with the embedded result to confirm colors, layout, and data blocks render correctly."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
