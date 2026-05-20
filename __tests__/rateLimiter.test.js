// Must be set before app loads so rateLimiter.js computes isDev=false (production limits)
const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';

jest.mock("../src/configs/database", () => jest.fn().mockResolvedValue(true));
jest.mock("../src/configs/passport-config", () => {});

const request = require("supertest");
const app = require("../src/configs/app");

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("Rate limiting on auth endpoints", () => {
  it("blocks buyer OTP after 5 attempts (429)", async () => {
    const payload = { otp: "0000", email: "test@example.com" };
    let lastRes;
    for (let i = 0; i < 6; i++) {
      lastRes = await request(app).post("/api/v1/auth/buyer/confirm-otp").send(payload);
    }
    expect(lastRes.status).toBe(429);
    expect(lastRes.body.success).toBe(false);
  });

  it("blocks seller sign-in after 10 attempts (429)", async () => {
    const payload = { email: "seller@example.com", password: "wrong" };
    let lastRes;
    for (let i = 0; i < 11; i++) {
      lastRes = await request(app).post("/api/v1/auth/seller/sign-in").send(payload);
    }
    expect(lastRes.status).toBe(429);
    expect(lastRes.body.success).toBe(false);
  });

  it("blocks admin login after 5 attempts (429)", async () => {
    const payload = { email: "admin@example.com", password: "wrong" };
    let lastRes;
    for (let i = 0; i < 6; i++) {
      lastRes = await request(app).post("/api/v1/auth/admin/login").send(payload);
    }
    expect(lastRes.status).toBe(429);
    expect(lastRes.body.success).toBe(false);
  });
});
