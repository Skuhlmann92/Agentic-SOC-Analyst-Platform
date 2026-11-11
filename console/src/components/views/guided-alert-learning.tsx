"use client";

import {useState} from "react";
import Link from "next/link";
import {BookOpen,CheckCircle2,ChevronLeft,ChevronRight,Lightbulb,Search,ShieldCheck} from "lucide-react";

import {usePreferences} from "@/lib/preferences";
import {learningFields,learningSteps,type LearningLevel} from "@/lib/guided-learning";
import type {Alert,EventDetail} from "@/lib/sdk/types";

export function GuidedAlertLearning({alert,event}:{alert:Alert;event?:EventDetail|null}) {
  const {locale,t}=usePreferences();
  const [level,setLevel]=useState<LearningLevel>("beginner");
  const [active,setActive]=useState(0);
  const [completed,setCompleted]=useState<number[]>([]);
  const [hintOpen,setHintOpen]=useState(false);
  const [answer,setAnswer]=useState("");
  const steps=learningSteps(alert,event,locale);
  const fields=learningFields(alert,event,locale);
  const current=steps[active];
  const isComplete=completed.includes(active);
  const score=Math.round(completed.length/steps.length*100);
  function move(index:number){
    setActive(Math.max(0,Math.min(index,steps.length-1)));
    setHintOpen(false);
  }
  function toggleComplete(){
    setCompleted(previous=>previous.includes(active)?previous.filter(i=>i!==active):[...previous,active]);
    if(active<steps.length-1)move(active+1);
  }
  return <section aria-labelledby="learning-heading" className="panel mb-4 rounded-xl p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-accent"><BookOpen size={18}/><h2 id="learning-heading" className="text-base font-bold">{t("Geführte Alert-Analyse","Guided alert investigation")}</h2></div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("Lerne direkt mit dieser Meldung: Hypothesen bilden, Ereignisse prüfen und begründete Entscheidungen treffen. Hinweise sind keine bestätigte Angriffsbewertung.","Learn from this alert: form hypotheses, inspect events and make evidence-based decisions. Guidance is not a confirmed attack assessment.")}</p>
      </div>
      <Link className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-accent hover:bg-muted" href="/soc-academy">{t("Zum Lernpfad","Learning path")}</Link>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("Lernstufe","Learning level")}>
      {([
        ["beginner",t("Anfänger","Beginner")],
        ["advanced",t("Fortgeschritten","Advanced")],
        ["expert",t("Experte","Expert")]
      ] as const).map(([value,name])=><button key={value} type="button" aria-pressed={level===value}
        className={"rounded-lg border px-3 py-2 text-sm font-semibold "+(level===value?"border-accent bg-accent/10 text-accent":"border-border text-muted-foreground hover:bg-muted")}
        onClick={()=>setLevel(value)}>{name}</button>)}
    </div>
    <div className="mt-5 flex items-center justify-between gap-2">
      <p className="text-xs font-semibold">{t("Untersuchungsschritte","Investigation steps")} · {completed.length}/{steps.length}</p>
      <span className="text-xs tabular-nums text-muted-foreground">{score}%</span>
    </div>
    <div role="progressbar" aria-label={t("Fortschritt dieser Sitzung","Progress in this session")} aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-accent transition-all" style={{width:score+"%"}}/>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {steps.map((step,i)=><button key={i} type="button" onClick={()=>move(i)}
        aria-label={t("Schritt ","Step ")+(i+1)+": "+step.title}
        aria-current={active===i?"step":undefined}
        className={"inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-semibold "+(active===i?"border-accent bg-accent/10 text-accent":completed.includes(i)?"border-ok/50 text-ok":"border-border text-muted-foreground")}
      >{completed.includes(i)?<CheckCircle2 size={15} aria-hidden/>:i+1}</button>)}
    </div>
    <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t("Aktueller Lernschritt","Current learning step")}</p>
      <h3 className="mt-1 text-base font-bold">{current.title}</h3>
      {level!=="expert"&&<p className="mt-2 text-sm text-muted-foreground">{current.objective}</p>}
      <div className="mt-3 border-l-2 border-accent/50 pl-3 text-sm">{current.action}</div>
      {level==="beginner"&&<div className="mt-3">
        <button type="button" aria-expanded={hintOpen} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline" onClick={()=>setHintOpen(v=>!v)}><Lightbulb size={15}/>{hintOpen?t("Hinweis verbergen","Hide hint"):t("Verständnishilfe anzeigen","Show learning hint")}</button>
        {hintOpen&&<p className="mt-2 rounded-md bg-muted p-3 text-sm">{current.hint}</p>}
      </div>}
      {active===3&&<div className="mt-4 rounded-lg border border-border p-3">
        <p className="text-sm font-semibold">{t("Wissenscheck: Beweist ein hoher Alert-Schweregrad einen erfolgreichen Angriff?","Knowledge check: Does high alert severity prove a successful attack?")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={"rounded-md border px-3 py-2 text-sm "+(answer==="yes"?"border-accent bg-accent/10":"border-border")} onClick={()=>setAnswer("yes")}>{t("Ja","Yes")}</button>
          <button className={"rounded-md border px-3 py-2 text-sm "+(answer==="no"?"border-accent bg-accent/10":"border-border")} onClick={()=>setAnswer("no")}>{t("Nein","No")}</button>
        </div>
        {answer&&<p role="status" className={"mt-2 text-sm "+(answer==="no"?"text-ok":"text-warning")}>{answer==="no"?t("Richtig. Der Schweregrad bewertet die Erkennung; eine Kompromittierung braucht weitere Belege.","Correct. Severity ranks detections; compromise requires further evidence."):t("Nicht ganz. Prüfe beobachtete Ereignisse und Folgeaktivität, bevor du einen Angriffserfolg annimmst.","Not quite. Verify observed events and follow-up activity before concluding success.")}</p>}
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={()=>move(active-1)} disabled={active===0} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"><ChevronLeft size={16}/>{t("Zurück","Back")}</button>
        <button type="button" onClick={toggleComplete} className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-bold text-accent-foreground hover:opacity-90">
          <ShieldCheck size={16}/>{isComplete?t("Als offen markieren","Mark incomplete"):t("Schritt verstanden","Mark understood")}
        </button>
        <button type="button" onClick={()=>move(active+1)} disabled={active===steps.length-1} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40">{t("Weiter","Next")}<ChevronRight size={16}/></button>
      </div>
    </div>
    <details className="mt-4 rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold">{t("Logfelder verstehen","Understand log fields")} ({fields.length})</summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map(field=><div key={field.key} className="rounded-md bg-muted/35 p-3">
          <dt className="text-xs font-bold text-accent">{field.key}</dt>
          <dd className="mt-1 break-all font-mono text-xs">{field.value}</dd>
          <dd className="mt-2 text-xs text-muted-foreground">{field.description}</dd>
        </div>)}
      </dl>
    </details>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href={"/agent-workspace?alert="+encodeURIComponent(alert.id)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-accent hover:bg-muted"><Search size={15}/>{t("Evidenz mit den bestehenden Analysewerkzeugen prüfen","Check evidence in existing investigation tools")}</Link>
      {event?.hostname&&<Link href={"/alerts?host="+encodeURIComponent(event.hostname)} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-accent hover:bg-muted">{t("Weitere Host-Alerts","More alerts for this host")}</Link>}
    </div>
    <p className="mt-4 text-xs text-muted-foreground">{t("Übungsfortschritt nur in dieser Ansicht; keine Speicherung im Benutzerprofil. Übungen ändern weder Alertstatus noch Systeme. Für reale Maßnahmen gelten Rollen, Prüfungen und Freigaben.","Practice progress exists only in this view; no user-profile persistence. Exercises do not change alert status or systems. Real actions still require authorization and review.")}</p>
  </section>;
}
