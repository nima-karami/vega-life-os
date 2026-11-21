/** Pull the token from an `Authorization: Bearer <token>` header, or null when absent or malformed. */
export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function readCorsOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS ??
    "https://vega-life-os.web.app,https://vega-life-os.firebaseapp.com,http://localhost:5180"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
