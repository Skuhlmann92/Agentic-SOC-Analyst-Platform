"use client";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {usePreferences} from "@/lib/preferences";

type Proposal={
 id:string;hostname:string;mode:"batch"|"single";status:string;
 summary:string;analysis:string;risk:string;powershell:string;verification:string;
 rollback:string;notes:string;requires_reboot:boolean;safety_flags:string[];
 alert_ids:string[];created_at:string;model:string;execution_enabled:boolean;review_note?:string;reviewed_at?:string;needs_ast_validation?:boolean;
};
type Data={data:Proposal[];eligible_hosts:{hostname:string;count:number}[];threshold:number;max_batch:number};
async function request<T>(method:"GET"|"POST",body?:object):Promise<T>{
 const response=await fetch("/api/remediation",{
  method,headers:{accept:"application/json",...(body?{"content-type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const result=await response.json();
 if(!response.ok)throw new Error(result?.error?.message||"Remediation API failed");
 return result as T;
}
export function RemediationPanel({initialAlert=""}:{initialAlert?:string}){
 const qc=useQueryClient();
 const {t}=usePreferences();
 const [alertId,setAlertId]=useState(initialAlert);
 const [host,setHost]=useState("");
 const [selected,setSelected]=useState("");
 const [message,setMessage]=useState("");
 const [reviewNote,setReviewNote]=useState("");
 const [acknowledged,setAcknowledged]=useState(false);
 const listing=useQuery({queryKey:["claude-remediations"],queryFn:()=>request<Data>("GET")});
 const batch=useMutation({mutationFn:(data:object)=>request<Proposal>("POST",data),
  onSuccess:async(data)=>{setSelected(data.id);setMessage("");await qc.invalidateQueries({queryKey:["claude-remediations"]});},
  onError:(error)=>setMessage(error instanceof Error?error.message:"Generation failed")
 });
 const review=useMutation({mutationFn:async(action:"reviewed"|"rejected")=>{
  if(!selectedDraft)throw Error("Select a draft");
  const response=await fetch("/api/remediation/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:selectedDraft.id,action,note:reviewNote,acknowledged})});
  const body=await response.json();if(!response.ok)throw Error(body?.error?.message||"Review failed");return body;
 },onSuccess:async()=>{setAcknowledged(false);setReviewNote("");setMessage("");await qc.invalidateQueries({queryKey:["claude-remediations"]});},
 onError:e=>setMessage(e instanceof Error?e.message:"Review failed")});
 const hosts=listing.data?.eligible_hosts||[];
 useEffect(()=>{if(!host&&hosts.length)setHost(hosts[0].hostname);},[host,hosts]);
 const selectedDraft=(listing.data?.data||[]).find(d=>d.id===selected)||listing.data?.data[0];
 return <section className="mt-6 space-y-4">
  <div className="panel rounded-lg p-4">
   <h2 className="text-base font-semibold">{t("Claude PowerShell-Behebungsagent","Claude PowerShell Remediation Agent")}</h2>
   <p className="mt-1 text-sm text-muted-foreground">{t("KI erstellt Vorschläge. Keine SSH-Ausführung und kein automatischer Eingriff. Wazuh-Level 0–6 können zu einem Skript gebündelt werden. Höhere Level nur als Einzeldiagnose.","Claude drafts proposals only; no SSH execution. Wazuh levels 0–6 may be combined into one script. Higher levels are diagnostics-only.")}</p>
   <div className="mt-4 grid gap-3 md:grid-cols-2">
    <div>
     <label className="text-xs text-muted-foreground">{t("Windows-Host für Sammelbehebung (bis 8 Alerts)","Windows host for batch remediation (up to 8 alerts)")}</label>
     <select className="field mt-1 w-full" value={host} onChange={e=>setHost(e.target.value)}>
      {hosts.length===0?<option value="">{t("Noch keine Level-0–6-Meldungen","No eligible level 0–6 alerts")}</option>:null}
      {hosts.map(h=><option key={h.hostname} value={h.hostname}>{h.hostname} · {h.count} Level-0–6-Alerts</option>)}
     </select>
     <Button className="mt-2 w-full" disabled={!host||batch.isPending||!hosts.some(h=>h.hostname===host&&h.count>=2)}
      onClick={()=>batch.mutate({mode:"batch",hostname:host})}>
       {batch.isPending?t("Claude erstellt das Skript ...","Generating with Claude ..."):t("Sammelskript erstellen","Generate combined script")}
     </Button>
    </div>
    <div>
     <label className="text-xs text-muted-foreground">{t("Einzelnen Alert analysieren (UUID)","Analyze one alert (UUID)")}</label>
     <input className="field mt-1 w-full font-mono" placeholder="Alert-ID" value={alertId} onChange={e=>setAlertId(e.target.value)}/>
     <Button className="mt-2 w-full" variant="secondary" disabled={!alertId.trim()||batch.isPending}
      onClick={()=>batch.mutate({mode:"single",alert_id:alertId.trim()})}>{t("Einzel-Skript erstellen","Generate single script")}</Button>
    </div>
   </div>
   {message?<p className="mt-3 text-sm text-danger" role="alert">{message}</p>:null}
   <p className="mt-3 text-xs text-muted-foreground">{t("Generierte Skripte sind nicht sicherheitsgeprüft. Vor einer manuellen Ausführung Inhalt, Rechte und Rücknahme prüfen. Anzeige oder Speicherung führt nichts auf dem Laptop aus.","Generated scripts are not security validated. Review script behavior, privileges and rollback before any manual execution. Viewing or saving never executes the script.")}</p>
  </div>
  {listing.isLoading?<p className="text-sm text-muted-foreground">{t("Lade Claude-Vorschläge ...","Loading Claude proposals ...")}</p>:null}
  {listing.isError?<p className="text-sm text-danger">{listing.error instanceof Error?listing.error.message:"Vorschläge nicht verfügbar"}</p>:null}
  {(listing.data?.data.length||0)>0?<div className="grid gap-4 lg:grid-cols-[250px_1fr]">
   <div className="panel rounded-lg p-3">
    <h3 className="mb-3 text-sm font-medium">{t("KI-Skriptvorschläge","AI script proposals")}</h3>
    <div className="space-y-2">{listing.data?.data.map(d=><button type="button" key={d.id} onClick={()=>setSelected(d.id)}
     className={`w-full rounded p-2 text-left text-xs hover:bg-white/5 ${selectedDraft?.id===d.id?"bg-accent/10":""}`}>
     <span className="block font-semibold">{d.mode==="batch"?t("Sammelbehebung","Batch remediation"):t("Einzeldiagnose","Single diagnosis")} · {d.hostname}</span>
     <span className="block truncate text-muted-foreground">{d.summary}</span>
    </button>)}</div>
   </div>
   {selectedDraft?<div className="panel min-w-0 rounded-lg p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="text-base font-semibold">{selectedDraft.mode==="batch"?t("Sammel-Skript","Combined script"):t("Einzel-Skript","Single script")} · {selectedDraft.hostname}</h3>
     <span className="text-xs font-medium text-amber-400">{selectedDraft.status==="review_documented"?t("Prüfung dokumentiert · noch nicht AST-validiert","Review documented · AST validation pending"):selectedDraft.status==="rejected"?t("Abgelehnt","Rejected"):selectedDraft.status==="requires_security_review"?t("Zusätzliche Sicherheitsprüfung nötig","Security review required"):t("Manuelle Prüfung erforderlich","Human review required")}</span>
    </div>
    <p className="text-sm">{selectedDraft.summary}</p>
    <p className="text-sm text-muted-foreground">{selectedDraft.analysis}</p>
    <p className="text-xs text-muted-foreground">Claude: {selectedDraft.model} · {selectedDraft.alert_ids.length} Alerts · Risiko: {selectedDraft.risk}</p>
    {selectedDraft.safety_flags.length?<div className="rounded border border-amber-500/40 p-3 text-sm">{t("Sicherheitsindikatoren","Safety flags")}: {selectedDraft.safety_flags.join(", ")}</div>:null}
    <div className="flex items-center justify-between">
     <h4 className="font-medium">{t("Vorgeschlagenes PowerShell-Skript","Proposed PowerShell script")}</h4>
     <Button variant="secondary" onClick={()=>navigator.clipboard.writeText(selectedDraft.powershell)}>{t("Skript kopieren","Copy script")}</Button>
    </div>
    <pre className="overflow-auto rounded border border-border bg-black/40 p-4 text-xs leading-relaxed"><code>{selectedDraft.powershell}</code></pre>
    <div><h4 className="text-sm font-medium">{t("Erfolgskontrolle","Verification")}</h4><pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedDraft.verification}</pre></div>
    <div><h4 className="text-sm font-medium">{t("Rücknahme","Rollback")}</h4><pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedDraft.rollback}</pre></div>
    <p className="text-sm text-muted-foreground">{selectedDraft.notes}</p>
    {selectedDraft.requires_reboot?<p className="text-sm text-amber-400">{t("Claude weist auf einen möglichen Neustart hin. Es wird kein Neustart ausgelöst.","Claude indicates a possible restart. No restart will be triggered.")}</p>:null}
    <div className="rounded-lg border border-border p-4">
     <h4 className="text-sm font-semibold">{t("Prüf- und Audit-Prozess","Human review and audit")}</h4>
     <p className="mt-1 text-xs text-muted-foreground">{t("Der Review dokumentiert eine menschliche Prüfung. Er gibt keine Remote-Ausführung frei. PowerShell-AST-Prüfung, signierter Ausführungsplan und Termalin-Runner fehlen noch.","Review documents a human inspection only, NOT execution approval. PowerShell AST parsing, signed execution plan and Termalin runner are not yet available.")}</p>
     {["awaiting_review","requires_security_review"].includes(selectedDraft.status)?<>
      <textarea className="field mt-3 min-h-20" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder={t("Prüfnotiz oder Ablehnungsgrund","Review note or reason for rejection")}/>
      <label className="mt-2 flex items-start gap-2 text-xs"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} />{t("Ich habe den Skriptinhalt, die Risiken und die vorgesehenen Änderungen selbst geprüft.","I personally inspected the script, risks and proposed changes.")}</label>
      <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={!acknowledged||review.isPending} onClick={()=>review.mutate("reviewed")}>{t("Prüfung dokumentieren","Record review")}</Button><Button variant="secondary" size="sm" disabled={review.isPending} onClick={()=>review.mutate("rejected")}>{t("Vorschlag ablehnen","Reject proposal")}</Button></div>
     </>:<p className="mt-3 text-xs text-muted-foreground">{selectedDraft.reviewed_at?selectedDraft.reviewed_at:""} {selectedDraft.review_note||""}</p>}
    </div>
   </div>:null}
  </div>:null}
 </section>;
}
