"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {PageHeader} from "@/components/page-header";
import {usePreferences} from "@/lib/preferences";
import {formatTime} from "@/lib/format";
type Software={name:string;version:string;publisher:string};
type Host={hostname:string;received_at:string;complete:boolean;collection_scope:string;software_count:number;software:Software[];os:{name:string;version:string;build:string;architecture:string;kernel:string};hardware:{cpu:string;memory_bytes:number;processor_count:number}};
type Data={generated_at:string;source:string;wazuh_syscollector_connected:boolean;cve_source_connected:boolean;data:Host[]};
export function InventoryView(){
 const {t}=usePreferences();const [host,setHost]=useState("all");const [term,setTerm]=useState("");
 const query=useQuery({queryKey:["endpoint-inventory"],queryFn:async()=>{
  const r=await fetch("/api/endpoint-inventory",{cache:"no-store"});if(!r.ok)throw Error("Inventory API HTTP "+r.status);
  return await r.json() as Data;
 },refetchInterval:300000});
 const all=query.data?.data||[];
 const hosts=all.filter(x=>host==="all"||x.hostname===host);
 const packages=hosts.flatMap(x=>(x.software||[]).filter(p=>(p.name+" "+p.version+" "+p.publisher).toLowerCase().includes(term.toLowerCase())).map(p=>({...p,hostname:x.hostname}))).sort((a,b)=>a.name.localeCompare(b.name));
 return <div className="space-y-5">
  <PageHeader title={t("Software- & Hardwareinventar","Software & hardware inventory")} detail={t("Signierte Systembestandsaufnahme von Raspberry Pi und Windows-Laptop mit Softwareversionen und Zeitstempel.","Signed endpoint inventory from Raspberry Pi and Windows laptop, including software versions and collection timestamps.")}/>
  <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">{t("Datenquelle: eigener signierter Endgeräte-Collector, nicht die vollständige Wazuh-Syscollector-API. CVE-/Schwachstellenabgleich und Wazuh-Managerstatus sind noch nicht angebunden. Keine CVEs werden aus Programmnamen geschätzt.","Data source: signed local endpoint collector, not the full Wazuh Syscollector API. CVE correlation and Wazuh Manager status are not connected. No CVEs are inferred from software names.")}</div>
  {query.isLoading?<p className="text-sm text-muted-foreground">{t("Lade Inventar ...","Loading inventory ...")}</p>:null}
  {query.isError?<p role="alert" className="text-sm text-danger">{t("Inventardaten derzeit nicht erreichbar.","Inventory data currently unavailable.")}</p>:null}
  <div className="grid gap-4 md:grid-cols-2">{all.map(item=><article key={item.hostname} className="panel rounded-xl p-5">
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{item.hostname}</h2><span className="text-xs text-muted-foreground">{formatTime(item.received_at)}</span></div>
   <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
    <div><p className="text-xs text-muted-foreground">{t("Betriebssystem","Operating system")}</p><p className="font-medium">{item.os?.name||"—"}</p><p className="text-xs">{item.os?.version||"—"} · {item.os?.architecture||"—"}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Prozessor","CPU")}</p><p className="font-medium">{item.hardware?.cpu||"—"}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Arbeitsspeicher","RAM")}</p><p className="font-medium">{item.hardware?.memory_bytes?Math.round(item.hardware.memory_bytes/1073741824*10)/10+" GiB":"—"}</p></div>
    <div><p className="text-xs text-muted-foreground">{t("Erfasste Softwarepakete","Software entries")}</p><p className="font-medium">{item.software_count||0}</p></div>
   </div>
   <p className="mt-3 text-[11px] text-muted-foreground">{item.collection_scope||""}</p>
  </article>)}</div>
  <section className="panel rounded-xl p-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{t("Installierte Software und Versionen","Installed software and versions")}</h2><p className="text-xs text-muted-foreground">{t("Aus den letzten erfassten Bestandsaufnahmen","From latest signed inventory snapshots")}</p></div><p className="text-sm font-medium">{packages.length} {t("Einträge","entries")}</p></div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2"><select className="field" value={host} onChange={e=>setHost(e.target.value)} aria-label="Host"><option value="all">{t("Alle Geräte","All devices")}</option>{all.map(x=><option key={x.hostname} value={x.hostname}>{x.hostname}</option>)}</select><input className="field" value={term} onChange={e=>setTerm(e.target.value)} placeholder={t("Programm, Version oder Hersteller suchen","Search program, version or publisher")}/></div>
   <div className="mt-4 max-h-[620px] overflow-auto"><table className="data-table"><thead><tr><th>{t("Programm","Software")}</th><th>{t("Version","Version")}</th><th>{t("Hersteller","Publisher")}</th><th>{t("Gerät","Host")}</th></tr></thead><tbody>{packages.slice(0,1200).map((p,i)=><tr key={p.hostname+"|"+p.name+"|"+p.version+"|"+i}><td className="font-medium">{p.name}</td><td className="font-mono">{p.version||"—"}</td><td>{p.publisher||"—"}</td><td>{p.hostname}</td></tr>)}</tbody></table></div>
   {!packages.length?<p className="mt-4 text-sm text-muted-foreground">{t("Keine passenden Softwareeinträge erfasst.","No matching inventory entries.")}</p>:null}
  </section>
 </div>;
}