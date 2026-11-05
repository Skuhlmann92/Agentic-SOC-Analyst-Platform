"use client";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {ApiClientError} from "@/lib/sdk/client";

type Proposal={
 id:string;hostname:string;mode:"batch"|"single";status:string;
 summary:string;analysis:string;risk:string;powershell:string;verification:string;
 rollback:string;notes:string;requires_reboot:boolean;safety_flags:string[];
 alert_ids:string[];created_at:string;model:string;execution_enabled:boolean;
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
 const [alertId,setAlertId]=useState(initialAlert);
 const [host,setHost]=useState("");
 const [selected,setSelected]=useState("");
 const [message,setMessage]=useState("");
 const listing=useQuery({queryKey:["claude-remediations"],queryFn:()=>request<Data>("GET")});
 const batch=useMutation({mutationFn:(data:object)=>request<Proposal>("POST",data),
  onSuccess:async(data)=>{setSelected(data.id);setMessage("");await qc.invalidateQueries({queryKey:["claude-remediations"]});},
  onError:(error)=>setMessage(error instanceof Error?error.message:"Generation failed")
 });
 const hosts=listing.data?.eligible_hosts||[];
 useEffect(()=>{if(!host&&hosts.length)setHost(hosts[0].hostname);},[host,hosts]);
 const selectedDraft=(listing.data?.data||[]).find(d=>d.id===selected)||listing.data?.data[0];
 return <section className="mt-6 space-y-4">
  <div className="panel rounded-lg p-4">
   <h2 className="text-base font-semibold">Claude PowerShell Remediation Agent</h2>
   <p className="mt-1 text-sm text-muted-foreground">KI erstellt Vorschläge. Keine SSH-Ausführung, kein automatischer Eingriff. Wazuh-Regel-Level 0–6 können zu EINEM Skript für mehrere Probleme zusammengefasst werden. Höhere Level nur einzeln als Diagnoseskript.</p>
   <div className="mt-4 grid gap-3 md:grid-cols-2">
    <div>
     <label className="text-xs text-muted-foreground">Windows-Host für Sammelbehebung (maximal 8 Alerts)</label>
     <select className="field mt-1 w-full" value={host} onChange={e=>setHost(e.target.value)}>
      {hosts.length===0?<option value="">Noch keine passenden Alerts mit Regel-Level 0–6</option>:null}
      {hosts.map(h=><option key={h.hostname} value={h.hostname}>{h.hostname} · {h.count} Level-0–6-Alerts</option>)}
     </select>
     <Button className="mt-2 w-full" disabled={!host||batch.isPending||!hosts.some(h=>h.hostname===host&&h.count>=2)}
      onClick={()=>batch.mutate({mode:"batch",hostname:host})}>
       {batch.isPending?"Claude erstellt das Skript ...":"Mehrere Probleme in einem Skript prüfen/beheben"}
     </Button>
    </div>
    <div>
     <label className="text-xs text-muted-foreground">Einzelnen Alert analysieren (UUID)</label>
     <input className="field mt-1 w-full font-mono" placeholder="Alert-ID" value={alertId} onChange={e=>setAlertId(e.target.value)}/>
     <Button className="mt-2 w-full" variant="secondary" disabled={!alertId.trim()||batch.isPending}
      onClick={()=>batch.mutate({mode:"single",alert_id:alertId.trim()})}>Einzel-Skript erstellen</Button>
    </div>
   </div>
   {message?<p className="mt-3 text-sm text-danger" role="alert">{message}</p>:null}
   <p className="mt-3 text-xs text-muted-foreground">Generierte Skripte sind nicht sicherheitsgeprüft. Vor jeder manuellen Ausführung: Inhalt, Berechtigungen, Seiteneffekte und Rollback prüfen. Das Speichern oder Anzeigen führt nichts auf dem Laptop aus.</p>
  </div>
  {listing.isLoading?<p className="text-sm text-muted-foreground">Lade Claude-Vorschläge ...</p>:null}
  {listing.isError?<p className="text-sm text-danger">{listing.error instanceof Error?listing.error.message:"Vorschläge nicht verfügbar"}</p>:null}
  {(listing.data?.data.length||0)>0?<div className="grid gap-4 lg:grid-cols-[250px_1fr]">
   <div className="panel rounded-lg p-3">
    <h3 className="mb-3 text-sm font-medium">KI-Skriptvorschläge</h3>
    <div className="space-y-2">{listing.data?.data.map(d=><button type="button" key={d.id} onClick={()=>setSelected(d.id)}
     className={`w-full rounded p-2 text-left text-xs hover:bg-white/5 ${selectedDraft?.id===d.id?"bg-accent/10":""}`}>
     <span className="block font-semibold">{d.mode==="batch"?"Sammelbehebung":"Einzeldiagnose"} · {d.hostname}</span>
     <span className="block truncate text-muted-foreground">{d.summary}</span>
    </button>)}</div>
   </div>
   {selectedDraft?<div className="panel min-w-0 rounded-lg p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="text-base font-semibold">{selectedDraft.mode==="batch"?"Sammel-Skript":"Einzel-Skript"} · {selectedDraft.hostname}</h3>
     <span className="text-xs font-medium text-amber-400">{selectedDraft.status==="requires_security_review"?"Zusätzliche Sicherheitsprüfung nötig":"Manuelle Prüfung erforderlich"}</span>
    </div>
    <p className="text-sm">{selectedDraft.summary}</p>
    <p className="text-sm text-muted-foreground">{selectedDraft.analysis}</p>
    <p className="text-xs text-muted-foreground">Claude: {selectedDraft.model} · {selectedDraft.alert_ids.length} Alerts · Risiko: {selectedDraft.risk}</p>
    {selectedDraft.safety_flags.length?<div className="rounded border border-amber-500/40 p-3 text-sm">Sicherheitsindikatoren: {selectedDraft.safety_flags.join(", ")}</div>:null}
    <div className="flex items-center justify-between">
     <h4 className="font-medium">Vorgeschlagenes PowerShell-Skript</h4>
     <Button variant="secondary" onClick={()=>navigator.clipboard.writeText(selectedDraft.powershell)}>Skript kopieren</Button>
    </div>
    <pre className="overflow-auto rounded border border-border bg-black/40 p-4 text-xs leading-relaxed"><code>{selectedDraft.powershell}</code></pre>
    <div><h4 className="text-sm font-medium">Erfolgskontrolle</h4><pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedDraft.verification}</pre></div>
    <div><h4 className="text-sm font-medium">Rücknahme</h4><pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedDraft.rollback}</pre></div>
    <p className="text-sm text-muted-foreground">{selectedDraft.notes}</p>
    {selectedDraft.requires_reboot?<p className="text-sm text-amber-400">Claude weist auf einen möglichen Neustart hin. Es wird kein Neustart ausgelöst.</p>:null}
   </div>:null}
  </div>:null}
 </section>;
}
