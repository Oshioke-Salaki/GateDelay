/**
 * Tests for FlightSearchAutocomplete
 *
 * Covers:
 *   #1186 — aviation-provider response validation
 *   #1187 — popup stays closed after selection
 *   #1185 — complete combobox accessibility semantics
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FlightSearchAutocomplete from "./FlightSearchAutocomplete";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_RESPONSE = {
  data: [
    {
      flight: { iata: "AA100" },
      airline: { name: "American Airlines" },
      departure: { iata: "JFK" },
      arrival: { iata: "LAX" },
    },
    {
      flight: { iata: "AA101" },
      airline: { name: "American Airlines" },
      departure: { iata: "LAX" },
      arrival: { iata: "ORD" },
    },
  ],
};

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubEnv("NEXT_PUBLIC_AVIATION_STACK_KEY", "test-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// #1185 — combobox semantics
// ---------------------------------------------------------------------------

describe("#1185 combobox semantics", () => {
  it("input has role=combobox with aria-expanded=false when closed", () => {
    render(<FlightSearchAutocomplete />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("aria-expanded=true and listbox visible when suggestions are open", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("input aria-controls points to the listbox id", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    const listbox = screen.getByRole("listbox");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
  });

  it("aria-activedescendant tracks the highlighted option on ArrowDown", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    // No option highlighted yet.
    expect(input).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      const activeId = input.getAttribute("aria-activedescendant");
      expect(activeId).toBeTruthy();
      const activeOption = document.getElementById(activeId!);
      expect(activeOption).not.toBeNull();
      expect(activeOption).toHaveAttribute("aria-selected", "true");
    });
  });

  it("each option has role=option with aria-selected", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBe(2);
    options.forEach((opt) => {
      expect(opt).toHaveAttribute("aria-selected");
    });
  });

  it("two mounted widgets have distinct listbox IDs", async () => {
    render(
      <>
        <FlightSearchAutocomplete />
        <FlightSearchAutocomplete />
      </>,
    );
    const inputs = screen.getAllByRole("combobox");
    const ids = inputs.map((i) => i.getAttribute("aria-controls"));
    expect(ids[0]).not.toBe(ids[1]);
    // Both IDs must be non-empty.
    ids.forEach((id) => expect(id).toBeTruthy());
  });

  it("Escape closes the popup", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});

// ---------------------------------------------------------------------------
// #1187 — popup stays closed after selection
// ---------------------------------------------------------------------------

describe("#1187 popup stays closed after selection", () => {
  it("mouse click on a suggestion closes the popup and keeps it closed", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    // Click the first option.
    const [firstOption] = screen.getAllByRole("option");
    await user.click(firstOption);

    // Popup should be gone immediately.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ flight_number: "AA100" }),
    );

    // Let any debounced searches run — popup must stay closed.
    await vi.advanceTimersByTimeAsync(600);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keyboard Enter on highlighted option closes popup and keeps it closed", async () => {
    global.fetch = makeFetch(VALID_RESPONSE);
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    await user.type(input, "AA");
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());

    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledOnce();

    // Popup stays closed after debounce window.
    await vi.advanceTimersByTimeAsync(600);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// #1186 — aviation-provider response validation
// ---------------------------------------------------------------------------

describe("#1186 response validation", () => {
  it("shows provider error when data.data is an object instead of an array", async () => {
    global.fetch = makeFetch({ data: { not: "an array" } });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    await user.type(screen.getByRole("combobox"), "AA");
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/provider error/i),
    );
  });

  it("discards null records and renders only valid ones", async () => {
    global.fetch = makeFetch({
      data: [
        null,
        { flight: null, airline: { name: "X" }, departure: { iata: "A" }, arrival: { iata: "B" } },
        { flight: { iata: "" }, airline: { name: "X" }, departure: { iata: "A" }, arrival: { iata: "B" } },
        VALID_RESPONSE.data[0], // only valid record
      ],
    });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    await user.type(screen.getByRole("combobox"), "AA");
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => expect(screen.getByRole("listbox")).toBeInTheDocument());
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("AA100");
  });

  it("shows no-results feedback when all records are malformed", async () => {
    global.fetch = makeFetch({
      data: [
        null,
        { flight: { iata: "" } },
        "not an object",
      ],
    });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    await user.type(screen.getByRole("combobox"), "AA");
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/no flights found/i),
    );
  });

  it("shows provider error when response envelope is not an object", async () => {
    global.fetch = makeFetch("a plain string");
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    await user.type(screen.getByRole("combobox"), "AA");
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/provider error/i),
    );
  });

  it("shows provider error when response contains an error field", async () => {
    global.fetch = makeFetch({ error: { code: 101, message: "Invalid API key." } });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });

    render(<FlightSearchAutocomplete />);
    await user.type(screen.getByRole("combobox"), "AA");
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/provider error/i),
    );
  });
});
