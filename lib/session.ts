import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { one, rows } from "@/lib/db";

export type Role =
  "OWNER" | "MANAGER" | "SALES" | "PRODUCT_APPROVER" | "VIEWER";
export type Actor = {
  id: string;
  organization_id: string;
  display_name: string;
  email: string;
  role: Role;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await rows(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [userId, tokenHash(token)],
  );
  return token;
}

export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get("aayatra_session")?.value;
  if (!token) return null;
  return one<Actor>(
    `SELECT u.id,u.organization_id,u.display_name,u.email,u.role
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,
    [tokenHash(token)],
  );
}

export async function requireActor(roles?: Role[]): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new ApiError(401, "Sign in required");
  if (roles && !roles.includes(actor.role))
    throw new ApiError(403, "You do not have permission for this action");
  return actor;
}

export async function requireSameOrigin(request: Request): Promise<void> {
  const origin = request.headers.get("origin");
  const host = (await headers()).get("host");
  const expected = process.env.APP_ORIGIN ?? (host ? `http://${host}` : "");
  let allowed = false;
  try {
    allowed = Boolean(
      origin && expected && new URL(origin).origin === new URL(expected).origin,
    );
  } catch {
    allowed = false;
  }
  if (!allowed) {
    throw new ApiError(403, "Invalid request origin");
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json(
      { error: "Check the required fields and try again" },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    (error as Error & { code?: string }).code === "23505"
  )
    return Response.json(
      { error: "This record already exists" },
      { status: 409 },
    );
  console.error("Request failed", error);
  return Response.json(
    { error: "The request could not be completed" },
    { status: 500 },
  );
}
