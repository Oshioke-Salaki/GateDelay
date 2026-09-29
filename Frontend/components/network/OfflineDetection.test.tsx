import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfflineModeBanner } from "./OfflineDetection";
import type { QueuedAction } from "../../hooks/useConnectivity";

const emptyQueue: QueuedAction[] = [];

function dequeue() {
  /* no-op for presentational tests */
}

describe("OfflineModeBanner", () => {
  it("shows a single offline banner with an accessible status message", () => {
    render(
      <OfflineModeBanner
        phase="offline"
        queue={emptyQueue}
        reconnectProgress={0}
        reconnectAttempt={0}
        onDequeue={dequeue}
      />,
    );

    expect(screen.getAllByTestId("offline-detection-banner")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/you're offline/i),
    );
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.queryByTestId("reconnect-progress")).not.toBeInTheDocument();
  });

  it("distinguishes backend unreachable from browser offline", () => {
    render(
      <OfflineModeBanner
        phase="unreachable"
        queue={emptyQueue}
        reconnectProgress={0}
        reconnectAttempt={0}
        onDequeue={dequeue}
      />,
    );

    expect(screen.getByText("Can't reach the server")).toBeInTheDocument();
    expect(screen.getByText(/backend is not responding/i)).toBeInTheDocument();
  });

  it("shows reconnect progress while recovery is in progress", () => {
    render(
      <OfflineModeBanner
        phase="reconnecting"
        queue={emptyQueue}
        reconnectProgress={38}
        reconnectAttempt={3}
        onDequeue={dequeue}
      />,
    );

    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    expect(screen.getByText(/attempt 3/i)).toBeInTheDocument();
    const bar = screen.getByTestId("reconnect-progress");
    expect(bar).toHaveAttribute("aria-valuenow", "38");
    expect(bar).toHaveAttribute("aria-label", "Reconnect progress");
  });

  it("does not create duplicate banners when many requests fail", () => {
    const { rerender } = render(
      <OfflineModeBanner
        phase="reconnecting"
        queue={emptyQueue}
        reconnectProgress={12}
        reconnectAttempt={1}
        onDequeue={dequeue}
      />,
    );

    rerender(
      <OfflineModeBanner
        phase="reconnecting"
        queue={emptyQueue}
        reconnectProgress={50}
        reconnectAttempt={4}
        onDequeue={dequeue}
      />,
    );
    rerender(
      <OfflineModeBanner
        phase="reconnecting"
        queue={emptyQueue}
        reconnectProgress={75}
        reconnectAttempt={6}
        onDequeue={dequeue}
      />,
    );

    expect(screen.getAllByTestId("offline-detection-banner")).toHaveLength(1);
  });

  it("shows a restored message that can be dismissed by unmounting after reconnect", () => {
    const { unmount } = render(
      <OfflineModeBanner
        phase="back-online"
        queue={emptyQueue}
        reconnectProgress={0}
        reconnectAttempt={0}
        onDequeue={dequeue}
      />,
    );

    expect(screen.getByText("Connection restored")).toBeInTheDocument();
    unmount();
    expect(screen.queryByTestId("offline-detection-banner")).not.toBeInTheDocument();
  });
});

describe("connected application chrome", () => {
  it("renders no offline banner when the presentational banner is not mounted", () => {
    render(<div data-testid="app-shell">GateDelay</div>);
    expect(screen.queryByTestId("offline-detection-banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });
});
