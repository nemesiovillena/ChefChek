import { Injectable, NestMiddleware, OnModuleDestroy } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { createClient, RedisClientType } from "redis";

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware, OnModuleDestroy {
  private redis: RedisClientType | null = null;
  private readonly WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MAX_REQUESTS = 100;
  private readonly REDIS_PREFIX = "ratelimit:";

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private async getRedisClient(): Promise<RedisClientType> {
    if (!this.redis) {
      this.redis = createClient({
        url:
          process.env.REDIS_URL ||
          `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`,
        database: parseInt(process.env.REDIS_DB || "1"), // Use DB 1 for rate limiting (separate from Bull DB 0)
      });

      this.redis.on("error", (err) =>
        console.error("Redis Client Error:", err),
      );
      await this.redis.connect();
    }
    return this.redis;
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.getClientKey(req);
    const redisKey = `${this.REDIS_PREFIX}${key}`;
    const now = Date.now();

    try {
      const redis = await this.getRedisClient();

      // Try to get existing rate limit info from Redis
      const cached = await redis.get(redisKey);
      let limitInfo: RateLimitInfo;

      if (!cached) {
        // Create new window
        limitInfo = {
          count: 1,
          resetTime: now + this.WINDOW_MS,
        };
      } else {
        const parsed: RateLimitInfo = JSON.parse(cached);

        // Check if window expired
        if (now > parsed.resetTime) {
          limitInfo = {
            count: 1,
            resetTime: now + this.WINDOW_MS,
          };
        } else {
          // Increment counter
          limitInfo = {
            count: parsed.count + 1,
            resetTime: parsed.resetTime,
          };
        }
      }

      // Store in Redis with expiration matching the window
      const ttlSeconds = Math.ceil((limitInfo.resetTime - now) / 1000);
      await redis.setEx(redisKey, ttlSeconds, JSON.stringify(limitInfo));

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", this.MAX_REQUESTS);
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, this.MAX_REQUESTS - limitInfo.count),
      );
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(limitInfo.resetTime).toISOString(),
      );

      // Check if limit exceeded
      if (limitInfo.count > this.MAX_REQUESTS) {
        const retryAfter = Math.ceil((limitInfo.resetTime - now) / 1000);
        res.setHeader("Retry-After", retryAfter.toString());

        return res.status(429).json({
          success: false,
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        });
      }

      next();
    } catch (error) {
      // If Redis fails, fallback to allowing request (fail-open)
      console.error("Rate limit error:", error);
      next();
    }
  }

  private getClientKey(req: Request): string {
    // Use combination of IP and user ID if available
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  // Utility method to check if a client is rate limited
  async isRateLimited(key: string): Promise<boolean> {
    try {
      const redis = await this.getRedisClient();
      const redisKey = `${this.REDIS_PREFIX}${key}`;
      const cached = await redis.get(redisKey);

      if (!cached) {
        return false;
      }

      const parsed: RateLimitInfo = JSON.parse(cached);
      const now = Date.now();

      if (now > parsed.resetTime) {
        await redis.del(redisKey);
        return false;
      }

      return parsed.count >= this.MAX_REQUESTS;
    } catch (error) {
      console.error("Rate limit check error:", error);
      return false;
    }
  }

  // Get current rate limit info for a client
  async getRateLimitInfo(
    key: string,
  ): Promise<{ count: number; remaining: number; resetTime: number } | null> {
    try {
      const redis = await this.getRedisClient();
      const redisKey = `${this.REDIS_PREFIX}${key}`;
      const cached = await redis.get(redisKey);

      if (!cached) {
        return null;
      }

      const parsed: RateLimitInfo = JSON.parse(cached);
      const now = Date.now();

      if (now > parsed.resetTime) {
        await redis.del(redisKey);
        return null;
      }

      return {
        count: parsed.count,
        remaining: Math.max(0, this.MAX_REQUESTS - parsed.count),
        resetTime: parsed.resetTime,
      };
    } catch (error) {
      console.error("Rate limit info error:", error);
      return null;
    }
  }
}
