import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  LoggerService,
} from "@nestjs/common";
import { Response } from "express";
import { AppLogger } from "../logger/logger.service";

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    requestId?: string;
    details?: unknown;
  };
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext("GlobalExceptionFilter");
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Surface the real failure detail. HttpException.getResponse() carries
    // the specifics: ValidationPipe returns { message: string[] }, a manual
    // `throw new BadRequestException("x")` returns { message: "x" }. Using
    // exception.message here instead loses all of that and every validation
    // error shows up as an opaque "Bad Request Exception".
    let message = "Internal server error";
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (res && typeof res === "object" && "message" in res) {
        const detail = (res as { message: unknown }).message;
        message = Array.isArray(detail)
          ? detail.join("; ")
          : typeof detail === "string"
            ? detail
            : exception.message;
      } else if (typeof res === "string") {
        message = res;
      } else {
        message = exception.message;
      }
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: this.getErrorCode(exception),
        message,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    // Add request ID if available
    const requestId = request.headers["x-request-id"] as string;
    if (requestId) {
      errorResponse.error.requestId = requestId;
    }

    // Add details for development
    if (process.env.NODE_ENV !== "production" && exception instanceof Error) {
      errorResponse.error.details = {
        stack: exception.stack,
      };
    }

    // Log the error with context
    this.logger.error(
      `${request.method} ${request.url} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      {
        requestId,
        statusCode: status,
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      },
    );

    response.status(status).json(errorResponse);
  }

  private getErrorCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      switch (status) {
        case 400:
          return "BAD_REQUEST";
        case 401:
          return "UNAUTHORIZED";
        case 403:
          return "FORBIDDEN";
        case 404:
          return "NOT_FOUND";
        case 409:
          return "CONFLICT";
        case 422:
          return "UNPROCESSABLE_ENTITY";
        case 429:
          return "TOO_MANY_REQUESTS";
        case 500:
          return "INTERNAL_SERVER_ERROR";
        case 503:
          return "SERVICE_UNAVAILABLE";
        default:
          return "HTTP_ERROR";
      }
    }

    return "INTERNAL_ERROR";
  }
}
