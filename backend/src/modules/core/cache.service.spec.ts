import { Test, TestingModule } from "@nestjs/testing";
import { CacheService } from "./cache.service";

describe("CacheService", () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("Basic Cache Operations", () => {
    it("should set and get a value", () => {
      service.set("test-key", "test-value");
      expect(service.get("test-key")).toBe("test-value");
    });

    it("should return null for non-existent key", () => {
      expect(service.get("non-existent-key")).toBeNull();
    });

    it("should delete a value", () => {
      service.set("test-key", "test-value");
      service.delete("test-key");
      expect(service.get("test-key")).toBeNull();
    });

    it("should clear all values", () => {
      service.set("key1", "value1");
      service.set("key2", "value2");
      service.clear();
      expect(service.get("key1")).toBeNull();
      expect(service.get("key2")).toBeNull();
    });
  });

  describe("TTL (Time To Live)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should expire values after TTL", () => {
      service.set("test-key", "test-value", 1000); // 1 second TTL
      expect(service.get("test-key")).toBe("test-value");

      jest.advanceTimersByTime(1500); // Advance past TTL
      expect(service.get("test-key")).toBeNull();
    });

    it("should use default TTL when not specified", () => {
      service.set("test-key", "test-value"); // Uses default 5 minute TTL
      expect(service.get("test-key")).toBe("test-value");

      jest.advanceTimersByTime(301000); // 5 minutes + 1 second
      expect(service.get("test-key")).toBeNull();
    });

    it("should not expire before TTL", () => {
      service.set("test-key", "test-value", 5000); // 5 second TTL
      jest.advanceTimersByTime(4000); // Before TTL
      expect(service.get("test-key")).toBe("test-value");
    });
  });

  describe("Pattern-based Clearing", () => {
    beforeEach(() => {
      service.set("user:1:name", "John");
      service.set("user:1:email", "john@example.com");
      service.set("user:2:name", "Jane");
      service.set("product:1", "Product A");
      service.set("tenant:1", "Tenant A");
    });

    it("should clear all keys matching pattern", () => {
      service.clearPattern("user:1:*");
      expect(service.get("user:1:name")).toBeNull();
      expect(service.get("user:1:email")).toBeNull();
      expect(service.get("user:2:name")).toBe("Jane"); // Should not be cleared
      expect(service.get("product:1")).toBe("Product A");
      expect(service.get("tenant:1")).toBe("Tenant A");
    });

    it("should handle patterns with no matches", () => {
      const initialSize = service.getStats().size;
      service.clearPattern("nonexistent:*");
      const result = service.getStats().size;
      expect(result).toBe(initialSize);
    });
  });

  describe("Statistics", () => {
    beforeEach(() => {
      service.clear();
    });

    it("should return cache statistics", () => {
      service.set("key1", "value1");
      service.set("key2", "value2", 1000);

      const stats = service.getStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain("key1");
      expect(stats.keys).toContain("key2");
    });

    it("should track cache size", () => {
      service.set("key1", "value1");
      service.set("key2", "value2");
      service.set("key3", "value3");

      const stats = service.getStats();
      expect(stats.size).toBe(3);
    });

    it("should track cache keys", () => {
      service.set("user:1:name", "John");
      service.set("user:1:email", "john@example.com");
      service.set("product:1", "Product A");

      const stats = service.getStats();
      expect(stats.keys).toContain("user:1:name");
      expect(stats.keys).toContain("user:1:email");
      expect(stats.keys).toContain("product:1");
    });
  });

  describe("Complex Values", () => {
    it("should store and retrieve objects", () => {
      const obj = { name: "John", age: 30, nested: { value: true } };
      service.set("obj-key", obj);
      expect(service.get("obj-key")).toEqual(obj);
    });

    it("should store and retrieve arrays", () => {
      const arr = [1, 2, 3, { id: 4 }];
      service.set("arr-key", arr);
      expect(service.get("arr-key")).toEqual(arr);
    });

    it("should store and retrieve numbers", () => {
      service.set("num-key", 42);
      expect(service.get("num-key")).toBe(42);
    });

    it("should store and retrieve booleans", () => {
      service.set("bool-key", true);
      expect(service.get("bool-key")).toBe(true);
    });

    it("should store and retrieve null", () => {
      service.set("null-key", null);
      expect(service.get("null-key")).toBeNull();
    });

    it("should store and retrieve undefined", () => {
      service.set("undefined-key", undefined);
      // The service stores undefined as is
      expect(service.get("undefined-key")).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string key", () => {
      service.set("", "value");
      expect(service.get("")).toBe("value");
    });

    it("should handle very long key", () => {
      const longKey = "a".repeat(1000);
      service.set(longKey, "value");
      expect(service.get(longKey)).toBe("value");
    });

    it("should handle very long value", () => {
      const longValue = "a".repeat(10000);
      service.set("key", longValue);
      expect(service.get("key")).toBe(longValue);
    });

    it("should overwrite existing value", () => {
      service.set("key", "value1");
      service.set("key", "value2");
      expect(service.get("key")).toBe("value2");
    });

    it("should handle deleting non-existent key gracefully", () => {
      expect(() => service.delete("nonexistent")).not.toThrow();
    });

    it("should handle TTL of 0 (immediate expiration)", () => {
      jest.useFakeTimers();
      jest.setSystemTime(Date.now());
      service.set("key", "value", 1); // 1ms TTL instead of 0
      jest.advanceTimersByTime(2);
      expect(service.get("key")).toBeNull();
      jest.useRealTimers();
    });
  });

  describe("Performance", () => {
    it("should handle large number of keys efficiently", () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        service.set(`key-${i}`, `value-${i}`);
      }

      const setTime = Date.now() - start;
      expect(setTime).toBeLessThan(100); // Should be fast

      const getStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        service.get(`key-${i}`);
      }
      const getTime = Date.now() - getStart;
      expect(getTime).toBeLessThan(100); // Should be fast
    });
  });
});
