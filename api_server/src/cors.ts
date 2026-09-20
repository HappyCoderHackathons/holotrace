import { getTrustedOrigins } from "./config";

const ALLOWED_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Authorization, Content-Type";

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (!origin || !getTrustedOrigins().includes(origin)) {
    return null;
  }

  return origin;
}

export function isRequestOriginAllowed(request: Request): boolean {
  return !request.headers.has("origin") || allowedOrigin(request) !== null;
}

export function apiPreflightResponse(request: Request): Response {
  const origin = allowedOrigin(request);

  if (!origin) {
    return Response.json({ error: "Origin is not allowed" }, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

export function addApiCorsHeaders(response: Response, request: Request): Response {
  const origin = allowedOrigin(request);

  if (!origin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.append("Vary", "Origin");
  return response;
}
