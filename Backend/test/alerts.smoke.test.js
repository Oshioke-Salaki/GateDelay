const express = require("express");

describe("Alerts Route Smoke Test", () => {
  it("should load alerts route module without errors", () => {
    expect(() => {
      require("../routes/alerts");
    }).not.toThrow();
  });
});
