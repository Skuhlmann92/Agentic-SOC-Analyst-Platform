"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { RemediationPanel } from "@/components/views/remediation-panel";
import { usePreferences } from "@/lib/preferences";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/severity";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatTime, label } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";
import Link from "next/link";

type ClaudeAlertAnalysis={
 alert_id:string;model:string;created_at:string;source:string;status:string;
 summary:string;assessment:string;severity:string;hypotheses:string[];
 benign_explanations:string[];recommended_checks:string[];
 evidence_alert_ids:string[];limitations:string;evidence_count:number;notice:string
};
import type { Citation, Draft, Run } from "@/lib/sdk/types";

const VALIDATION: Record<string, string> = {
  pending_approval: "Every stored claim matched a reloaded record. A reviewer still has to decide the draft.",
  validation_failed: "At least one claim did not match the stored record. The draft cannot be approved.",
  insufficient_evidence: "The workflow did not produce a citable claim.",
  approved: "A person approved the draft. Canonical records were not changed.",
  rejected: "A person rejected the draft. Canonical records were not changed.",
};

export function WorkspaceView() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading workspace" />}>
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const {t}=usePreferences();
  const search = useSearchParams();
  const router = useRouter();
  const client = useQueryClient();
  const [alertId, setAlertId] = useState(search.get("alert") || "");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [aiResult,setAiResult] = useState<ClaudeAlertAnalysis|null>(null);
  const [aiError,setAiError] = useState("");
  const selected = search.get("run") || "";
  const recentAlerts=useQuery({queryKey:["workspace","selectable-alerts"],queryFn:()=>sdk.searchAlerts({limit:50,sort:"event_time"})});
  const runs = useQuery({ queryKey: ["workspace-runs"], queryFn: () => sdk.listRuns({ limit: 20 }) });
  const run = useQuery({ queryKey: ["run", selected], queryFn: () => sdk.getRun(selected), enabled: Boolean(selected) });
  const analyzeAlert=useMutation({
    mutationFn:async()=>{
      const response=await fetch("/api/alert-ai",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({alert_id:alertId.trim(),language:"de"})
      });
      const body=await response.json() as ClaudeAlertAnalysis&{error?:{message?:string}};
      if(!response.ok)throw new Error(body.error?.message||"KI-Analyse fehlgeschlagen.");
      return body;
    },
    onMutate:()=>{setAiError("");setAiResult(null);},
    onSuccess:result=>setAiResult(result),
    onError:error=>setAiError(error instanceof Error?error.message:"KI-Analyse fehlgeschlagen.")
  });
  const start = useMutation({
    mutationFn: () => sdk.startRun(alertId.trim() ? { alert_id: alertId.trim() } : { question: question.trim() }),
    onSuccess: async (created) => {
      setError("");
      await client.invalidateQueries({ queryKey: ["workspace-runs"] });
      router.replace(`/agent-workspace?run=${created.id}`);
    },
    onError: (reason) => setError(reason instanceof ApiClientError ? reason.message : "The investigation did not start."),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!alertId.trim() && !question.trim()) {
      setError("Provide an alert id or a question.");
      return;
    }
    start.mutate();
  }

  return (
    <div>
      <PageHeader
        title={t("KI-Agent & Skripte","Agent workspace")}
        detail={t("Automatische Analysen überprüfen, Wazuh-Alerts korrelieren und PowerShell-Skriptvorschläge mit Claude erstellen. Keine ungeprüfte Ausführung.","Review automated triage, correlate Wazuh alerts and generate Claude PowerShell proposals. No unreviewed execution.")}
      />
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(235px,0.75fr)_minmax(300px,1fr)_minmax(340px,1.15fr)]">
        <section className="min-w-0 space-y-4 xl:sticky xl:top-[90px] xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto">
          <form className="panel rounded-lg p-4" onSubmit={submit}>
            <h2 className="text-sm font-medium">{t("Untersuchung starten","Run investigation")}</h2>
            <label className="mt-3 block text-xs text-muted-foreground">
              {t("Alert-ID","Alert ID")}
              <select className="field mt-1 w-full" aria-label={t("Sicherheitsmeldung auswählen","Select alert")}
                value={(recentAlerts.data?.data??[]).some(item=>item.id===alertId)?alertId:""}
                onChange={event=>{setAlertId(event.target.value);setQuestion("");setAiResult(null);setAiError("");}}>
                <option value="">{t("Aktuelle Meldung auswählen (optional)","Select a recent alert (optional)")}</option>
                {(recentAlerts.data?.data??[]).map(item=><option key={item.id} value={item.id}>{item.title.slice(0,68)} · {item.hostname||"—"}</option>)}
              </select>
              <input className="field mt-2 font-mono text-xs" aria-label={t("Alert-ID manuell eingeben","Enter alert ID manually")}
                placeholder={t("Oder Alert-ID einfügen","Or paste an alert ID")} value={alertId} onChange={event=>{setAlertId(event.target.value);setAiResult(null);setAiError("");}}/>
              {recentAlerts.isError?<span className="mt-1 block text-xs text-muted-foreground">{t("Alert-Auswahl nicht erreichbar. Die ID-Eingabe funktioniert weiterhin.","Alert list unavailable. You can still paste an ID.")}</span>:null}
            </label>
            <label className="mt-3 block text-xs text-muted-foreground">
              {t("Oder Frage zu gespeicherten Ereignissen","Or a question about stored records")}
              <textarea className="field mt-1 h-20 py-2" value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <Button className="mt-3 w-full" disabled={start.isPending} type="submit">
              {start.isPending ? t("Läuft","Running") : t("Untersuchung ausführen","Run investigation")}
            </Button>
            <Button className="mt-2 w-full" type="button" variant="secondary" disabled={!alertId.trim()||analyzeAlert.isPending}
              onClick={()=>analyzeAlert.mutate()}>
              {analyzeAlert.isPending?t("Claude analysiert den Alert …","Claude is analyzing the alert …"):t("Alert mit Claude analysieren","Analyze alert with Claude")}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">{t("Claude untersucht den Alert und passende Host-Meldungen. Die KI entscheidet und verändert keine Systeme.","Claude examines the alert and related host signals. AI does not decide cases or modify systems.")}</p>
          </form>
          <div className="panel rounded-lg p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t("Letzte Analysen","Recent runs")}</p>
            {runs.isLoading ? <p className="text-sm text-muted-foreground">{t("Analysen werden geladen …","Loading runs …")}</p> : null}
            {runs.data && runs.data.data.length === 0 ? <p className="text-sm text-muted-foreground">{t("Noch keine Analysen vorhanden. Ergebnisse werden als freigabepflichtige Entwürfe gespeichert.","No investigations yet. Drafts require human approval.")}</p> : null}
            <ul className="max-h-[44vh] space-y-1 overflow-y-auto pr-1">
              {(runs.data?.data ?? []).map((item) => (
                <li key={item.id}>
                  <button
                    className={`w-full rounded px-2 py-2 text-left text-sm hover:bg-white/5 ${selected === item.id ? "bg-accent/10" : ""}`}
                    onClick={() => router.replace(`/agent-workspace?run=${item.id}`)}
                  >
                    <span className="block truncate">{item.draft_title || item.question || item.alert_id || "Run"}</span>
                    <span className="text-xs text-muted-foreground">{label(item.status)} · {formatTime(item.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="min-w-0 xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto xl:pr-2">
          <h2 className="mb-3 text-sm font-bold">{t("Analyse und Belege","Investigation and evidence")}</h2>
          {!selected ? <EmptyState title={t("Keine Analyse ausgewählt","No run selected")} body={t("Analyse starten oder aus der Liste auswählen.","Start an investigation or choose a recent run.")} /> : null}
          {run.isLoading ? <LoadingBlock label="Loading run" /> : null}
          {run.isError ? <ErrorState message={run.error instanceof ApiClientError ? run.error.message : "The run could not be loaded."} onRetry={() => run.refetch()} /> : null}
          {aiError?<div role="alert" className="mb-3 rounded-lg border border-danger/30 p-3 text-sm text-danger">{aiError}</div>:null}
          {analyzeAlert.isPending?<LoadingBlock label={t("KI-Analyse läuft","Claude analysis in progress")} />:null}
          {aiResult?<section className="panel mb-4 space-y-3 rounded-xl p-4" aria-label={t("Claude-Analyse","Claude analysis")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
             <h3 className="text-base font-bold">{t("KI-Analyse des Alerts","AI alert analysis")}</h3>
             <span className="rounded border border-warning/40 px-2 py-1 text-xs text-warning">{t("Nicht verifiziert","Unverified draft")}</span>
            </div>
            <p className="text-xs text-muted-foreground">Claude · {aiResult.model} · {formatTime(aiResult.created_at)} · {aiResult.evidence_count} {t("Meldungen berücksichtigt","alerts considered")}</p>
            <h4 className="font-semibold">{t("Zusammenfassung","Summary")}</h4><p className="text-sm">{aiResult.summary}</p>
            <h4 className="font-semibold">{t("Bewertung","Assessment")}</h4><p className="whitespace-pre-wrap text-sm">{aiResult.assessment}</p>
            {([{label:t("Hypothesen","Hypotheses"),items:aiResult.hypotheses},{label:t("Mögliche harmlose Ursachen","Possible benign explanations"),items:aiResult.benign_explanations},{label:t("Nächste Prüfschritte (nur lesend)","Next read-only checks"),items:aiResult.recommended_checks}] as const).map(group=><div key={group.label}><h4 className="mb-1 text-sm font-semibold">{group.label}</h4><ul className="list-disc space-y-1 pl-5 text-sm">{group.items.map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}
            <h4 className="font-semibold">{t("Belegte Meldungen","Cited alerts")}</h4>
            <div className="flex flex-wrap gap-2">{aiResult.evidence_alert_ids.map(id=><Link key={id} className="rounded border border-border px-2 py-1 font-mono text-xs text-accent hover:underline" href={`/alerts/${id}`}>{id.slice(0,12)}</Link>)}</div>
            <p className="text-xs text-muted-foreground">{t("Grenzen der Analyse","Limitations")}: {aiResult.limitations}</p>
            <p className="text-xs text-warning">{t("Ergebnis ist nicht gespeichert und muss durch einen Analysten überprüft werden. Kein Eingriff erfolgt.","Result is not persisted and requires analyst review. No action is taken.")}</p>
          </section>:null}
          {run.data ? <RunPanels run={run.data} /> : null}
        </section>
        <div className="min-w-0 xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto xl:pr-2">
          <RemediationPanel initialAlert={alertId} compact />
        </div>
      </div>
    </div>
  );
}

function RunPanels({ run }: { run: Run }) {
  const draft = run.draft;
  return (
    <div className="space-y-4">
      <section className="panel rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">{draft?.title || "Investigation run"}</h2>
          <StatusBadge value={run.status} />
          {draft ? <StatusBadge value={draft.status} /> : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Requested by {run.requested_by} · {formatTime(run.created_at)}</p>
        {run.error_message ? <p className="mt-2 text-sm text-danger">{run.error_code}: {run.error_message}</p> : null}
        {draft ? <p className="mt-3 text-sm">{draft.notice}</p> : null}
      </section>
      <section className="panel rounded-lg p-4">
        <h2 className="text-sm font-medium">Validation</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {draft ? VALIDATION[draft.status] || draft.summary : "Reporting did not store a draft."}
        </p>
        {draft?.summary ? <p className="mt-2 text-sm">{draft.summary}</p> : null}
      </section>
      <section className="panel rounded-lg p-4">
        <h2 className="text-sm font-medium">Draft</h2>
        {!draft || draft.claims.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No claims were stored.</p> : null}
        <ol className="mt-3 space-y-3">
          {(draft?.claims ?? []).map((claim) => (
            <li key={claim.position} className="rounded border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{claim.template}</p>
              <p className="mt-1 text-sm">{claim.statement}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {claim.citations.map((citation) => (
                  <CitationLink key={`${citation.kind}-${citation.record_id}`} citation={citation} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>
      {draft ? <EvidenceView draft={draft} /> : null}
      <section className="panel rounded-lg p-4">
        <h2 className="mb-3 text-sm font-medium">Agent memory</h2>
        <ol className="space-y-2">
          {run.memory.map((item) => (
            <li key={item.sequence} className="rounded border border-border px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{item.sequence}</span> {label(item.agent)} · {label(item.kind)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CitationLink({ citation }: { citation: Citation }) {
  const href =
    citation.kind === "alert"
      ? `/alerts/${citation.record_id}`
      : citation.kind === "entity"
        ? `/entities/${citation.record_id}`
        : undefined;
  const text = `${citation.kind} ${citation.record_id.slice(0, 8)}`;
  if (!href) return <span className="font-mono text-xs text-muted-foreground">{text}</span>;
  return <a className="font-mono text-xs text-accent" href={href}>{text}</a>;
}

function EvidenceView({ draft }: { draft: Draft }) {
  const evidence = draft.claims.flatMap((claim) => claim.citations).filter((citation) => citation.kind === "evidence");
  const unique = [...new Map(evidence.map((item) => [item.record_id, item])).values()];
  return (
    <section className="panel rounded-lg p-4">
      <h2 className="text-sm font-medium">Evidence</h2>
      <p className="mt-1 text-xs text-muted-foreground">Custody metadata for cited evidence. Raw source bytes are not shown.</p>
      {unique.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">This draft cites no evidence record.</p> : null}
      <div className="mt-3 space-y-3">
        {unique.map((citation) => (
          <EvidenceCard key={citation.record_id} id={citation.record_id} />
        ))}
      </div>
    </section>
  );
}

function EvidenceCard({ id }: { id: string }) {
  const record = useQuery({ queryKey: ["evidence", id], queryFn: () => sdk.getEvidence(id) });
  if (record.isLoading) return <p className="text-sm text-muted-foreground">Loading evidence</p>;
  if (record.isError || !record.data) return <p className="text-sm text-danger">Evidence {id.slice(0, 8)} could not be loaded.</p>;
  const item = record.data;
  return (
    <div className="rounded border border-border p-3 text-sm">
      <p>{item.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label(item.evidence_type)} · {item.byte_size} bytes · {item.collected_by}</p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{item.content_sha256}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{formatTime(item.collected_at)}</p>
    </div>
  );
}
