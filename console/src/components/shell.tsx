"use client";

import {Activity,Bell,Bot,Briefcase,ClipboardCheck,LayoutDashboard,LogOut,Network,Settings,Shield,Sun,Moon,Globe,ChevronsUpDown,ShieldCheck,Menu,X,ScanSearch,BookOpen} from "lucide-react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {useState} from "react";
import {Sentinel} from "@/components/sentinel/panel";
import {canAdminister,canReview} from "@/lib/operators";
import type {SessionClaims} from "@/lib/session-token";
import {PreferencesProvider,usePreferences} from "@/lib/preferences";

const NAV=[
 {href:"/dashboard",de:"Übersicht",en:"Overview",icon:LayoutDashboard,group:"monitor",admin:false,review:false},
 {href:"/alerts",de:"Sicherheitsmeldungen",en:"Alerts",icon:Bell,group:"monitor",admin:false,review:false},
 {href:"/security-posture",de:"Sicherheitsbewertung",en:"Security posture",icon:ScanSearch,group:"monitor",admin:false,review:false},
 {href:"/entities",de:"Assets & Nutzer",en:"Assets & identities",icon:Network,group:"assets",admin:false,review:false},
 {href:"/endpoints",de:"Live-Endgeräte",en:"Endpoint monitoring",icon:ShieldCheck,group:"assets",admin:false,review:false},
 {href:"/inventory",de:"Software & Inventar",en:"Software inventory",icon:Network,group:"assets",admin:false,review:false},
 {href:"/cases",de:"Vorfälle",en:"Cases",icon:Briefcase,group:"response",admin:false,review:false},
 {href:"/investigations",de:"Untersuchungen",en:"Investigations",icon:Activity,group:"response",admin:false,review:false},
 {href:"/agent-workspace",de:"KI-Agent & Skripte",en:"AI workspace",icon:Bot,group:"response",admin:false,review:false},
 {href:"/soc-academy",de:"SOC Academy",en:"SOC Academy",icon:BookOpen,group:"response",admin:false,review:false},
 {href:"/reviews",de:"Freigaben",en:"Review queue",icon:ClipboardCheck,group:"response",admin:false,review:true},
 {href:"/admin",de:"Verwaltung",en:"Administration",icon:Settings,group:"system",admin:true,review:false},
] as const;

export function Shell({session,children}:{session:SessionClaims;children:React.ReactNode}){
 return <PreferencesProvider><ShellContent session={session}>{children}</ShellContent></PreferencesProvider>;
}
function ShellContent({session,children}:{session:SessionClaims;children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter();
 const {locale,setLocale,appearance,setAppearance,t}=usePreferences();
 const [drawer,setDrawer]=useState(false);
 const [assetsExpanded,setAssetsExpanded]=useState(true);
 const demo=session.tenantId==="11111111-1111-4111-8111-111111111111";
 const items=NAV.filter(x=>x.admin?canAdminister(session.role):x.review?canReview(session.role):true);
 async function signOut(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}
 function nav(group:"monitor"|"assets"|"response"|"system"){
  return items.filter(x=>x.group===group).map(item=>{
   const Icon=item.icon,active=pathname===item.href||pathname.startsWith(item.href+"/");
   return <Link key={item.href} href={item.href} data-active={active} onClick={()=>setDrawer(false)} className="soc-nav-item relative">
    <Icon className="h-[17px] w-[17px] shrink-0"/><span className="truncate">{locale==="de"?item.de:item.en}</span></Link>;
  });
 }
 const sidebar=<>
  <div className="flex h-[73px] items-center gap-3 border-b border-border px-5">
   <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><Shield className="h-6 w-6"/></div>
   <div className="min-w-0"><p className="text-sm font-bold tracking-tight">Sentinel SOC</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{t("Sicherheitsbetrieb","Security operations")}</p></div>
   <button type="button" className="ml-auto lg:hidden" onClick={()=>setDrawer(false)} aria-label={t("Navigation schließen","Close navigation")}><X size={17}/></button>
  </div>
  <div className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
   <div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{t("ÜBERWACHUNG","MONITORING")}</p><nav className="space-y-1">{nav("monitor")}</nav></div>
   <div>
    <button type="button" aria-expanded={assetsExpanded} onClick={()=>setAssetsExpanded(x=>!x)}
      className="mb-2 flex w-full items-center justify-between rounded px-3 py-1 text-left text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground hover:text-foreground">
      {t("ASSETS & SYSTEME","ASSETS & SYSTEMS")}<ChevronsUpDown size={13}/>
    </button>
    {assetsExpanded?<nav aria-label={t("Assets und Systeme","Assets and systems")} className="space-y-1">{nav("assets")}</nav>:null}
   </div>
   <div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{t("ERKENNUNG & REAKTION","DETECTION & RESPONSE")}</p><nav className="space-y-1">{nav("response")}</nav></div>
   {items.some(x=>x.group==="system")?<div><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{t("SYSTEM","SYSTEM")}</p><nav>{nav("system")}</nav></div>:null}
  </div>
  <div className="border-t border-border px-4 py-4">
   <div className="mb-3 rounded-xl bg-muted/45 px-3 py-3">
    <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${demo?"bg-warning":"bg-ok"}`}/><span className="text-xs font-semibold">{demo?t("Demoumgebung","Demo environment"):t("Live-Umgebung","Live environment")}</span></div>
    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{demo?t("Beispieldaten · Keine echten Endgeräte","Sample data · No real endpoints"):t("Wazuh / EDR · Geschützter Bereich","Wazuh / EDR · Private workspace")}</p>
   </div>
   <div className="flex items-center gap-2">
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{session.name.slice(0,2).toUpperCase()}</div>
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{session.name}</p><p className="text-[11px] text-muted-foreground">{session.role}</p></div>
    <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("Abmelden","Sign out")} title={t("Abmelden","Sign out")} onClick={signOut}><LogOut size={17}/></button>
   </div>
  </div>
 </>;
 return <div className="min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
  <aside className="shell-sidebar sticky top-0 hidden h-screen flex-col border-r border-border lg:flex">{sidebar}</aside>
  {drawer?<><div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={()=>setDrawer(false)} aria-hidden/><aside className="shell-sidebar fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-border lg:hidden">{sidebar}</aside></>:null}
  <div className="min-w-0">
   <header className="shell-header sticky top-0 z-30 flex min-h-[73px] flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-7">
    <button type="button" className="rounded-lg border border-border p-2 lg:hidden" onClick={()=>setDrawer(true)} aria-label={t("Navigation öffnen","Open navigation")}><Menu size={18}/></button>
    <div className="min-w-0 flex-1">
     <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck size={13} className="text-accent"/>{t("Sicherheitszentrale","Security operations center")}<span className="opacity-40">/</span></div>
     <h1 className="truncate text-sm font-semibold">{(() => {const x=items.find(i=>pathname===i.href||pathname.startsWith(i.href+"/"));return x?(locale==="de"?x.de:x.en):t("Übersicht","Overview");})()}</h1>
    </div>
    <div className="flex items-center gap-2">
     <div className="soc-toggle" aria-label="Language selector"><Globe size={14} className="ml-1 text-muted-foreground"/><button aria-pressed={locale==="de"} onClick={()=>setLocale("de")}>DE</button><button aria-pressed={locale==="en"} onClick={()=>setLocale("en")}>EN</button></div>
     <div className="soc-toggle" aria-label="Appearance selector"><button title={t("Helles Design","Light mode")} aria-label="Light mode" aria-pressed={appearance==="light"} onClick={()=>setAppearance("light")}><Sun size={15}/></button><button title={t("Dunkles Design","Dark mode")} aria-label="Dark mode" aria-pressed={appearance==="dark"} onClick={()=>setAppearance("dark")}><Moon size={15}/></button></div>
    </div>
   </header>
   <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
  </div>
  <Sentinel role={session.role}/>
 </div>;
}
