#!/usr/bin/env node
import "dotenv/config";
import { loadProxyConfig } from "./proxy/config.js";
import { createConfluenceProxyServer, startConfluenceProxyServer } from "./proxy/server.js";
import { Logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadProxyConfig();
  const logger = new Logger(config.logLevel);
  const server = createConfluenceProxyServer(config, { logger });

  const shutdown = (): void => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await startConfluenceProxyServer(server, config, logger);
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : "Unknown proxy startup error",
    })}\n`,
  );
  process.exit(1);
});
