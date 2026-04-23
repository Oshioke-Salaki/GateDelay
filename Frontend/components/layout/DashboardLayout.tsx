"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Markets", icon: "📈" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "💼" },
  { href: "/dashboard/activity", label: "Activity", icon: "🕒" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed top-[56px] left-0 z-30 h-[calc(100vh-56px)] w-56 flex-shrink-0 flex flex-col py-4 px-3 gap-1 transition-transform duration-200",
          "lg:static lg:translate-x-0 lg:z-auto lg:h-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ background: "var(--card)", borderRight: "1px solid var(--border)" }}
      >
        {NAV_LINKS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--background)" : "transparent",
                color: active ? "var(--foreground)" : "var(--muted)",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <span aria-hidden>{icon}</span>
              {label}
            </Link>
          );
        })}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div
          className="flex items-center gap-3 px-4 py-3 lg:hidden"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-lg p-1.5 transition-colors hover:opacity-70"
            style={{ color: "var(--foreground)" }}
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1" />
              <rect y="9" width="20" height="2" rx="1" />
              <rect y="15" width="20" height="2" rx="1" />
            </svg>
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Dashboard
          </span>
        </div>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
