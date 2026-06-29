import { Test, TestingModule } from "@nestjs/testing";
import { RateLimitMiddleware } from "./rate-limit.middleware";

jest.mock("redis", () => ({ createClient: jest.fn() }));

// Imported after the mock so the module factory replaces it
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require("redis") as { createClient: jest.Mock };

describe("RateLimitMiddleware", () => {
  let middleware: RateLimitMiddleware;
  let redis: any;

  beforeEach(async () => {
    redis = {
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      setEx: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    createClient.mockReturnValue(redis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitMiddleware],
    }).compile();
    middleware = module.get<RateLimitMiddleware>(RateLimitMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  const buildRes = () => {
    let status = 200;
    let body: any;
    return {
      setHeader: jest.fn(),
      status: jest.fn((code: number) => {
        status = code;
        return { json: (payload: any) => (body = payload) } as any;
      }),
      statusCode: () => status,
      body: () => body,
    };
  };

  const buildReq = (overrides: any = {}) => ({
    method: "GET",
    ip: "1.2.3.4",
    connection: { remoteAddress: "1.2.3.4" },
    headers: {},
    ...overrides,
  });

  describe("use", () => {
    it("starts a new window when no cache entry exists", async () => {
      redis.get.mockResolvedValue(null);
      const res: any = buildRes();
      const next = jest.fn();

      await middleware.use(buildReq(), res, next);

      expect(next).toHaveBeenCalled();
      const stored = JSON.parse(redis.setEx.mock.calls[0][2]);
      expect(stored.count).toBe(1);
      expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 100);
    });

    it("starts a new window when cache entry is the empty object", async () => {
      redis.get.mockResolvedValue("{}");
      await middleware.use(buildReq(), buildRes() as any, jest.fn());
      expect(JSON.parse(redis.setEx.mock.calls[0][2]).count).toBe(1);
    });

    it("increments the counter within an active window", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ count: 5, resetTime: Date.now() + 50000 }),
      );
      await middleware.use(buildReq(), buildRes() as any, jest.fn());
      expect(JSON.parse(redis.setEx.mock.calls[0][2]).count).toBe(6);
    });

    it("resets the window when the previous one expired", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ count: 50, resetTime: Date.now() - 50000 }),
      );
      await middleware.use(buildReq(), buildRes() as any, jest.fn());
      expect(JSON.parse(redis.setEx.mock.calls[0][2]).count).toBe(1);
    });

    it("responds 429 when the limit is exceeded", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ count: 101, resetTime: Date.now() + 50000 }),
      );
      const res: any = buildRes();
      const next = jest.fn();

      await middleware.use(buildReq(), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode()).toBe(429);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Retry-After",
        expect.any(String),
      );
    });

    it("fails open (calls next) when redis throws", async () => {
      redis.get.mockRejectedValue(new Error("redis down"));
      const next = jest.fn();
      await middleware.use(buildReq(), buildRes() as any, next);
      expect(next).toHaveBeenCalled();
    });

    it("keys by user id when authenticated", async () => {
      redis.get.mockResolvedValue(null);
      await middleware.use(
        buildReq({ user: { id: "u1" } }),
        buildRes() as any,
        jest.fn(),
      );
      expect(redis.get).toHaveBeenCalledWith("ratelimit:user:u1");
    });
  });

  describe("isRateLimited", () => {
    it("returns false when there is no entry", async () => {
      redis.get.mockResolvedValue(null);
      await expect(middleware.isRateLimited("k")).resolves.toBe(false);
    });

    it("clears and returns false when the window expired", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ count: 100, resetTime: Date.now() - 1000 }),
      );
      await expect(middleware.isRateLimited("k")).resolves.toBe(false);
      expect(redis.del).toHaveBeenCalled();
    });

    it("returns true when count reached the limit", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ count: 100, resetTime: Date.now() + 50000 }),
      );
      await expect(middleware.isRateLimited("k")).resolves.toBe(true);
    });

    it("returns false on redis error", async () => {
      redis.get.mockRejectedValue(new Error("boom"));
      await expect(middleware.isRateLimited("k")).resolves.toBe(false);
    });
  });

  describe("getRateLimitInfo", () => {
    it("returns null when there is no entry", async () => {
      redis.get.mockResolvedValue(null);
      await expect(middleware.getRateLimitInfo("k")).resolves.toBeNull();
    });

    it("clears and returns null when the window expired", async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ count: 5, resetTime: Date.now() - 1000 }),
      );
      await expect(middleware.getRateLimitInfo("k")).resolves.toBeNull();
      expect(redis.del).toHaveBeenCalled();
    });

    it("returns count/remaining/resetTime for an active window", async () => {
      const resetTime = Date.now() + 50000;
      redis.get.mockResolvedValue(JSON.stringify({ count: 5, resetTime }));
      await expect(middleware.getRateLimitInfo("k")).resolves.toEqual({
        count: 5,
        remaining: 95,
        resetTime,
      });
    });

    it("returns null on redis error", async () => {
      redis.get.mockRejectedValue(new Error("boom"));
      await expect(middleware.getRateLimitInfo("k")).resolves.toBeNull();
    });
  });

  describe("onModuleDestroy", () => {
    it("quits the redis client when connected", async () => {
      redis.get.mockResolvedValue(null);
      await middleware.use(buildReq(), buildRes() as any, jest.fn()); // forces connect
      await middleware.onModuleDestroy();
      expect(redis.quit).toHaveBeenCalled();
    });

    it("is a no-op when never connected", async () => {
      await expect(middleware.onModuleDestroy()).resolves.toBeUndefined();
      expect(redis.quit).not.toHaveBeenCalled();
    });
  });
});
