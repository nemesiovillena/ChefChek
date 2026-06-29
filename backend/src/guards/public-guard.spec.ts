import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PublicGuard } from "./public-guard";

describe("PublicGuard", () => {
  let guard: PublicGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicGuard, { provide: Reflector, useValue: reflector }],
    }).compile();
    guard = module.get<PublicGuard>(PublicGuard);
  });

  const buildContext = () => {
    return {} as unknown as ExecutionContext;
  };

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should return true in canActivate", () => {
    const context = buildContext();
    expect(guard.canActivate(context)).toBe(true);
  });
});
