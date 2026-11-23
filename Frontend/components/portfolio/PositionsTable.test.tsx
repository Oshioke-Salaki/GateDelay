import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PositionsTable from "./PositionsTable";

describe("PositionsTable", () => {
  it("renders a real empty state when an explicit empty account is supplied", () => {
    render(<PositionsTable data={[]} />);

    expect(screen.getByText("No positions yet.")).toBeInTheDocument();
    expect(screen.getByText(/0 positions/)).toBeInTheDocument();
  });

  it("keeps loading and error states distinct from an empty account", () => {
    const { rerender } = render(<PositionsTable data={[]} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading positions");

    rerender(<PositionsTable data={[]} error="Request failed (401)" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Request failed (401)");
  });
});
