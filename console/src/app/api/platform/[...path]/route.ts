import { cookies } from "next/headers";

import { publicDemoApi } from "@/lib/demo-api";
import { liveApi } from "@/lib/live-api";
import {authorizeWorkspace} from "@/lib/tenant-policy";
import { openSession, SESSION_COOKIE } from "@/lib/session-token";

async function sessionOr401() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await openSession(token);
  if (!session) {
    return {
      session: null,
      response: Response.json(
        { error: { code: "unauthenticated", message: "Sign in required." } },
        { status: 401 },
      ),
    };
  }
  return { session, response: null };
}

async function proxy(request: Request, path: string[], method: "GET" | "POST") {
  const { session, response } = await sessionOr401();
  if (!session || response) return response;
  const authorization=authorizeWorkspace(session,process.env.SOC_ADMIN_USERNAME||"socadmin");
  if(authorization.kind==="public_demo"){
    try{
      return await publicDemoApi(request,path);
    }catch(error){
      console.error("SOC demo API error",error instanceof Error?error.name:"unknown");
      return Response.json({error:{code:"demo_unavailable",message:"Demo data is temporarily unavailable."}},{status:503});
    }
  }
  if(authorization.kind==="legacy_live"){
    try{
      return await liveApi(request,path,session.name);
    }catch(error){
      console.error("SOC live API error",error instanceof Error?error.name:"unknown");
      return Response.json({error:{code:"live_unavailable",message:"Live SOC data is temporarily unavailable."}},{status:503});
    }
  }
  // An authenticated session is NOT evidence of membership in an arbitrary tenant.
  // The old generic forwarding path could make that dangerous; fail closed until
  // database-backed membership checks and tenant-scoped service credentials ship.
  return Response.json({error:{code:"tenant_access_denied",
    message:"No verified organization membership for this workspace."}},{status:403});

}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path, "GET");
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path, "POST");
}
