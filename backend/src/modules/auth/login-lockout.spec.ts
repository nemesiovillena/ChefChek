import { HttpException, HttpStatus } from "@nestjs/common";
import { LoginLockout } from "./login-lockout";

describe("LoginLockout", () => {
  const MIN = 60_000;
  let now: number;
  let lockout: LoginLockout;
  const key = LoginLockout.key("warynessy", "Cocina@Rest.com ");

  beforeEach(() => {
    now = 1_000_000;
    lockout = new LoginLockout(5, 15 * MIN, 10_000, () => now);
  });

  const expectLocked = () => {
    try {
      lockout.assertNotLocked(key);
      throw new Error("no se bloqueó");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  };

  it("normalizes the key (case and spaces)", () => {
    expect(key).toBe("warynessy:cocina@rest.com");
  });

  it("locks after 5 consecutive failures and unlocks after 15 min", () => {
    for (let i = 0; i < 4; i++) {
      lockout.registerFailure(key);
    }
    expect(() => lockout.assertNotLocked(key)).not.toThrow();
    lockout.registerFailure(key);
    expectLocked();

    now += 15 * MIN - 1;
    expectLocked();
    now += 1;
    expect(() => lockout.assertNotLocked(key)).not.toThrow();
  });

  it("a successful login resets the counter", () => {
    for (let i = 0; i < 4; i++) {
      lockout.registerFailure(key);
    }
    lockout.reset(key);
    for (let i = 0; i < 4; i++) {
      lockout.registerFailure(key);
    }
    expect(() => lockout.assertNotLocked(key)).not.toThrow();
  });

  it("failures far apart in time do not add up", () => {
    for (let i = 0; i < 4; i++) {
      lockout.registerFailure(key);
    }
    now += 16 * MIN;
    lockout.registerFailure(key);
    expect(() => lockout.assertNotLocked(key)).not.toThrow();
  });

  it("does not affect other accounts", () => {
    for (let i = 0; i < 5; i++) {
      lockout.registerFailure(key);
    }
    expect(() =>
      lockout.assertNotLocked(LoginLockout.key("warynessy", "otro@rest.com")),
    ).not.toThrow();
  });
});
