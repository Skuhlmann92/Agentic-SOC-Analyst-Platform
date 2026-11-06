/** Deterministic, evidence-linked review assistance. Not a model confidence score. */
type Row=Record<string,unknown>;
const obj=(v:unknown):Row=>v&&typeof v==="object"&&!Array.isArray(v)?v as Row:{};
const value=(v:unknown)=>typeof v==="string"?v:"";
export type ReviewAdvice={
 kind:"escalate"|"investigate";
 title:string;
 reason:string;
 evidence:Array<{kind:string;record_id:string}>;
 method:"rules_v1";
};
export function reviewAdvice(draft:Row):ReviewAdvice {
 const severity=value(draft.severity).toLowerCase();
 const claims=Array.isArray(draft.claims)?draft.claims.map(obj):[];
 const evidence=claims.flatMap(c=>Array.isArray(c.citations)?c.citations.map(obj):[])
   .filter(c=>value(c.kind)&&value(c.record_id))
   .map(c=>({kind:value(c.kind),record_id:value(c.record_id)})).slice(0,12);
 const correlation=claims.find(c=>c.template==="host_correlation");
 const args=obj(correlation?.arguments);
 const related=Number(args.related_alerts)||0;
 const high=Number(args.high_or_critical)||0;
 const escalate=["critical","high"].includes(severity)||high>=3;
 return {
  kind:escalate?"escalate":"investigate",
  title:escalate?"Prioritär untersuchen / eskalieren":"Manuell verifizieren",
  reason:escalate?
   `Hohe Schwere oder korrelierte Hochrisiko-Alerts (insgesamt ${related}, davon ${high} hoch/kritisch). Keine automatische Freigabe.`:
   `Evidenz prüfen: ${related} zugehörige Host-Alerts, ${high} hoch/kritisch. Keine ausreichende Grundlage für eine automatische False-Positive-Einstufung.`,
  evidence,method:"rules_v1"
 };
}
/** Conservative grouping; group membership is a navigation aid, not proof of one incident. */
export function reviewGroup(alert:unknown):{key:string;label:string}|null {
 const a=obj(alert);const host=value(a.hostname).trim().toLowerCase();
 const rule=value(a.rule_id).trim();const source=value(a.source).trim().toLowerCase();
 const timestamp=Date.parse(value(a.detected_at));
 if(!host||host==="unknown"||!rule||!source||!Number.isFinite(timestamp))return null;
 const hour=Math.floor(timestamp/3600000);
 const key=JSON.stringify([host,rule,source,hour]);
 return {key,label:`${host} · Regel ${rule} · ${source} · 1 h`};
}
