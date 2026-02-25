import { expect } from "chai";
import { authMiddleware } from "../shared/auth";

function mockReq(headers: Record<string, string> = {}): any {
  return { headers };
}

function mockRes(): any {
  const res: any = { statusCode: 0, body: null };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
}

describe("authMiddleware", () => {
  const origSecret = process.env.API_SECRET;
  afterEach(() => {
    if (origSecret !== undefined) {
      process.env.API_SECRET = origSecret;
    } else {
      delete process.env.API_SECRET;
    }
  });

  it("passes through when API_SECRET is not set (dev mode)", (done) => {
    delete process.env.API_SECRET;
    const req = mockReq();
    const res = mockRes();
    authMiddleware(req, res, () => { done(); });
  });

  it("passes through with valid Bearer token", (done) => {
    process.env.API_SECRET = "test-secret-123";
    const req = mockReq({ authorization: "Bearer test-secret-123" });
    const res = mockRes();
    authMiddleware(req, res, () => { done(); });
  });

  it("rejects missing Authorization header", () => {
    process.env.API_SECRET = "test-secret-123";
    const req = mockReq({});
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).to.be.false;
    expect(res.statusCode).to.equal(401);
    expect(res.body.error).to.include("missing Bearer token");
  });

  it("rejects non-Bearer Authorization header", () => {
    process.env.API_SECRET = "test-secret-123";
    const req = mockReq({ authorization: "Basic dXNlcjpwYXNz" });
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).to.be.false;
    expect(res.statusCode).to.equal(401);
  });

  it("rejects invalid Bearer token", () => {
    process.env.API_SECRET = "test-secret-123";
    const req = mockReq({ authorization: "Bearer wrong-token" });
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).to.be.false;
    expect(res.statusCode).to.equal(401);
    expect(res.body.error).to.include("invalid token");
  });

  it("rejects empty Bearer token", () => {
    process.env.API_SECRET = "test-secret-123";
    const req = mockReq({ authorization: "Bearer " });
    const res = mockRes();
    let nextCalled = false;
    authMiddleware(req, res, () => { nextCalled = true; });
    expect(nextCalled).to.be.false;
    expect(res.statusCode).to.equal(401);
  });
});
