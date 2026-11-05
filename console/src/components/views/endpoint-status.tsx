"use client";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {Activity,Clock3,HardDrive,MonitorCheck,ShieldAlert,Wifi,WifiOff} from "lucide-react";
import {PageHeader} from "@/components/page-header";
import {formatTime} from "@/lib/format";
import {usePreferences} from "@/lib/preferences";
type Host={hostname:string;heartbeat_status:"recent"|"stale"|"not_configured";observed_at:string|null;agent_service:string;wazuh_manager_service:string|null;os:string|null;os_version:string|null;wazuh_version:string|null;ip:string|null;alerts_total:number;alerts_24h:number;high_priority:number;last_alert:string|null;note:string};
type Resp={generated_at:string;hosts:Host[]};
export function EndpointStatusView(){
 const {t}=usePreferences();
 const query=useQuery({queryKey:["endpoint-status"],queryFn:async()=>{
  const r=await fetch("/api/endpoint-heartbeat",{cache:"no-store"});
  if(!r.ok)throw Error("Endpoint monitoring unavailable ("+r.status+")");
  return await r.json() as Resp;
 },refetchInterval:60000});
 return <div className="space-y-6">
  <PageHeader title={t("Live-Endgeräte","Endpoint monitoring")} detail={t("Signierte Zustandsmeldungen beider Hosts mit Wazuh-Dienststatus. Der Manager-Verbindungsstatus ist noch nicht über die Wazuh-API verifiziert.","Signed endpoint heartbeats with Wazuh service status. The manager's own connected-agent state is not yet available.")}/>
  <div className="panel rounded-xl p-4 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{t("Statusinterpretation","How status works")}:</span> {t("Grün bedeutet: Die letzte signierte Zustandsmeldung ist höchstens 15 Minuten alt. Es bedeutet nicht automatisch, dass der Agent beim Wazuh-Manager registriert oder verbunden ist.","Green means: a signed heartbeat arrived within the last 15 minutes. It does not prove that the Wazuh Manager currently sees the agent as connected.")}</div>
  {query.isLoading?<p className="text-sm text-muted-foreground">{t("Lade Endgeräte ...","Loading endpoints ...")}</p>:null}
  {query.isError?<p className="text-sm text-danger">{t("Endgerätedaten nicht erreichbar.","Endpoint data unavailable.")}</p>:null}
  <section className="grid gap-4 lg:grid-cols-2">{(query.data?.hosts||[]).map(host=><div className="panel rounded-2xl p-5" key={host.hostname}>
   <div className="flex items-start justify-between gap-3">
    <div className="flex items-center gap-3"><div className="rounded-xl bg-accent/10 p-3 text-accent"><HardDrive size={21}/></div><div><h2 className="text-base font-semibold">{host.hostname}</h2><p className="mt-1 text-xs text-muted-foreground">{host.os||t("Betriebssystem noch unbekannt","OS not reported")}</p></div></div>
    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${host.heartbeat_status==="recent"?"border-ok/30 bg-ok/10 text-ok":"border-warning/30 bg-warning/10 text-warning"}`}>{host.heartbeat_status==="recent"?t("Heartbeat aktuell","Heartbeat recent"):host.heartbeat_status==="stale"?t("Heartbeat veraltet","Heartbeat stale"):t("Nicht eingerichtet","Not configured")}</span>
   </div>
   <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
    <div><p className="text-xs text-muted-foreground">{t("Wazuh-Dienst (lokal)","Wazuh service (local)")}</p><p className="mt-1 font-semibold">{host.agent_service==="running"?t("Läuft","Running"):host.agent_service==="unverified"?t("Nicht verifiziert","Unverified"):host.agent_service}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Letzter Heartbeat","Last heartbeat")}</p><p className="mt-1 text-xs font-medium">{formatTime(host.observed_at)}</p></div>
    <div><p className="text-xs text-muted-foreground">IP / LAN</p><p className="mt-1 font-mono text-xs">{host.ip||"—"}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Wazuh-Version","Wazuh version")}</p><p className="mt-1 text-xs">{host.wazuh_version||"—"}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Alerts letzte 24 Stunden","Alerts in last 24 hours")}</p><p className="mt-1 text-xl font-semibold">{host.alerts_24h}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Alerts gesamt","Total alerts")}</p><p className="mt-1 text-xl font-semibold">{host.alerts_total}</p></div>
   </div>
   {host.wazuh_manager_service?<p className="mt-3 text-xs text-muted-foreground">Wazuh Manager Service: {host.wazuh_manager_service}</p>:null}
   <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4 text-xs"><span className="text-muted-foreground">{t("Letzter Alert","Last alert")}: {formatTime(host.last_alert)}</span><Link href={`/alerts?host=${encodeURIComponent(host.hostname)}`} className="ml-auto font-semibold text-accent">{t("Alerts untersuchen","Investigate alerts")}</Link></div>
  </div>)}</section>
 </div>;
}
