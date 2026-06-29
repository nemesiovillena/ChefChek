import { Test, TestingModule } from "@nestjs/testing";
import { RequestIdMiddleware } from "./request-id.middleware";
import { AppLogger } from "../logger/logger.service";

describe("RequestIdMiddleware", () => {
  let middleware: RequestIdMiddleware;
  let logger: { setContext: jest.Mock; info: jest.Mock };

  beforeEach(async () => {
    logger = { setContext: jest.fn(), info: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestIdMiddleware,
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();
    middleware = module.get<RequestIdMiddleware>(RequestIdMiddleware);
  });

  afterEach(() => jest.clearAllMocks());

  const buildRes = () => {
    const listeners: Record<string, () => void> = {};
    return {
      statusCode: 200,
      setHeader: jest.fn(),
      on: jest.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
      trigger: (event: string) => listeners[event]?.(),
    };
  };

  it("uses the incoming x-request-id header when present", () => {
    const req: any = {
      method: "GET",
      url: "/x",
      ip: "1.1.1.1",
      headers: { "x-request-id": "req-123" },
    };
    const res: any = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect((req as any).requestId).toBe("req-123");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "req-123");
    expect(next).toHaveBeenCalled();
  });

  it("generates a UUID when no x-request-id header is present", () => {
    const req: any = { method: "GET", url: "/x", headers: {} };
    const res: any = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    const requestId = (req as any).requestId as string;
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", requestId);
  });

  it("logs the request on response finish", () => {
    const req: any = {
      method: "POST",
      url: "/y",
      ip: "2.2.2.2",
      headers: { "user-agent": "jest" },
    };
    const res: any = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);
    res.trigger("finish");

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("POST /y - 200"),
      expect.objectContaining({
        requestId: expect.any(String),
        statusCode: 200,
      }),
    );
  });
});
