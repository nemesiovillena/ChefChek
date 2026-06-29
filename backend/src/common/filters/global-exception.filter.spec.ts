import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { AppLogger } from "../logger/logger.service";

describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let logger: { setContext: jest.Mock; error: jest.Mock };
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    logger = { setContext: jest.fn(), error: jest.fn() };
    originalNodeEnv = process.env.NODE_ENV;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalExceptionFilter,
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();
    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  const buildHost = (requestOverrides: any = {}) => {
    const request = {
      method: "GET",
      url: "/api/v1/x",
      ip: "1.1.1.1",
      headers: { "user-agent": "jest" },
      ...requestOverrides,
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => request,
        }),
      },
      response,
      request,
    };
  };

  const catchWith = (exception: unknown, requestOverrides: any = {}) => {
    const { host, response } = buildHost(requestOverrides);
    filter.catch(exception, host as any);
    return response.json.mock.calls[0][0];
  };

  it("maps an HttpException to its status code and message", () => {
    process.env.NODE_ENV = "test";
    const body = catchWith(new NotFoundException("missing thing"));
    expect(body.success).toBe(false);
    expect(body.error.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body.error.message).toBe("missing thing");
    expect(body.error.path).toBe("/api/v1/x");
  });

  it("defaults non-HttpException errors to 500 INTERNAL_ERROR", () => {
    process.env.NODE_ENV = "test";
    const body = catchWith(new Error("boom"));
    expect(body.error.statusCode).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal server error");
  });

  it("attaches the request id when the header is present", () => {
    process.env.NODE_ENV = "test";
    const body = catchWith(new Error("x"), {
      headers: { "x-request-id": "req-1", "user-agent": "jest" },
    });
    expect(body.error.requestId).toBe("req-1");
  });

  it("omits the request id when the header is absent", () => {
    process.env.NODE_ENV = "test";
    const body = catchWith(new Error("x"));
    expect(body.error.requestId).toBeUndefined();
  });

  it("includes the stack in details outside production for Error instances", () => {
    process.env.NODE_ENV = "test";
    const body = catchWith(new Error("x"));
    expect(body.error.details).toHaveProperty("stack");
  });

  it("omits details in production or for non-Error exceptions", () => {
    process.env.NODE_ENV = "production";
    const body = catchWith("a plain string");
    expect(body.error.details).toBeUndefined();
  });

  describe("getErrorCode mapping", () => {
    const cases: Array<[number, string]> = [
      [400, "BAD_REQUEST"],
      [401, "UNAUTHORIZED"],
      [403, "FORBIDDEN"],
      [404, "NOT_FOUND"],
      [409, "CONFLICT"],
      [422, "UNPROCESSABLE_ENTITY"],
      [429, "TOO_MANY_REQUESTS"],
      [500, "INTERNAL_SERVER_ERROR"],
      [503, "SERVICE_UNAVAILABLE"],
      [418, "HTTP_ERROR"], // default branch
    ];

    cases.forEach(([status, code]) => {
      it(`maps status ${status} to ${code}`, () => {
        process.env.NODE_ENV = "test";
        const body = catchWith(new HttpException("msg", status));
        expect(body.error.code).toBe(code);
      });
    });
  });
});
