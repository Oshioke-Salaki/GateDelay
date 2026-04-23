import DarkModeToggle from "../components/DarkModeToggle";

export default function SettingsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-8" style={{ color: "var(--foreground)" }}>
        Settings
      </h1>
      <section
        className="rounded-xl p-6"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: "var(--muted)" }}>
          APPEARANCE
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>
              Dark mode
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
              Switch between light and dark themes
            </p>
          </div>
          <DarkModeToggle />
        </div>
      </section>
    </main>
  );
}
