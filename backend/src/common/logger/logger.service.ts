import { Injectable, LoggerService, Scope } from "@nestjs/common";
import { Logger } from "@nestjs/common";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export interface LogContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.DEFAULT })
export class AppLogger implements LoggerService {
  private context: string = "App";
  private requestId?: string;

  setContext(context: string) {
    this.context = context;
  }

  setRequestId(requestId: string) {
    this.requestId = requestId;
  }

  private formatMessage(message: string, context?: LogContext): string {
    const parts = [message];

    if (this.requestId) {
      parts.unshift(`[${this.requestId}]`);
    }

    if (context) {
      const contextParts = [];
      if (context.userId) {
        contextParts.push(`userId=${context.userId}`);
      }
      if (context.tenantId) {
        contextParts.push(`tenantId=${context.tenantId}`);
      }

      Object.entries(context).forEach(([key, value]) => {
        if (!["userId", "tenantId"].includes(key)) {
          contextParts.push(`${key}=${JSON.stringify(value)}`);
        }
      });

      if (contextParts.length > 0) {
        parts.push(`[${contextParts.join(", ")}]`);
      }
    }

    return `[${this.context}] ${parts.join(" ")}`;
  }

  log(message: string, context?: LogContext) {
    this.info(message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    console.error(
      this.formatMessage(message, context),
      trace ? `\n${trace}` : "",
    );
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage(message, context));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatMessage(message, context));
    }
  }

  verbose(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      console.log(this.formatMessage(message, context));
    }
  }

  info(message: string, context?: LogContext) {
    console.log(this.formatMessage(message, context));
  }
}
