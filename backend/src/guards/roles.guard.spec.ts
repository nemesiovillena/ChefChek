import { Test, TestingModule } from "@nestjs/testing";
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { UsersService } from "../modules/users/users.service";

describe("RolesGuard (guards)", () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let usersService: { validateUserPermissions: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    usersService = { validateUserPermissions: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    guard = module.get<RolesGuard>(RolesGuard);
  });

  const buildContext = (user: any) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it("allows access when no roles are required", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "ADMIN" })),
    ).resolves.toBe(true);
    expect(usersService.validateUserPermissions).not.toHaveBeenCalled();
  });

  it("allows access when the user has required permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN", "USER"]);
    usersService.validateUserPermissions.mockResolvedValue(true);

    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "USER" })),
    ).resolves.toBe(true);
    expect(usersService.validateUserPermissions).toHaveBeenCalledWith("u1", [
      "ADMIN",
      "USER",
    ]);
  });

  it("denies access by throwing ForbiddenException when user lacks permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);
    usersService.validateUserPermissions.mockResolvedValue(false);

    await expect(
      guard.canActivate(buildContext({ id: "u1", role: "VIEWER" })),
    ).rejects.toThrow(ForbiddenException);
  });

  it("denies access by throwing UnauthorizedException when there is no user", async () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"]);

    await expect(guard.canActivate(buildContext(null))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
