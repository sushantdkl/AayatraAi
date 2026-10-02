import { redirect } from "next/navigation";
import { currentActor } from "@/lib/session";
import Workspace from "@/app/workspace";

export default async function Home() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return <Workspace actor={actor} />;
}
