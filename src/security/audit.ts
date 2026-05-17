import { Logger } from "../utils/logger.js";

export class AuditLogger {
  public constructor(
    private readonly enabled: boolean,
    private readonly logger: Logger,
  ) {}

  public logWrite(operation: string, target: string): void {
    if (!this.enabled) {
      return;
    }

    this.logger.info("confluence_write_operation", {
      operation,
      target,
    });
  }
}
