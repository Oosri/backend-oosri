jest.mock("../src/configs/database", () => jest.fn().mockResolvedValue(true));
jest.mock("../src/configs/passport-config", () => {});

const request = require("supertest");
const app = require("../src/configs/app");

describe("Attribute route authentication", () => {
  it("GET /attributes is publicly accessible (no token)", async () => {
    const res = await request(app).get("/api/v1/attributes");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("POST /attributes returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/v1/attributes")
      .send({ name: "Test", type: "text" });
    expect(res.status).toBe(401);
  });

  it("PUT /attributes/:id returns 401 without a token", async () => {
    const res = await request(app)
      .put("/api/v1/attributes/64f1a2b3c4d5e6f7a8b9c0d1")
      .send({ name: "Updated" });
    expect(res.status).toBe(401);
  });

  it("DELETE /attributes/:id returns 401 without a token", async () => {
    const res = await request(app)
      .delete("/api/v1/attributes/64f1a2b3c4d5e6f7a8b9c0d1");
    expect(res.status).toBe(401);
  });
});
