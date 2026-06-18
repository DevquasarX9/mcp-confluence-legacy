import type { HeadersInit } from "undici";
import type { AppConfig } from "../config/schema.js";
import { ConfluenceClientError } from "./errors.js";

export function buildAuthHeaders(config: AppConfig): HeadersInit {
  switch (config.authMode) {
    case "basic": {
      if (!config.username || (!config.password && !config.token)) {
        throw new ConfluenceClientError("AUTHENTICATION_FAILED", "Basic auth configuration is incomplete.");
      }

      const passwordOrToken = config.password ?? config.token;
      const encodedCredentials = Buffer.from(`${config.username}:${passwordOrToken}`).toString("base64");

      return {
        Authorization: `Basic ${encodedCredentials}`,
      };
    }
    case "bearer":
      if (!config.token) {
        throw new ConfluenceClientError("AUTHENTICATION_FAILED", "Bearer auth configuration is incomplete.");
      }

      return {
        Authorization: `Bearer ${config.token}`,
      };
    case "cookie":
      if (!config.cookie) {
        throw new ConfluenceClientError("AUTHENTICATION_FAILED", "Cookie auth configuration is incomplete.");
      }

      return {
        Cookie: config.cookie,
      };
    case "header":
      if (!config.authHeaderName || !config.authHeaderValue) {
        throw new ConfluenceClientError("AUTHENTICATION_FAILED", "Header auth configuration is incomplete.");
      }

      return {
        [config.authHeaderName]: config.authHeaderValue,
      };
    case "none":
      return {};
  }
}
