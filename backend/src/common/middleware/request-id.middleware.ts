import { Injectable, NestMiddleware, LoggerService } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { AppLogger } from "../logger/logger.service";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext("RequestIdMiddleware");
  }

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    req["requestId"] = requestId;
    res.setHeader("x-request-id", requestId);

    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;

      this.logger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
        requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      });
    });

    next();
  }
}
