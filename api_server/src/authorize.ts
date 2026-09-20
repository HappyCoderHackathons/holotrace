import { timingSafeEqual } from "node:crypto";

import { auth } from "./auth";

function hasValidInternalToken(request: Request): boolean {
  const expected = process.env.INTERNAL_AUTH_TOKEN;

  if (!expected) {
    return true;
  }

  const received = request.headers.get("x-internal-auth-token") ?? "";
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);

  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export async function authorizeRequest(request: Request): Promise<Response> {
  if (!hasValidInternalToken(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "X-Holotrace-Auth-Subject": session.user.id,
      "X-Holotrace-User-Id": session.user.id,
    },
  });
}
