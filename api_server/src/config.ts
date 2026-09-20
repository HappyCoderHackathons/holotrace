const DEFAULT_PORT = 8001;

export function getTrustedOrigins(): string[] {
  return (process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateServerConfiguration(): void {
  const missing = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"].filter(
    (name) => !process.env[name],
  );

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }

  const baseUrl = new URL(process.env.BETTER_AUTH_URL!);
  const isLocalDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);

  if (baseUrl.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("BETTER_AUTH_URL must use HTTPS outside local development");
  }
}

export function getServerPort(): number {
  const value = process.env.PORT;

  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}
