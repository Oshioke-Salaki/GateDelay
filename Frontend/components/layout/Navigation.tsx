"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import DarkModeToggle from "../../app/components/DarkModeToggle";
import WalletButton from "../../app/components/WalletButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Markets" },
  { href: "/bridge", label: "Bridge" },
  { href: "/transactions", label: "History" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

/**
 * Fully responsive top navigation bar.
 *
 * Desktop (lg+): horizontal link row + dark-mode toggle + wallet button.
 * Mobile (<lg):  logo + hamburger button; links slide in from the right as a
 *                full-width drawer with touch-friendly tap targets.
 *
 * Accessibility:
 *  - <nav> has aria-label
 *  - Hamburger button uses aria-expanded / aria-controls
 *  - Mobile menu has role="dialog" + aria-modal + aria-label
 *  - Focus is trapped inside the open menu (Tab / Shift+Tab cycle)
 *  - Escape closes the menu and returns focus to the trigger
 *  - Active link is marked with aria-current="page"
 */
export default function Navigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close on Escape; trap focus inside open menu
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!menuOpen) return;

      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && menuRef.current) {
        const focusable = Array.from(
          menuRef.current.querySelectorAll<HTMLElement>(
            'a[href], button, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [menuOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Move focus into menu when it opens
  useEffect(() => {
    if (menuOpen) {
      // Small delay so the element is visible before focusing
      const id = setTimeout(() => {
        menuRef.current
          ?.querySelector<HTMLElement>('a[href], button')
          ?.focus();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [menuOpen]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3"
        style={{
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="font-bold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          style={{ color: "var(--foreground)" }}
        >
          GateDelay
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-1" role="list">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                aria-current={active ? "page" : undefined}
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  color: active ? "var(--foreground)" : "var(--muted)",
                  background: active ? "var(--card)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Desktop actions */}
        <div className="hidden lg:flex items-center gap-3">
          <DarkModeToggle />
          <WalletButton />
        </div>

        {/* Mobile: dark-mode toggle + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <DarkModeToggle />
          <button
            ref={triggerRef}
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="rounded-lg p-2 transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ color: "var(--foreground)" }}
          >
            {/* Animated hamburger / close icon */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="currentColor"
              aria-hidden="true"
            >
              {menuOpen ? (
                /* X icon */
                <>
                  <line
                    x1="3" y1="3" x2="19" y2="19"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  />
                  <line
                    x1="19" y1="3" x2="3" y2="19"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  />
                </>
              ) : (
                /* Hamburger icon */
                <>
                  <rect y="4"  width="22" height="2" rx="1" />
                  <rect y="10" width="22" height="2" rx="1" />
                  <rect y="16" width="22" height="2" rx="1" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}

      {/* Mobile drawer */}
      <div
        id="mobile-menu"
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          "fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] flex flex-col py-6 px-4 gap-1",
          "transform transition-transform duration-250 ease-in-out lg:hidden",
          menuOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        style={{
          background: "var(--background)",
          borderLeft: "1px solid var(--border)",
          boxShadow: menuOpen ? "-4px 0 24px rgba(0,0,0,0.15)" : "none",
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <Link
            href="/"
            onClick={closeMenu}
            className="font-bold text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            style={{ color: "var(--foreground)" }}
          >
            GateDelay
          </Link>
          <button
            onClick={closeMenu}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 transition-colors hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ color: "var(--foreground)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="17" y1="3" x2="3" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav links — large touch targets */}
        <nav aria-label="Mobile navigation links">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                aria-current={active ? "page" : undefined}
                className="flex items-center rounded-xl px-4 py-3.5 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  color: active ? "var(--foreground)" : "var(--muted)",
                  background: active ? "var(--card)" : "transparent",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                  minHeight: "48px", // WCAG 2.5.5 touch target
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Wallet button at the bottom of the drawer */}
        <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <WalletButton />
        </div>
      </div>
    </>
  );
}
