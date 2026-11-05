"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {Activity,AlertTriangle,BookOpen,CheckCircle2,Clock3,FileSearch,HardDrive,PackageSearch,ShieldCheck,ShieldX,SlidersHorizontal} from "lucide-react";
import {PageHeader} from "@/components/page-header";
import {usePreferences} from "@/lib/preferences";
import {formatTime} from "@/lib/format";
import {platform} from "@/lib/sdk/client";
import type {PostureResponse} from "@/lib/security-posture";

export function SecurityPostureView({demo=false}:{demo?:boolean}){
 const {t}=usePreferences();
 const [host,setHost]=useState("all");
 const [state,setState]=useState<"all"|"failed"|"passed"|"summary">("failed");
 const query=useQuery({queryKey:["security-posture",demo],queryFn:()=>platform<PostureResponse>("api/v1/security/posture"),refetchInterval:60000,retry:1});
 const data=query.data;
 const checks=useMemo(()=>(data?.checks||[]).filter(x=>(host==="all"||x.host===host)&&(state==="all"||x.result===state)),[data,host,state]);
 const failed=(data?.hosts||[]).reduce((sum,h)=>sum+h.failed_checks,0);
 const passed=(data?.hosts||[]).reduce((sum,h)=>sum+h.passed_checks,0);
 return <div className="space-y-6">
  <PageHeader title={t("Wazuh Sicherheitsbewertung","Wazuh Security Posture")} detail={t("Nachgewiesene CIS-Konfigurationsbefunde und Transparenz darüber, welche Datenquellen bereits verbunden sind.","Evidence-backed CIS configuration findings and visibility into connected security data sources.")}/>
  {demo?<p className="rounded-lg border border-warning/40 p-3 text-sm">{t("Demoansicht – keine echten Wazuh-Sicherheitsbefunde.","Demo only – no real Wazuh posture evidence.")}</p>:null}
  {query.isError?<p role="alert" className="rounded-lg border border-danger/30 p-4 text-sm text-danger">{t("Sicherheitsbewertung nicht verfügbar. Bitte den Administratorzugang prüfen.","Security posture unavailable. Check administrator session.")}</p>:null}
  {query.isLoading?<p className="text-sm text-muted-foreground">{t("Lade Wazuh-Befunde ...","Loading Wazuh findings ...")}</p>:null}
  {data?<><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {[
    {name:t("Erfasste Endgeräte","Observed hosts"),count:data.hosts.length,icon:HardDrive,color:"text-accent"},
    {name:t("Abweichende CIS-Prüfungen","CIS check failures"),count:failed,icon:ShieldX,color:"text-danger"},
    {name:t("Bestandene CIS-Prüfungen","CIS checks passed"),count:passed,icon:CheckCircle2,color:"text-ok"},
    {name:t("Teilweise Datenabdeckung","Partial data coverage"),count:data.coverage.filter(x=>x.status==="partial").length,icon:Activity,color:"text-warning"},
   ].map(item=>{const Icon=item.icon;return <div className="panel rounded-2xl p-5" key={item.name}><div className="flex items-center justify-between gap-2 text-muted-foreground"><span className="text-xs font-semibold">{item.name}</span><Icon className={item.color} size={19}/></div><p className="mt-3 text-3xl font-semibold tabular-nums">{item.count}</p></div>;})}
  </section>
  <section className="grid gap-4 lg:grid-cols-2">
   {data.hosts.map(h=><div key={h.hostname} className="panel rounded-2xl p-5">
    <div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-semibold">{h.hostname}</h2><p className="mt-1 text-xs text-muted-foreground">{t("Letzter erfasster Alert","Last observed alert")}: {formatTime(h.last_detection)}</p></div><span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning">{t("Kein Live-Agentstatus","Not an agent-status check")}</span></div>
    <div className="mt-4 grid grid-cols-3 gap-2">
     <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t("Fehler","Failed")}</p><p className="mt-1 text-xl font-semibold">{h.failed_checks}</p></div>
     <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t("Bestanden","Passed")}</p><p className="mt-1 text-xl font-semibold">{h.passed_checks}</p></div>
     <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t("SCA-Score*","SCA score*")}</p><p className="mt-1 text-xl font-semibold">{h.sca_score===null?"—":h.sca_score+"%"}</p></div>
    </div>
    <p className="mt-3 text-[11px] text-muted-foreground">{t("*Nur wenn ein echter Wazuh-SCA-Zusammenfassungsalert vorliegt. Keine Hochrechnung aus Teilmeldungen.","*Only from a real Wazuh SCA summary alert; never estimated from partial results.")}</p>
   </div>)}
  </section>
  <section className="panel rounded-2xl p-5 sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-base font-semibold">{t("CIS-Prüfergebnisse","CIS configuration findings")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("Eindeutige Prüfungen je Host / Regel / Beschreibung; keine bestätigten Angriffe","Distinct checks per host / rule / description; not confirmed attacks")}</p></div>
    <div className="flex flex-wrap gap-2">
     <select className="field !w-auto" value={host} onChange={e=>setHost(e.target.value)} aria-label="Host"><option value="all">{t("Alle Hosts","All hosts")}</option>{data.hosts.map(h=><option key={h.hostname} value={h.hostname}>{h.hostname}</option>)}</select>
     <select className="field !w-auto" value={state} onChange={e=>setState(e.target.value as typeof state)} aria-label="Check state"><option value="failed">{t("Abweichend","Failed")}</option><option value="passed">{t("Bestanden","Passed")}</option><option value="summary">{t("Zusammenfassung","Summary")}</option><option value="all">{t("Alle Prüfungen","All checks")}</option></select>
    </div>
   </div>
   <div className="mt-4 space-y-2">{checks.slice(0,90).map(item=><Link href={`/alerts/${item.alert_id}`} key={item.id} className="flex items-start gap-3 rounded-xl border border-border p-3 hover:border-accent/50">
    {item.result==="failed"?<AlertTriangle className="mt-0.5 shrink-0 text-danger" size={17}/>:item.result==="passed"?<CheckCircle2 className="mt-0.5 shrink-0 text-ok" size={17}/>:<BookOpen className="mt-0.5 shrink-0 text-warning" size={17}/>}
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{item.host} · Wazuh {item.rule_id} · {formatTime(item.last_seen)} · {item.occurrences}×</span></span>
   </Link>)}
   {!checks.length?<p className="py-8 text-center text-sm text-muted-foreground">{t("Keine gespeicherten CIS-Befunde für diesen Filter.","No recorded CIS results for this filter.")}</p>:null}</div>
   {checks.length>90?<p className="mt-3 text-xs text-muted-foreground">{t("Die ersten 90 Prüfergebnisse werden angezeigt.","Showing the first 90 check results.")}</p>:null}
  </section>
  <section className="panel rounded-2xl p-5 sm:p-6">
   <h2 className="text-base font-semibold">{t("Wazuh-Datenquellen","Wazuh data coverage")}</h2>
   <p className="mt-1 text-xs text-muted-foreground">{t("Nicht angebundene Quellen werden ausdrücklich gekennzeichnet. Die SOC-Plattform berechnet daraus keine fiktiven Werte.","Unavailable sources are explicitly marked; no compliance or CVE metrics are fabricated.")}</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">{data.coverage.map(item=><div key={item.key} className="rounded-xl border border-border p-4">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{({sca:"Security Configuration Assessment",vulnerability:"Vulnerability Detection / CVE",fim:"File Integrity Monitoring",inventory:"Software-/Hardware-Inventar",agent_status:"Agent Connectivity"} as Record<string,string>)[item.key]||item.key}</p>
    <span className={`whitespace-nowrap text-[10px] font-semibold ${item.status==="partial"?"text-warning":"text-muted-foreground"}`}>{item.status==="partial"?t("Teilweise","Partial"):t("Nicht verbunden","Not connected")}</span></div>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.explanation}</p>
   </div>)}</div>
  </section>
  </>:null}
 </div>;
}
