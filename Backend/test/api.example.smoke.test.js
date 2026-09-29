describe("API Example Route Smoke Test", () => {
  it("should load api.example route module without errors", () => {
    expect(() => {
      require("../routes/api.example");
    }).not.toThrow();
  });
});
