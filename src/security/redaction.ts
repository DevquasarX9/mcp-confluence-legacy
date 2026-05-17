const SECRET_KEY_PATTERN = /(token|password|secret|cookie|authorization|auth_header_value)/i;

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (accumulator, [key, entry]) => {
        accumulator[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSecrets(entry);
        return accumulator;
      },
      {},
    );
  }

  return value;
}
