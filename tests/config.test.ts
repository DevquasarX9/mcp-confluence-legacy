import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("loads a basic-auth config with safe write defaults", () => {
    const config = loadConfig({
      CONFLUENCE_BASE_URL: "https://confluence.example.com/confluence/",
      CONFLUENCE_AUTH_MODE: "basic",
      CONFLUENCE_USERNAME: "alice",
      CONFLUENCE_PASSWORD: "secret",
    });

    expect(config.baseUrl).toBe("https://confluence.example.com/confluence");
    expect(config.authMode).toBe("basic");
    expect(config.readOnly).toBe(true);
    expect(config.enableWriteTools).toBe(false);
  });

  it("normalizes space policy lists", () => {
    const config = loadConfig({
      CONFLUENCE_BASE_URL: "https://confluence.example.com",
      CONFLUENCE_AUTH_MODE: "basic",
      CONFLUENCE_USERNAME: "alice",
      CONFLUENCE_PASSWORD: "secret",
      CONFLUENCE_ALLOWED_SPACES: "dev, OPS",
      CONFLUENCE_DENIED_SPACES: "secret",
    });

    expect(config.allowedSpaces).toEqual(["DEV", "OPS"]);
    expect(config.deniedSpaces).toEqual(["SECRET"]);
  });

  it("rejects bearer auth without a token", () => {
    expect(() =>
      loadConfig({
        CONFLUENCE_BASE_URL: "https://confluence.example.com",
        CONFLUENCE_AUTH_MODE: "bearer",
      }),
    ).toThrow();
  });

  it("allows no-auth mode for local proxy deployments", () => {
    const config = loadConfig({
      CONFLUENCE_BASE_URL: "http://127.0.0.1:4878",
      CONFLUENCE_AUTH_MODE: "none",
    });

    expect(config.baseUrl).toBe("http://127.0.0.1:4878");
    expect(config.authMode).toBe("none");
  });
});
