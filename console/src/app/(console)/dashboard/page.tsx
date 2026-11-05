import { cookies } from "next/headers";
import { DashboardView } from "@/components/views/dashboard";
import { openSession, SESSION_COOKIE } from "@/lib/session-token";

export default async function DashboardPage() {
  const session=await openSession((await cookies()).get(SESSION_COOKIE)?.value);
  const workspace=session?.sub==="demo-analyst"?"demo":session?.role==="admin"?"live":"other";
  return <DashboardView workspace={workspace} />;
}
