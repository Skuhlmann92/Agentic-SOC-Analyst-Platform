import { cookies } from "next/headers";
import { AlertDetailView } from "@/components/views/alert-detail";
import { openSession, SESSION_COOKIE } from "@/lib/session-token";

export default async function AlertPage({ params }: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await params;
  const token=(await cookies()).get(SESSION_COOKIE)?.value;
  const session=await openSession(token);
  return <AlertDetailView alertId={alertId} liveTriage={session?.sub===(process.env.SOC_ADMIN_USERNAME||"socadmin")} />;
}
