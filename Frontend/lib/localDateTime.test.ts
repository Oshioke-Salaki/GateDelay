import { describe, expect, it } from "vitest";
import {
  parseLocalDateInputValue,
  toLocalDateInputValue,
  toLocalDateTimeInputValue,
} from "./localDateTime";

describe("local date input helpers", () => {
  it("formats date and datetime-local values in the local calendar", () => {
    const date = new Date(2026, 2, 8, 9, 7);

    expect(toLocalDateInputValue(date)).toBe("2026-03-08");
    expect(toLocalDateTimeInputValue(date)).toBe("2026-03-08T09:07");
  });

  it("parses local calendar dates and rejects invalid dates", () => {
    const date = parseLocalDateInputValue("2026-03-08");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(8);
    expect(parseLocalDateInputValue("2026-02-30")).toBeNull();
  });
});
