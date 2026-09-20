import { auth } from "./src/auth";
import { authorizeRequest } from "./src/authorize";
import { handleCircuitRequest } from "./src/circuits";
import { getServerHost, getServerPort, validateServerConfiguration } from "./src/config";
import { addApiCorsHeaders, apiPreflightResponse, isRequestOriginAllowed } from "./src/cors";

validateServerConfiguration();

const port = getServerPort();

const server = Bun.serve({
  hostname: getServerHost(),
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      if (request.method === "OPTIONS") {
        return apiPreflightResponse(request);
      }

      const response = await auth.handler(request);
      return addApiCorsHeaders(response, request);
    }

    if (url.pathname === "/api/circuits" || url.pathname.startsWith("/api/circuits/")) {
      if (request.method === "OPTIONS") {
        return apiPreflightResponse(request);
      }

      if (!isRequestOriginAllowed(request)) {
        return Response.json({ error: "Origin is not allowed" }, { status: 403 });
      }

      const response = await handleCircuitRequest(request, url);
      return addApiCorsHeaders(response, request);
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
