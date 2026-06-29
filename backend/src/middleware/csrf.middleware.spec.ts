import { CsrfMiddleware } from "./csrf.middleware";

describe("CsrfMiddleware", () => {
  let middleware: CsrfMiddleware;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
  });

  afterEach(() => jest.restoreAllMocks());

  const buildRes = () => {
    const headers: Record<string, string> = {};
    let status = 200;
    let body: any;
    return {
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
      getHeader: (k: string) => headers[k],
      status: jest.fn((code: number) => {
        status = code;
        return { json: (payload: any) => (body = payload) } as any;
      }),
      statusCode: () => status,
      body: () => body,
    };
  };

  /** Run a GET to mint a session+csrf token pair, returning both. */
  const mintTokens = (sessionHeader?: string) => {
    const req: any = {
      method: "GET",
      headers: sessionHeader ? { "x-session-token": sessionHeader } : {},
    };
    const res: any = buildRes();
    middleware.use(req, res, jest.fn());
    const calls = (res.setHeader as jest.Mock).mock.calls;
    const session =
      calls.find((c) => c[0] === "X-Session-Token")?.[1] || sessionHeader;
    const csrf = calls.find((c) => c[0] === "X-CSRF-Token")?.[1];
    return { session, csrf };
  };

  describe("safe methods (GET/HEAD/OPTIONS)", () => {
    it("generates a new session + csrf token when none is present", () => {
      const req: any = { method: "GET", headers: {} };
      const res: any = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.getHeader("X-Session-Token")).toBeTruthy();
      expect(res.getHeader("X-CSRF-Token")).toBeTruthy();
    });

    it("reuses the existing csrf token when the session is known and fresh", () => {
      const { session, csrf } = mintTokens();
      const res: any = buildRes();
      middleware.use(
        { method: "GET", headers: { "x-session-token": session } } as any,
        res,
        jest.fn(),
      );
      expect(res.getHeader("X-CSRF-Token")).toBe(csrf);
    });

    it("generates a new csrf token for an unknown session", () => {
      const res: any = buildRes();
      middleware.use(
        {
          method: "GET",
          headers: { "x-session-token": "unknown-session" },
        } as any,
        res,
        jest.fn(),
      );
      expect(res.getHeader("X-CSRF-Token")).toBeTruthy();
    });
  });

  describe("state-changing methods", () => {
    it("rejects with 403 when csrf/session tokens are missing", () => {
      const req: any = { method: "POST", headers: {} };
      const res: any = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode()).toBe(403);
      expect(res.body().message).toMatch(/required/i);
    });

    it("rejects with 403 when the csrf token is invalid", () => {
      const { session } = mintTokens();
      const req: any = {
        method: "POST",
        headers: { "x-session-token": session, "x-csrf-token": "wrong" },
      };
      const res: any = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode()).toBe(403);
      expect(res.body().message).toMatch(/invalid/i);
    });

    it("allows the request through when the csrf token is valid", () => {
      const { session, csrf } = mintTokens();
      const req: any = {
        method: "POST",
        headers: { "x-session-token": session, "x-csrf-token": csrf },
      };
      const res: any = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("token expiry", () => {
    it("rejects a previously-valid token after it expires", () => {
      const { session, csrf } = mintTokens();
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);

      const req: any = {
        method: "POST",
        headers: { "x-session-token": session, "x-csrf-token": csrf },
      };
      const res: any = buildRes();
      middleware.use(req, res, jest.fn());

      expect(res.statusCode()).toBe(403);
    });

    it("issues a fresh csrf token for an expired session on a safe method", () => {
      const { session } = mintTokens();
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);

      const res: any = buildRes();
      middleware.use(
        { method: "GET", headers: { "x-session-token": session } } as any,
        res,
        jest.fn(),
      );
      expect(res.getHeader("X-CSRF-Token")).toBeTruthy();
    });

    it("cleanup removes expired tokens", () => {
      mintTokens();
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60 * 1000);
      expect(() => middleware.cleanup()).not.toThrow();
    });
  });
});
