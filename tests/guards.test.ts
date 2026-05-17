import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/schema.js";
import { ensureSpaceAllowed, ensureWriteAllowed, scopeCql } from "../src/security/guards.js";

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    baseUrl: "https://confluence.example.com/confluence",
    authMode: "basic",
    username: "alice",
    password: "secret",
    strictSsl: true,
    timeoutMs: 30_000,
    maxResults: 50,
    maxResponseBytes: 1_048_576,
    maxAttachmentBytes: 10_485_760,
    enableWriteTools: false,
    readOnly: true,
    dryRun: false,
    allowedSpaces: [],
    deniedSpaces: [],
    logLevel: "error",
    auditLog: false,
    ...overrides,
  };
}

describe("guards", () => {
  it("scopes CQL with allowed and denied spaces", () => {
    const config = makeConfig({
      allowedSpaces: ["DEV", "OPS"],
      deniedSpaces: ["SECRET"],
    });

    expect(scopeCql(config, "type = page")).toBe(
      'space in ("DEV", "OPS") AND space not in ("SECRET") AND (type = page)',
    );
  });

  it("rejects a denied space", () => {
    const config = makeConfig({
      deniedSpaces: ["SECRET"],
    });

    expect(() => ensureSpaceAllowed(config, "SECRET")).toThrow("not allowed");
  });

  it("blocks writes by default", () => {
    expect(() => ensureWriteAllowed(makeConfig(), "confluence_create_page")).toThrow(
      "CONFLUENCE_READ_ONLY=true",
    );
  });
});
