"use client";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useState} from "react";
import Link from "next/link";
import {Activity,ArrowRight,Bell,BookOpen,Briefcase,CheckCircle2,Clock3,Monitor,RefreshCcw,ShieldAlert,ShieldCheck,Sparkles,Users} from "lucide-react";
import {Area,AreaChart,CartesianGrid,Cell,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {EmptyState,ErrorState,LoadingBlock} from "@/components/states";
import {StatusBadge} from "@/components/severity";
import {countLabel,formatTime,dayKey} from "@/lib/format";
import {ApiClientError,sdk} from "@/lib/sdk/client";
import {usePreferences} from "@/lib/preferences";

const COLOR:Record<string,string>={critical:"#ef5576",high:"#f59e5e",medium:"#efbe59",low:"#4da4df",informational:"#8493b6",unknown:"#8792a5"};
const tooltip={contentStyle:{background:"var(--surface-elevated)",border:"1px solid hsl(var(--border))",borderRadius:10,fontSize:12,color:"hsl(var(--foreground))"},labelStyle:{color:"hsl(var(--foreground))"}};
export function DashboardView({workspace="other"}:{workspace?:"demo"|"live"|"other"}){
 const {t,locale}=usePreferences();
 const client=useQueryClient();
 const [range,setRange]=useState<"24h"|"7d"|"all">("7d");
 const alerts=useQuery({queryKey:["dashboard","recent"],queryFn:()=>sdk.searchAlerts({limit:100,sort:"event_time"}),refetchInterval:60000});
 const facets=useQuery({queryKey:["dashboard","facets"],queryFn:()=>sdk.facets(),refetchInterval:60000});
 const cases=useQuery({queryKey:["dashboard","cases"],queryFn:()=>sdk.listCases({limit:100})});
 const reviews=useQuery({queryKey:["dashboard","reviews"],queryFn:()=>sdk.listDrafts({status:"pending_approval",limit:100})});
 const investigations=useQuery({queryKey:["dashboard","investigations"],queryFn:()=>sdk.listInvestigations({limit:100})});
 const queries=[alerts,facets,cases,reviews,investigations];
 const failed=queries.find(q=>q.isError);
 if(failed?.isError)return <ErrorState message={failed.error instanceof ApiClientError?failed.error.message:t("Dashboard konnte nicht geladen werden.","Dashboard could not be loaded.")} onRetry={()=>failed.refetch()}/>;
 if(queries.some(q=>q.isLoading))return <LoadingBlock label={t("Lade Sicherheitsübersicht","Loading security overview")}/>;
 const now=Date.now();
 const recent=(alerts.data?.data??[]).filter(x=>range==="all"||now-new Date(x.detected_at).getTime()<=(range==="24h"?86400000:604800000));
 const severity=(facets.data?.severity??[]).filter(x=>x.count>0).map(x=>({name:x.value,value:x.count,color:COLOR[x.value]||COLOR.unknown}));
 const total=severity.reduce((sum,x)=>sum+x.value,0);
 const critical=severity.filter(x=>x.name==="critical"||x.name==="high").reduce((sum,x)=>sum+x.value,0);
 const hosts=[...(facets.data?.host??[])].sort((a,b)=>b.count-a.count).slice(0,6);
 const runningCases=(cases.data?.data??[]).filter(x=>x.status==="open"||x.status==="investigating").length;
 const pending=reviews.data?.data.length??0;
 const newest=alerts.data?.data[0]?.detected_at;
 const daily=new Map<string,number>();
 const countDays=range==="24h"?1:range==="7d"?7:14;
 for(let i=countDays-1;i>=0;i--){const d=dayKey(new Date(now-i*86400000).toISOString());daily.set(d,0);}
 for(const a of recent){const day=dayKey(a.detected_at);if(daily.has(day))daily.set(day,(daily.get(day)||0)+1);}
 const trend=[...daily].map(([day,count])=>({day:day.slice(5),count}));
 const kpis=[
 {title:t("Sicherheitsmeldungen","Security alerts"),number:total.toLocaleString(locale==="de"?"de-DE":"en-US"),sub:t("Gesamtbestand aller Quellen","Across all ingested sources"),icon:Bell,accent:"hsl(var(--accent))",href:"/alerts"},
 {title:t("Hohe Priorität","High priority"),number:critical.toLocaleString(locale==="de"?"de-DE":"en-US"),sub:t("High + Critical, keine bestätigten Vorfälle","High + critical, not confirmed incidents"),icon:ShieldAlert,accent:"#ed7386",href:"/alerts"},
 {title:t("Aktive Fälle","Active cases"),number:countLabel(runningCases,Boolean(cases.data?.page.has_more)),sub:t("Offen oder in Bearbeitung","Open or investigating"),icon:Briefcase,accent:"#609ee8",href:"/cases"},
 {title:t("Warten auf Freigabe","Awaiting approval"),number:countLabel(pending,Boolean(reviews.data?.page.has_more)),sub:t("KI- und Analyseentwürfe","AI and investigation drafts"),icon:Clock3,accent:"#e5af53",href:"/reviews"},
 ];
 return <div className="space-y-7">
  <section className="flex flex-wrap items-start justify-between gap-4">
   <div>
    <div className="mb-2 flex items-center gap-2">
     <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${workspace==="demo"?"border-warning/30 bg-warning/10 text-warning":"border-ok/30 bg-ok/10 text-ok"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${workspace==="demo"?"bg-warning":"bg-ok"}`}/>{workspace==="demo"?"DEMO":"LIVE SOC"}
     </span>
     <span className="text-xs text-muted-foreground">/ {t("Sicherheitslage","Security posture")}</span>
    </div>
    <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">{t("Security Operations Übersicht","Security operations overview")}</h2>
    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{workspace==="demo"?t("Demoumgebung mit Beispieldaten – keine Live-Telemetrie.","Demo workspace with sample data – no live telemetry."):t("Aktuelle Erkennungen, betroffene Systeme und priorisierte Untersuchungen auf einen Blick.","Detections, affected endpoints and prioritized investigations in one place.")}</p>
   </div>
   <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-semibold hover:border-accent/50" onClick={()=>client.invalidateQueries({queryKey:["dashboard"]})}>
    <RefreshCcw size={14}/>{t("Aktualisieren","Refresh")}
   </button>
  </section>
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   {kpis.map(k=>{const Icon=k.icon;return <Link href={k.href} key={k.title} className="panel soc-kpi rounded-2xl p-5" style={{"--kpi-line":k.accent} as React.CSSProperties}>
    <div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-muted-foreground">{k.title}</span><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60" style={{color:k.accent}}><Icon size={18}/></span></div>
    <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{k.number}</p>
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{k.sub}</p>
   </Link>;})}
  </section>
  <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
   <div className="panel rounded-2xl p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
     <div><h3 className="text-sm font-bold">{t("Erkennungen im Zeitverlauf","Detection activity")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("Bis zu 100 zuletzt geladene Alerts; kein vollständiger Zeitraum bei hoher Last","Latest 100 alerts only; not a complete window under high volume")}</p></div>
     <div className="soc-toggle">{(["24h","7d","all"] as const).map(x=><button key={x} aria-pressed={range===x} onClick={()=>setRange(x)}>{x==="all"?t("Alle","All"):x}</button>)}</div>
    </div>
    {recent.length?<div className="soc-chart h-[245px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{top:12,right:5,left:-24,bottom:0}}>
     <defs><linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#21c6ce" stopOpacity={.28}/><stop offset="95%" stopColor="#21c6ce" stopOpacity={.015}/></linearGradient></defs>
     <CartesianGrid vertical={false} strokeDasharray="3 5"/><XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false}/><YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false}/>
     <Tooltip {...tooltip}/><Area dataKey="count" stroke="#21b7c2" strokeWidth={2.5} fill="url(#activityFill)" type="monotone" dot={false} activeDot={{r:5}}/></AreaChart></ResponsiveContainer></div>:<div className="flex h-[245px] items-center justify-center text-sm text-muted-foreground">{t("Keine Meldungen im ausgewählten Zeitraum","No alerts in selected period")}</div>}
   </div>
   <div className="panel rounded-2xl p-5 sm:p-6">
    <div><h3 className="text-sm font-bold">{t("Verteilung nach Priorität","Severity breakdown")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("Alle gespeicherten Erkennungen","All stored detections")}</p></div>
    <div className="relative mt-2 h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={severity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={64} outerRadius={86} paddingAngle={3} stroke="none">{severity.map(item=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip {...tooltip}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[28px] font-bold tabular-nums">{total}</span><span className="text-[10px] text-muted-foreground">{t("Alerts gesamt","Total alerts")}</span></div></div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">{severity.map(item=><div key={item.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{background:item.color}}/>{item.name}</span><span className="font-mono text-muted-foreground">{item.value}</span></div>)}</div>
   </div>
  </section>
  <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
   <div className="panel min-w-0 overflow-hidden rounded-2xl">
    <div className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-6"><div><h3 className="text-sm font-bold">{t("Neueste Sicherheitsmeldungen","Latest detections")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("Aktuelle Ereignisse aus dem SOC","Recent records in the SOC")}</p></div><Link href="/alerts" className="flex items-center gap-1 text-xs font-semibold text-accent">{t("Alle anzeigen","View all")}<ArrowRight size={14}/></Link></div>
    <div className="divide-y divide-border">{(alerts.data?.data??[]).slice(0,6).map(a=><Link key={a.id} href={`/alerts/${a.id}`} className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-muted/30 sm:px-6">
     <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground"><ShieldAlert size={16}/></span>
     <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{a.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{a.hostname||"—"} · {a.source} · {formatTime(a.detected_at)}</p></div>
     <StatusBadge value={a.severity}/>
    </Link>)}
    {!alerts.data?.data.length?<p className="px-6 py-8 text-sm text-muted-foreground">{t("Noch keine Sicherheitsmeldungen","No alerts available")}</p>:null}
    </div>
   </div>
   <div className="panel rounded-2xl p-5 sm:p-6">
    <div className="flex items-center gap-2"><Monitor size={17} className="text-accent"/><h3 className="text-sm font-bold">{t("Betroffene Systeme","Affected endpoints")}</h3></div>
    <p className="mt-1 text-xs text-muted-foreground">{t("Hosts nach Anzahl an Meldungen","Hosts ranked by alert volume")}</p>
    <div className="mt-6 space-y-5">{hosts.map(h=><div key={h.value}>
     <div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold">{h.value}</span><span className="font-mono text-muted-foreground">{h.count}</span></div>
     <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{width:`${hosts[0]?.count?(h.count/hosts[0].count)*100:0}%`}}/></div>
    </div>)}
    {!hosts.length?<p className="text-xs text-muted-foreground">{t("Keine Endgeräte vorhanden","No endpoints available")}</p>:null}</div>
    <Link className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-accent" href="/entities">{t("Endgeräte untersuchen","Explore entities")}<ArrowRight size={14}/></Link>
   </div>
  </section>
  <section className="grid gap-4 md:grid-cols-3">
   {[
    {href:"/agent-workspace",icon:Sparkles,title:t("KI-Agent & Skripte","AI agent & scripts"),body:t("Wazuh-Alerts korrelieren und Claude-Skriptvorschläge erstellen.","Correlate Wazuh detections and generate Claude script proposals.")},
    {href:"/investigations",icon:Activity,title:t("Untersuchungen","Investigations"),body:t("Analysen und Hypothesen zu aktiven Fällen öffnen.","Open analyses and hypotheses for active cases.")},
    {href:"/reviews",icon:CheckCircle2,title:t("Freigaben prüfen","Review approvals"),body:t("Vorschläge vor einer Umsetzung durch Menschen prüfen.","Human review before operational changes.")}
   ].map(item=>{const Icon=item.icon;return <Link className="panel flex items-start gap-3 rounded-2xl p-5 hover:border-accent/40" key={item.href} href={item.href}><span className="rounded-lg bg-accent/10 p-2 text-accent"><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.body}</span></span><ArrowRight className="mt-1 shrink-0 text-muted-foreground" size={15}/></Link>;})}
  </section>
  <p className="text-[11px] text-muted-foreground">{t("Sicherheitsmeldungen sind Hinweise, keine bestätigten Kompromittierungen. Werte aus Seitenabfragen können begrenzt sein.","Alerts are signals, not confirmed compromises. Page-limited widgets may be incomplete.")} {newest?t("Neueste Erkennung: ","Last detection: ")+formatTime(newest):""}</p>
 </div>;
}
