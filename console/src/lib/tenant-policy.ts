import type {SessionClaims} from "./session-token";

export const DEMO_TENANT="11111111-1111-4111-8111-111111111111";
export const LEGACY_LIVE_TENANT="22222222-2222-4222-8222-222222222222";

export type WorkspaceAuthorization=
 | {kind:"public_demo";tenantId:typeof DEMO_TENANT;permissions:"read"}
 | {kind:"legacy_live";tenantId:typeof LEGACY_LIVE_TENANT;permissions:"admin"}
 | {kind:"denied";reason:string};

/**
 * P0 fail-closed boundary. Never infer access from a client-controlled tenant
 * query parameter, hostname, requested role, or merely a valid signed session.
 * New SaaS tenants must be explicitly admitted via verified DB memberships
 * before we add the corresponding workspace routing.
 */
export function authorizeWorkspace(
 session:Pick<SessionClaims,"sub"|"role"|"tenantId">|null,
 adminUsername:string,
):WorkspaceAuthorization {
 if(!session)return {kind:"denied",reason:"missing_session"};
 if(session.sub==="demo-analyst"&&session.tenantId===DEMO_TENANT&&session.role==="analyst")
  return {kind:"public_demo",tenantId:DEMO_TENANT,permissions:"read"};
 if(session.tenantId===LEGACY_LIVE_TENANT &&
    session.sub===adminUsername && session.role==="admin")
  return {kind:"legacy_live",tenantId:LEGACY_LIVE_TENANT,permissions:"admin"};
 return {kind:"denied",reason:"tenant_membership_not_verified"};
}

export type CommercialRole="platform_admin"|"customer_admin"|"security_analyst"|"viewer";
export type CommercialPermission="org:read"|"org:manage"|"assets:read"|"alerts:read"|
 "alerts:triage"|"remediation:propose"|"remediation:review"|"billing:read"|"billing:manage";

const PERMISSIONS:Record<CommercialRole,readonly CommercialPermission[]>={
 platform_admin:["org:read","org:manage","assets:read","alerts:read","alerts:triage",
  "remediation:propose","remediation:review","billing:read","billing:manage"],
 customer_admin:["org:read","org:manage","assets:read","alerts:read","alerts:triage",
  "remediation:propose","remediation:review","billing:read","billing:manage"],
 security_analyst:["org:read","assets:read","alerts:read","alerts:triage","remediation:propose"],
 viewer:["org:read","assets:read","alerts:read","billing:read"],
};
export function hasCommercialPermission(role:CommercialRole,permission:CommercialPermission):boolean{
 return PERMISSIONS[role]?.includes(permission)??false;
}
