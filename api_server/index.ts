import { auth } from "./src/auth";
import { authorizeRequest } from "./src/authorize";
import { getServerPort, validateServerConfiguration } from "./src/config";
import { addAuthCorsHeaders, authPreflightResponse } from "./src/cors";

validateServerConfiguration();

const port = getServerPort();

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      if (request.method === "OPTIONS") {
        return authPreflightResponse(request);
      }

      const response = await auth.handler(request);
      return addAuthCorsHeaders(response, request);
    }

    if (url.pathname === "/internal/authorize" && request.method === "GET") {
      return authorizeRequest(request);
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
  error(error) {
    console.error("Unhandled API server error", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  },
});

console.log(`Holotrace auth API listening on ${server.url}`);
