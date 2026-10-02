import { cookies } from "next/headers";
import { rows } from "@/lib/db";
import { jsonError, requireSameOrigin, tokenHash } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const jar = await cookies();
    const token = jar.get("aayatra_session")?.value;
    if (token)
      await rows("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(token),
      ]);
    jar.delete("aayatra_session");
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
