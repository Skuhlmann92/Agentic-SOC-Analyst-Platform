"use client";
import {useState} from "react";
import Link from "next/link";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {BrainCircuit,RefreshCw} from "lucide-react";
import {usePreferences} from "@/lib/preferences";
type Result={conclusion:string;confidence:string;hypotheses:string[];analyst_actions:string[];related_alert_ids:string[];limitations:string;created_at:string;status:string};
async function api(url:string,body?:object):Promise<{data:Result|null}|Result>{
 const r=await fetch(url,body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:undefined);
 const data=await r.json();if(!r.ok)throw Error(data?.error?.message||"API unavailable");return data;
}
export function CorrelationAiPanel({caseId}:{caseId:string}){
 const {t,locale}=usePreferences();
 const qc=useQueryClient();const [error,setError]=useState("");
 const existing=useQuery({queryKey:["correlation-review",caseId],queryFn:async()=>await api("/api/correlation?case_id="+encodeURIComponent(caseId)) as {data:Result|null},retry:false});
 const generate=useMutation({mutationFn:()=>api("/api/correlation",{case_id:caseId,language:locale}),onSuccess:async()=>{setError("");await qc.invalidateQueries({queryKey:["correlation-review",caseId]});},onError:e=>setError(e instanceof Error?e.message:"Claude unavailable")});
 const result=existing.data?.data;
 return <section className="panel mt-5 rounded-xl p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="flex items-center gap-2"><BrainCircuit size={20} className="text-accent"/><h2 className="text-sm font-bold">{t("Claude-Korrelation","Claude correlation review")}</h2></div>
   <button type="button" disabled={generate.isPending} onClick={()=>generate.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-50"><RefreshCw size={14}/>{generate.isPending?t("Analysiere ...","Analyzing ..."):result?t("Neu analysieren","Reanalyze"):t("Mit Claude analysieren","Analyze with Claude")}</button>
  </div>
  <p className="mt-2 text-xs text-muted-foreground">{t("Automatische Regel-Korrelation läuft bereits. Claude ergänzt eine optionale Hypothesenanalyse mit gespeicherten Alert-Belegen. Keine bestätigte Kompromittierung und keine automatischen Eingriffe.","Rule-based correlation runs automatically. Claude adds optional evidence-linked hypotheses, not a confirmed compromise or automated action.")}</p>
  {error?<p role="alert" className="mt-3 rounded-lg border border-danger/30 p-3 text-sm text-danger">{error}</p>:null}
  {result?<div className="mt-4 space-y-4">
   <p className="text-sm font-semibold">{result.conclusion}</p>
   <p className="text-xs text-muted-foreground">{t("Konfidenz","Confidence")}: {result.confidence} · {t("Freigabe nötig","Review required")}</p>
   <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide">{t("Hypothesen","Hypotheses")}</h3><ul className="space-y-1 text-sm">{result.hypotheses.map((v,i)=><li key={i}>• {v}</li>)}</ul></div>
   <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wide">{t("Prüfschritte für Analysten","Analyst verification steps")}</h3><ul className="space-y-1 text-sm">{result.analyst_actions.map((v,i)=><li key={i}>• {v}</li>)}</ul></div>
   <div className="flex flex-wrap gap-2">{result.related_alert_ids.map(id=><Link href={`/alerts/${id}`} key={id} className="rounded border border-border px-2 py-1 font-mono text-xs text-accent">{t("Beleg","Evidence")} {id.slice(0,8)}</Link>)}</div>
   <p className="text-xs text-muted-foreground">{result.limitations}</p>
  </div>:null}
 </section>;
}
