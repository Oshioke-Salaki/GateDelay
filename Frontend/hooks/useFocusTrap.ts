import { useEffect, RefObject } from "react";

/**
 * useFocusTrap
 *
 * While `active` is true, keyboard focus is constrained to focusable descendants
 * of `containerRef`.  Tab cycles forward through them; Shift+Tab cycles backward.
 * Focus is automatically moved into the container when it becomes active, and
 * restored to the previously-focused element when it becomes inactive.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Remember who had focus before we trapped it
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Query all tabbable elements inside the container
    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
        (el) => !el.closest("[hidden]") && el.offsetParent !== null,
      );

    // Move focus into the container on open
    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      // If nothing is focusable yet, focus the container itself
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const nodes = getFocusable();
      if (nodes.length === 0) { e.preventDefault(); return; }

      const first = nodes[0];
      const last  = nodes[nodes.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first → last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last → first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to wherever the user was before the modal opened
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
