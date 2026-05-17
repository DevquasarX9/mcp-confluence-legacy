import { redactSecrets } from "../security/redaction.js";
import type { JsonRecord } from "./result.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  public constructor(private readonly level: LogLevel) {}

  public debug(message: string, context?: JsonRecord): void {
    this.log("debug", message, context);
  }

  public info(message: string, context?: JsonRecord): void {
    this.log("info", message, context);
  }

  public warn(message: string, context?: JsonRecord): void {
    this.log("warn", message, context);
  }

  public error(message: string, context?: JsonRecord): void {
    this.log("error", message, context);
  }

  private log(level: LogLevel, message: string, context?: JsonRecord): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(context === undefined ? {} : { context: redactSecrets(context) }),
    };

    process.stderr.write(`${JSON.stringify(payload)}\n`);
  }
}
