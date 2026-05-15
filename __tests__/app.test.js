jest.mock("../src/configs/database", () => jest.fn().mockResolvedValue(true));
jest.mock("../src/configs/passport-config", () => {});

const request = require("supertest");
const app = require("../src/configs/app");

describe("API smoke tests", () => {
  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns 400 for seller sign-in with missing body", async () => {
    const res = await request(app)
      .post("/api/v1/auth/seller/sign-in")
      .send({});
    expect([400, 422]).toContain(res.status);
  });

  it("returns 400 for buyer login with missing body", async () => {
    const res = await request(app)
      .post("/api/v1/auth/buyer/login")
      .send({});
    expect([400, 422]).toContain(res.status);
  });
});
