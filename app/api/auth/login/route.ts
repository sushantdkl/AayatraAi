import { cookies } from "next/headers";
import { z } from "zod";
import { one, rows } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import {
  ApiError,
  createSession,
  jsonError,
  requireSameOrigin,
} from "@/lib/session";

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    await requireSameOrigin(request);
    const input = schema.parse(await request.json());
    const email = input.email.trim().toLowerCase();
    const attempts = await one<{ blocked: boolean }>(
      "SELECT blocked_until > now() AS blocked FROM login_attempts WHERE email=$1",
      [email],
    );
    if (attempts?.blocked)
      throw new ApiError(429, "Too many sign-in attempts. Try again later");
    const user = await one<{ id: string; password_hash: string }>(
      "SELECT id,password_hash FROM users WHERE lower(email)=lower($1) AND active=true LIMIT 1",
      [email],
    );
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      await rows(
        `INSERT INTO login_attempts(email,attempts,blocked_until,updated_at)
         VALUES($1,1,NULL,now())
         ON CONFLICT(email) DO UPDATE SET
           attempts=CASE WHEN login_attempts.updated_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
           blocked_until=CASE WHEN login_attempts.updated_at >= now()-interval '15 minutes' AND login_attempts.attempts+1 >= 5
                              THEN now()+interval '15 minutes' ELSE NULL END,
           updated_at=now()`,
        [email],
      );
      throw new ApiError(401, "Email or password is incorrect");
    }
    await rows("DELETE FROM login_attempts WHERE email=$1", [email]);
    const token = await createSession(user.id);
    (await cookies()).set("aayatra_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
