import { Reflector } from "@nestjs/core";
import { Roles } from "./roles.decorator";

describe("Roles Decorator", () => {
  describe("Roles", () => {
    it("should set roles metadata", () => {
      class TestClass {
        @Roles("ADMIN")
        testMethod() {}
      }

      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        "roles",
        TestClass.prototype.testMethod,
      );
      expect(roles).toEqual(["ADMIN"]);
    });

    it("should set multiple roles", () => {
      class TestClass {
        @Roles("ADMIN", "USER")
        testMethod() {}
      }

      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        "roles",
        TestClass.prototype.testMethod,
      );
      expect(roles).toEqual(["ADMIN", "USER"]);
    });

    it("should support role as array", () => {
      class TestClass {
        @Roles("ADMIN", "VIEWER")
        testMethod() {}
      }

      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        "roles",
        TestClass.prototype.testMethod,
      );
      expect(roles).toEqual(["ADMIN", "VIEWER"]);
    });
  });
});
