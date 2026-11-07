"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useQuery} from "@tanstack/react-query";
import {PageHeader} from "@/components/page-header";
import {usePreferences} from "@/lib/preferences";
import {formatTime} from "@/lib/format";
import {sdk} from "@/lib/sdk/client";
type Heartbeat={hostname:string;heartbeat_status:string;observed_at:string|null;agent_service:string;os:string|null;ip:string|null;alerts_24h:number;high_priority:number};
type InventoryHost={hostname:string;received_at:string;software_count:number;os?:{name:string;version:string};hardware?:{cpu:string}};
type HeartbeatResponse={hosts:Heartbeat[]};
type InventoryResponse={data:InventoryHost[]};
async function getJSON<T>(url:string):Promise<T>{const response=await fetch(url,{cache:"no-store"});if(!response.ok)throw new Error("Endpoint API unavailable");return response.json() as Promise<T>;}
export default function AssetDetailPage(){
 const params=useParams(),hostname=decodeURIComponent(String(params.hostname??""));
 const {t}=usePreferences();
 const hb=useQuery({queryKey:["asset-heartbeat",hostname],queryFn:()=>getJSON<HeartbeatResponse>("/api/endpoint-heartbeat"),enabled:!!hostname});
 const inv=useQuery({queryKey:["asset-inventory",hostname],queryFn:()=>getJSON<InventoryResponse>("/api/endpoint-inventory"),enabled:!!hostname});
 const alerts=useQuery({queryKey:["asset-alerts",hostname],queryFn:()=>sdk.searchAlerts({host:hostname,limit:10,sort:"event_time"}),enabled:!!hostname});
 const heartbeat=hb.data?.hosts.find(h=>h.hostname.toLowerCase()===hostname.toLowerCase());
 const inventory=inv.data?.data.find(h=>h.hostname.toLowerCase()===hostname.toLowerCase());
 return <div className="space-y-5">
  <PageHeader title={hostname} detail={t("Endgeräteprofil mit Status, Betriebssystem, Inventar und verknüpften Sicherheitsmeldungen.","Endpoint profile with status, operating system, inventory and linked alerts.")}/>
  <nav aria-label={t("Endgerätenavigation","Asset navigation")} className="flex flex-wrap items-center gap-2 text-sm"><Link href="/entities?type=host" className="text-accent hover:underline">{t("Alle Assets","All assets")}</Link><span aria-hidden>›</span><span>{hostname}</span></nav>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="panel rounded-xl p-5">
    <h2 className="mb-3 font-semibold">{t("Status und Telemetrie","Status and telemetry")}</h2>
    {hb.isLoading?<p className="text-sm">{t("Status wird geladen …","Loading status …")}</p>:null}
    {hb.isError?<p role="alert" className="text-sm text-danger">{t("Heartbeat derzeit nicht erreichbar.","Heartbeat unavailable.")}</p>:null}
    {heartbeat?<dl className="grid grid-cols-2 gap-3 text-sm">
     <div><dt className="text-muted-foreground">{t("Letzte Meldung","Last heartbeat")}</dt><dd>{formatTime(heartbeat.observed_at)}</dd></div>
     <div><dt className="text-muted-foreground">{t("Heartbeat-Status","Heartbeat status")}</dt><dd>{heartbeat.heartbeat_status}</dd></div>
     <div><dt className="text-muted-foreground">IP</dt><dd className="font-mono">{heartbeat.ip??"—"}</dd></div>
     <div><dt className="text-muted-foreground">{t("Wazuh-Dienst (lokal)","Wazuh local service")}</dt><dd>{heartbeat.agent_service}</dd></div>
     <div><dt className="text-muted-foreground">{t("Alerts / 24 h","Alerts / 24 h")}</dt><dd>{heartbeat.alerts_24h}</dd></div>
     <div><dt className="text-muted-foreground">{t("Hohe Priorität","High priority")}</dt><dd>{heartbeat.high_priority}</dd></div>
    </dl>:!hb.isLoading&&!hb.isError?<p className="text-sm text-muted-foreground">{t("Kein signierter Heartbeat für diesen Host.","No signed heartbeat for this host.")}</p>:null}
    <p className="mt-3 text-xs text-muted-foreground">{t("Ein Heartbeat bestätigt nicht die Verbindung zum Wazuh-Manager.","A heartbeat does not prove Wazuh Manager connectivity.")}</p>
   </section>
   <section className="panel rounded-xl p-5">
    <h2 className="mb-3 font-semibold">{t("System und Software","System and software")}</h2>
    {inv.isLoading?<p className="text-sm">{t("Inventar wird geladen …","Loading inventory …")}</p>:null}
    {inv.isError?<p role="alert" className="text-sm text-danger">{t("Inventar derzeit nicht erreichbar.","Inventory unavailable.")}</p>:null}
    {inventory?<dl className="grid grid-cols-2 gap-3 text-sm">
     <div><dt className="text-muted-foreground">{t("Betriebssystem","Operating system")}</dt><dd>{inventory.os?.name??"—"}</dd></div>
     <div><dt className="text-muted-foreground">{t("Version","Version")}</dt><dd>{inventory.os?.version??"—"}</dd></div>
     <div><dt className="text-muted-foreground">CPU</dt><dd>{inventory.hardware?.cpu??"—"}</dd></div>
     <div><dt className="text-muted-foreground">{t("Softwarepakete","Software entries")}</dt><dd>{inventory.software_count}</dd></div>
     <div className="col-span-2"><dt className="text-muted-foreground">{t("Inventarstand","Inventory collected")}</dt><dd>{formatTime(inventory.received_at)}</dd></div>
    </dl>:!inv.isLoading&&!inv.isError?<p className="text-sm text-muted-foreground">{t("Kein signiertes Inventar für diesen Host.","No signed inventory for this host.")}</p>:null}
    <Link className="mt-4 inline-block text-sm font-semibold text-accent hover:underline" href={`/inventory?host=${encodeURIComponent(hostname)}`}>{t("Softwareliste öffnen","Open software list")} →</Link>
   </section>
  </div>
  <section className="panel rounded-xl p-5">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t("Letzte Sicherheitsmeldungen","Recent security alerts")}</h2><Link className="text-sm font-semibold text-accent hover:underline" href={`/alerts?host=${encodeURIComponent(hostname)}`}>{t("Alle Meldungen","All alerts")} →</Link></div>
   {alerts.isLoading?<p className="text-sm">{t("Meldungen werden geladen …","Loading alerts …")}</p>:null}
   {alerts.isError?<p role="alert" className="text-sm text-danger">{t("Meldungen nicht erreichbar.","Alerts unavailable.")}</p>:null}
   {!alerts.isLoading&&!alerts.isError&&!alerts.data?.data.length?<p className="text-sm text-muted-foreground">{t("Keine Meldungen für diesen Host gefunden.","No alerts found for this host.")}</p>:null}
   <ul className="divide-y divide-border">{(alerts.data?.data??[]).map(a=><li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><Link className="text-sm font-medium text-accent hover:underline" href={`/alerts/${a.id}`}>{a.title}</Link><span className="text-xs text-muted-foreground">{a.severity} · {formatTime(a.detected_at)}</span></li>)}</ul>
  </section>
 </div>;
}
