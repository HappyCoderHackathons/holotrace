import { and, desc, eq } from "drizzle-orm";

import { auth } from "./auth";
import { db } from "./db";
import { projects } from "./db/schema";

const MAX_CIRCUIT_BYTES = 12 * 1024 * 1024;

interface CircuitBody {
  name?: unknown;
  data?: unknown;
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function serializeProject(project: typeof projects.$inferSelect) {
  return {
    id: project.id,
    name: project.name,
    data: JSON.parse(project.data) as unknown,
    createdAt: project.createdAt.toISOString(),
    modifiedAt: project.modifiedAt.toISOString(),
    lastOpenedAt: project.lastOpenedAt.toISOString(),
  };
}

function serializeProjectSummary(
  project: Pick<
    typeof projects.$inferSelect,
    "id" | "name" | "createdAt" | "modifiedAt" | "lastOpenedAt"
  >,
) {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    modifiedAt: project.modifiedAt.toISOString(),
    lastOpenedAt: project.lastOpenedAt.toISOString(),
  };
}

async function parseCircuitBody(request: Request): Promise<
  | { name: string; data: string }
  | Response
> {
  let body: CircuitBody;

  try {
    body = (await request.json()) as CircuitBody;
  } catch {
    return jsonError("Request body must be valid JSON", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 120) {
    return jsonError("Circuit name must contain between 1 and 120 characters", 400);
  }

  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return jsonError("Circuit data must be a JSON object", 400);
  }

  const data = JSON.stringify(body.data);

  if (Buffer.byteLength(data, "utf8") > MAX_CIRCUIT_BYTES) {
    return jsonError("Circuit data exceeds the 12 MB limit", 413);
  }

  return { name, data };
}

function parseProjectId(url: URL): number | null {
  const match = /^\/api\/circuits\/(\d+)$/.exec(url.pathname);
  if (!match?.[1]) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseProjectOpenId(url: URL): number | null {
  const match = /^\/api\/circuits\/(\d+)\/open$/.exec(url.pathname);
  if (!match?.[1]) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function handleCircuitRequest(request: Request, url: URL): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const owner = session.user.id;
  const projectId = parseProjectId(url);
  const projectOpenId = parseProjectOpenId(url);

  if (url.pathname === "/api/circuits" && request.method === "GET") {
    const savedProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        createdAt: projects.createdAt,
        modifiedAt: projects.modifiedAt,
        lastOpenedAt: projects.lastOpenedAt,
      })
      .from(projects)
      .where(eq(projects.owner, owner))
      .orderBy(desc(projects.lastOpenedAt), desc(projects.modifiedAt));

    return Response.json({ circuits: savedProjects.map(serializeProjectSummary) });
  }

  if (url.pathname === "/api/circuits" && request.method === "POST") {
    const body = await parseCircuitBody(request);
    if (body instanceof Response) return body;

    const [created] = await db
      .insert(projects)
      .values({ owner, ...body })
      .returning();

    if (!created) return jsonError("Unable to save circuit", 500);
    return Response.json({ circuit: serializeProject(created) }, { status: 201 });
  }

  if (projectOpenId && request.method === "POST") {
    const [savedProject] = await db
      .update(projects)
      .set({ lastOpenedAt: new Date() })
      .where(and(eq(projects.id, projectOpenId), eq(projects.owner, owner)))
      .returning();

    if (!savedProject) return jsonError("Circuit not found", 404);
    return Response.json({ circuit: serializeProject(savedProject) });
  }

  if (projectId && request.method === "GET") {
    const [savedProject] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.owner, owner)))
      .limit(1);

    if (!savedProject) return jsonError("Circuit not found", 404);
    return Response.json({ circuit: serializeProject(savedProject) });
  }

  if (projectId && request.method === "PUT") {
    const body = await parseCircuitBody(request);
    if (body instanceof Response) return body;

    const [updated] = await db
      .update(projects)
      .set({ ...body, modifiedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.owner, owner)))
      .returning();

    if (!updated) return jsonError("Circuit not found", 404);
    return Response.json({ circuit: serializeProject(updated) });
  }

  if (projectId && request.method === "DELETE") {
    const [deleted] = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.owner, owner)))
      .returning({ id: projects.id });

    if (!deleted) return jsonError("Circuit not found", 404);
    return new Response(null, { status: 204 });
  }

  return jsonError("Not found", 404);
}
