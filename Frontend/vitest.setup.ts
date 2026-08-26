import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library only auto-registers its cleanup when Vitest runs with
// `globals: true`, which this project does not (see vitest.config.mts). Without
// this hook every render stays mounted in the document, so the second test in a
// file trips over "Found multiple elements" from the first test's DOM.
afterEach(() => {
  cleanup();
});
