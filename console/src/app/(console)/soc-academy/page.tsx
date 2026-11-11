"use client";

import Link from "next/link";
import {BookOpen,ArrowRight,ShieldCheck,Info} from "lucide-react";
import {PageHeader} from "@/components/page-header";
import {usePreferences} from "@/lib/preferences";

const modules=[
 {id:"01",de:"Alerts und Logfelder verstehen",en:"Understand alerts and log fields",
  deText:"Lerne Schweregrad, Regel-ID, Ereigniszeit, Host und Benutzer zu unterscheiden. Prüfe immer die Originaldaten.",
  enText:"Learn to distinguish severity, rule ID, event time, host and user. Always check the original data.",
  deTask:"Öffne einen Alert und erkläre drei Felder mit eigenen Worten.",
  enTask:"Open an alert and explain three fields in your own words.",href:"/alerts"},
 {id:"02",de:"Anmeldungen und Netzwerkereignisse",en:"Authentication and network events",
  deText:"Untersuche SSH, Loginversuche und mögliche Brute-Force-Muster. Eine fehlgeschlagene Anmeldung ist kein nachgewiesener Einbruch.",
  enText:"Investigate SSH, login attempts and possible brute-force patterns. A failed login is not proof of compromise.",
  deTask:"Suche für einen Host nach zusammengehörigen Loginereignissen.",
  enTask:"Find related login events for one host.",href:"/alerts?source=wazuh"},
 {id:"03",de:"Windows, Linux und Prozesse",en:"Windows, Linux and processes",
  deText:"Lerne Prozessketten, Dienständerungen und typische Authentifizierungsereignisse zu lesen. Prüfe Elternprozess und Kontext.",
  enText:"Learn to read process chains, service changes and authentication events. Review parent processes and context.",
  deTask:"Unterscheide eine protokollierte Prozessausführung von einer bloßen Verdachtsmeldung.",
  enTask:"Distinguish a logged process execution from a suspicion.",href:"/alerts?source=windows_event"},
 {id:"04",de:"Korrelation und Angriffshypothesen",en:"Correlation and attack hypotheses",
  deText:"Verbinde passende Ereignisse über Host, Zeit und Benutzer. Erkenne auch Datenlücken und alternative Erklärungen.",
  enText:"Connect related events by host, time and user. Identify data gaps and alternative explanations.",
  deTask:"Formuliere zwei Hypothesen für denselben Alert und nenne die erforderlichen Belege.",
  enTask:"Form two hypotheses for one alert and identify required evidence.",href:"/agent-workspace"},
 {id:"05",de:"Incident Response und Dokumentation",en:"Incident response and documentation",
  deText:"Übe Triage, begründete Eskalation und sichere nächste Schritte, bevor Maßnahmen freigegeben werden.",
  enText:"Practice triage, justified escalation and safe next steps before approving actions.",
  deTask:"Schreibe eine kurze Zusammenfassung mit Fakten, Unsicherheiten und Handlungsempfehlung.",
  enTask:"Write a brief summary of facts, uncertainties and next actions.",href:"/cases"},
] as const;

export default function SocAcademyPage(){
 const {locale,t}=usePreferences();
 return <div>
   <PageHeader title="SOC Academy" detail={t("Lerne Security Operations direkt mit den Alerts deiner Plattform – ohne separate Trainingsumgebung.","Learn security operations using your platform alerts, without a separate training environment.")}/>
   <section className="panel mb-5 rounded-xl p-4 sm:p-5">
     <div className="flex items-start gap-3">
       <BookOpen className="mt-1 shrink-0 text-accent" size={23}/>
       <div>
         <h2 className="text-base font-semibold">{t("Dein praxisnaher Lernpfad","Your hands-on learning path")}</h2>
         <p className="mt-2 text-sm text-muted-foreground">{t("Beginne bei den Grundlagen und übe in echten Alert-Ansichten. Die Aufgaben sind freiwillig und verändern keine produktiven Sicherheitsdaten.","Start with the basics and practice in real alert views. Exercises are optional and do not modify production security data.")}</p>
       </div>
     </div>
     <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
       <Info className="shrink-0 text-accent" size={16}/>
       <p>{t("Version 1: Die Module sind als Lernpfad verfügbar. Dein Bearbeitungsstand ist noch nicht kontogebunden gespeichert, es werden keine künstlichen Fortschrittswerte angezeigt. Simulierte Trainingsfälle und persönliche Lernstatistiken folgen in einer späteren Ausbaustufe.","Version 1: Modules provide a learning path. Completion is not yet saved to an account; no simulated progress is displayed. Synthetic exercises and personal metrics are planned for a later release.")}</p>
     </div>
   </section>
   <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
     {modules.map(m=><section key={m.id} className="panel flex h-full flex-col rounded-xl p-4">
       <div className="flex items-center justify-between">
         <span className="rounded-md bg-accent/10 px-2 py-1 font-mono text-xs font-bold text-accent">{t("Modul","Module")} {m.id}</span>
         <ShieldCheck size={17} className="text-muted-foreground"/>
       </div>
       <h2 className="mt-3 text-base font-bold">{locale==="de"?m.de:m.en}</h2>
       <p className="mt-2 flex-1 text-sm text-muted-foreground">{locale==="de"?m.deText:m.enText}</p>
       <div className="mt-4 rounded-md bg-muted/35 p-3">
         <p className="text-xs font-semibold">{t("Praxisaufgabe","Practice task")}</p>
         <p className="mt-1 text-sm">{locale==="de"?m.deTask:m.enTask}</p>
       </div>
       <Link href={m.href} className="mt-4 inline-flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold text-accent hover:bg-muted">
         {t("Mit Meldungen üben","Practice with alerts")} <ArrowRight size={16}/>
       </Link>
     </section>)}
   </div>
 </div>;
}
