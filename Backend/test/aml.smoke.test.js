describe("AML Route Smoke Test", () => {
  it("should load aml route module without throwing errors", () => {
    expect(() => {
      require("../routes/aml");
    }).not.toThrow();
  });
});
