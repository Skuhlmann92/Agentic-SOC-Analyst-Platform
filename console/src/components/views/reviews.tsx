"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { usePreferences } from "@/lib/preferences";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/severity";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatTime, label } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";
import {reviewPriority,sortReviewQueue} from "@/lib/review-priority";

export function ReviewsView() {
  const {t} = usePreferences();
  const [selected, setSelected] = useState("");
  const [hasAutoSelected,setHasAutoSelected] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [bulkIds,setBulkIds] = useState<string[]>([]);
  const [queueOrder,setQueueOrder] = useState<"priority"|"newest">("priority");
  const client = useQueryClient();
  const queue = useQuery({
    queryKey: ["reviews", "pending"],
    queryFn: () => sdk.listDrafts({ status: "pending_approval", limit: 50 }),
  });
  const decided = useQuery({
    queryKey: ["reviews", "decided"],
    queryFn: () => sdk.listDrafts({ limit: 20 }),
  });
  const draft = useQuery({
    queryKey: ["draft", selected],
    queryFn: () => sdk.getDraft(selected),
    enabled: Boolean(selected),
  });
  const decide = useMutation({
    mutationFn: (body: { decision: "approved" | "rejected"; note?: string; intent?: "request_changes" }) =>
      sdk.decide(selected, body),
    onSuccess: async (result) => {
      setError("");
      setNote("");
      setBulkIds([]);
      // Refresh the queue after the server confirms the decision. Navigate only
      // to an actual remaining pending draft, never to an already decided one.
      await client.invalidateQueries({ queryKey: ["reviews"] });
      await client.invalidateQueries({ queryKey: ["draft", result.id] });
      await client.invalidateQueries({ queryKey: ["dashboard"] });
      try {
        const remaining = await client.fetchQuery({
          queryKey: ["reviews", "pending"],
          queryFn: () => sdk.listDrafts({ status: "pending_approval", limit: 50 }),
          staleTime: 0,
        });
        setSelected(sortReviewQueue(remaining.data,queueOrder).find((item) => item.id !== result.id)?.id ?? "");
      } catch {
        // Do not navigate using a stale queue if the refresh failed.
        setSelected("");
        setError(t("Entscheidung gespeichert, aber die Warteschlange konnte nicht aktualisiert werden. Bitte neu laden.","Decision saved, but the pending queue could not be refreshed. Reload the queue to continue."));
      }
    },
    onError: async (reason) => {
      if (reason instanceof ApiClientError && reason.status === 409) {
        // Another reviewer got there first: reload the truth from the server.
        setNote("");
        setError(t("Diese Freigabe wurde bereits von jemand anderem entschieden. Die Liste wurde aktualisiert.","This draft was already decided by another reviewer. The queue has been refreshed."));
        await client.invalidateQueries({ queryKey: ["reviews"] });
        await client.invalidateQueries({ queryKey: ["draft", selected] });
        return;
      }
      setError(reason instanceof ApiClientError ? reason.message : t("Die Entscheidung konnte nicht gespeichert werden.","The decision was not recorded."));
    },
  });

  const pending = sortReviewQueue(queue.data?.data ?? [],queueOrder);
  const selectedInfo = pending.find(item => item.id === selected);
  const grouped = new Map<string, typeof pending>();
  for (const item of pending) {
    const key=item.review_group?.key ?? item.id;
    grouped.set(key,[...(grouped.get(key) ?? []),item]);
  }
  const bulkMembers = pending.filter(item => bulkIds.includes(item.id));
  const validBulk = bulkMembers.length>=2 && bulkMembers.length===bulkIds.length &&
    Boolean(bulkMembers[0]?.review_group?.key) &&
    bulkMembers.every(item => item.review_group?.key===bulkMembers[0]?.review_group?.key);
  const bulk = useMutation({
    mutationFn: (decision:"approved"|"rejected") =>
      sdk.bulkDecide({ids:bulkIds,decision,note}),
    onSuccess: async () => {
      setError("");setNote("");setBulkIds([]);
      await client.invalidateQueries({queryKey:["reviews"]});
      await client.invalidateQueries({queryKey:["dashboard"]});
      const refreshed=await client.fetchQuery({
        queryKey:["reviews","pending"],
        queryFn:()=>sdk.listDrafts({status:"pending_approval",limit:50}),
        staleTime:0
      });
      setSelected(sortReviewQueue(refreshed.data,queueOrder)[0]?.id??"");
    },
    onError: async (reason) => {
      setError(reason instanceof ApiClientError?reason.message:t("Sammelentscheidung fehlgeschlagen.","Bulk decision failed."));
      await client.invalidateQueries({queryKey:["reviews"]});
      setBulkIds([]);
    }
  });

  // Only handle shortcuts when focus is outside interactive elements.
  // A/R always ask for explicit human confirmation, never auto-submit.
  useEffect(() => {
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.repeat||event.altKey||event.ctrlKey||event.metaKey||
         (event.target instanceof HTMLElement && (event.target.isContentEditable||
          ["INPUT","TEXTAREA","SELECT","BUTTON"].includes(event.target.tagName)))||
         document.querySelector('[role="dialog"][aria-modal="true"]')||decide.isPending||bulk.isPending)return;
      const key=event.key.toLowerCase();
      if(key==="n"||key==="p"){
        if(!pending.length)return;
        const index=pending.findIndex(item=>item.id===selected);
        const next=key==="n"?Math.min(index+1,pending.length-1):Math.max(index<0?0:index-1,0);
        event.preventDefault();
        setSelected(pending[next].id);setNote("");setError("");return;
      }
      if((key==="a"||key==="r")&&selected&&draft.data?.status==="pending_approval"){
        event.preventDefault();
        const decision=key==="a"?"approved":"rejected";
        const question=decision==="approved"?
          t("Diese Freigabe genehmigen?","Approve this draft?"):
          t("Diese Freigabe ablehnen?","Reject this draft?");
        if(window.confirm(question))decide.mutate({decision,note});
      }
    };
    window.addEventListener("keydown",onKeyDown);
    return()=>window.removeEventListener("keydown",onKeyDown);
  },[pending,selected,decide,bulk,draft.data?.status,note,t]);

  // Select the first pending draft once; do not override manual navigation.
  useEffect(()=>{
    if(!hasAutoSelected&&pending.length&&!queue.isFetching){
      setHasAutoSelected(true);setSelected(pending[0].id);
    }
  },[hasAutoSelected,pending,queue.isFetching]);

  const history = (decided.data?.data ?? []).filter((item) => item.approval);

  return (
    <div>
      <PageHeader
        title={t("Freigaben","Review queue")}
        detail={t("Freigaben prüfen, genehmigen, ablehnen oder Änderungen anfordern. Jede Entscheidung wird gespeichert. Keine automatische Remediation.","Review drafts, approve, reject or request changes. Each decision is recorded. No automatic remediation.")}
      />
      <p className="mb-3 text-xs text-muted-foreground">{t("Tastatur: A = Genehmigen, R = Ablehnen (mit Bestätigung), N = Nächste, P = Vorherige. In Eingabefeldern deaktiviert.","Keyboard: A = Approve, R = Reject (confirmation required), N = Next, P = Previous. Disabled in input fields.")}</p>
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,2fr)]">
        <section className="panel rounded-lg p-3 xl:sticky xl:top-[90px] xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{t("Offene Freigaben","Pending approval")} · {queue.data?.data.length??"…"}</p>
          {queue.isLoading ? <LoadingBlock label={t("Freigaben werden geladen","Loading reviews")} /> : null}
          {queue.isError ? <ErrorState message={queue.error instanceof ApiClientError ? queue.error.message : t("Die Freigaben konnten nicht geladen werden.","The queue could not be loaded.")} onRetry={() => queue.refetch()} /> : null}
          {queue.data && queue.data.data.length === 0 ? <EmptyState title={t("Keine offenen Freigaben","Queue is clear")} body={t("Es warten keine Freigaben auf eine Entscheidung.","No draft is waiting for a person.")} /> : null}
          <p className="mb-2 text-xs text-muted-foreground">{t("Gruppierungen sind nur Hinweise, keine bestätigten Vorfälle.","Grouping is a suggested correlation, not a confirmed incident.")}</p>
          <div className="mb-3 flex items-center gap-2">
            <label className="text-xs" htmlFor="review-order">{t("Sortierung","Sort by")}</label>
            <select id="review-order" className="field flex-1" value={queueOrder} onChange={e=>setQueueOrder(e.target.value==="newest"?"newest":"priority")}>
              <option value="priority">{t("Heuristische Priorität","Heuristic priority")}</option>
              <option value="newest">{t("Neueste zuerst","Newest first")}</option>
            </select>
          </div>
          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {[...grouped.entries()].map(([key,members]) => (
              <div key={key} className="rounded border border-border p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{members[0].review_group?.label??t("Nicht gruppiert","Ungrouped")} · {members.length}</p>
                  {members.length>1 && members[0].review_group ? (
                    <button className="text-xs text-accent" onClick={()=>setBulkIds(members.slice(0,20).map(x=>x.id))}>
                      Select group
                    </button>
                  ):null}
                </div>
                {members.map(item=>(
                  <div key={item.id} className="flex items-center gap-2">
                    <input type="checkbox" aria-label={`${t("Auswählen","Select")} ${item.title}`} checked={bulkIds.includes(item.id)}
                      onChange={e=>setBulkIds(old=>e.target.checked?[...new Set([...old,item.id])]:old.filter(id=>id!==item.id))}/>
                    <button className={`min-w-0 flex-1 rounded px-2 py-2 text-left text-sm hover:bg-white/5 ${selected===item.id?"bg-accent/10":""}`}
                      onClick={()=>setSelected(item.id)}>
                      <span className="block truncate">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{label(item.severity)} · {formatTime(item.created_at)}</span>
                      <span className="block text-xs text-muted-foreground" title={reviewPriority(item).explanation}>{t("Reihenfolge-Score","Ordering score")}: {reviewPriority(item).score} · {t("kein KI-Risiko-Wert","not an AI risk probability")}</span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {bulkIds.length>0 ? (
            <div className="mt-3 rounded border border-border p-3">
              <p className="text-xs">{t(`${bulkIds.length} ausgewählt. Sammelaktionen benötigen denselben Host, dieselbe Regel, Quelle und Stunde; der Server prüft dies erneut.`,`${bulkIds.length} selected. Bulk actions require the same host, rule, source and one-hour window; the server verifies this again.`)}</p>
              {!validBulk?<p className="mt-1 text-xs text-danger">{t("Mindestens zwei passende offene Freigaben auswählen (maximal 20).","Select at least two matching pending approvals (max 20).")}</p>:null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button disabled={!validBulk||bulk.isPending||decide.isPending} onClick={()=>{
                  if(window.confirm(t(`${bulkIds.length} Freigaben wirklich genehmigen? Jede Entscheidung wird einzeln gespeichert.`,`Approve ${bulkIds.length} selected drafts? Each draft receives a separately recorded decision.`)))bulk.mutate("approved");
                }}>{t("Ausgewählte genehmigen","Approve selected")}</Button>
                <Button variant="danger" disabled={!validBulk||bulk.isPending||decide.isPending} onClick={()=>{
                  if(window.confirm(t(`${bulkIds.length} Freigaben wirklich ablehnen?`,`Reject ${bulkIds.length} selected drafts?`)))bulk.mutate("rejected");
                }}>{t("Ausgewählte ablehnen","Reject selected")}</Button>
                <Button variant="secondary" onClick={()=>setBulkIds([])}>{t("Auswahl aufheben","Clear")}</Button>
              </div>
            </div>
          ):null}
        </section>
        <section className="min-w-0">
          {!selected ? <EmptyState title={t("Freigabe auswählen","Select a draft")} body={t("Eine Freigabe öffnen, Belege prüfen und entscheiden.","Open a pending draft to read its claims and record a decision.")} /> : null}
          {draft.isLoading ? <LoadingBlock label={t("Freigabe wird geladen","Loading draft")} /> : null}
          {draft.data ? (
            <div className="panel rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-medium">{draft.data.title}</h2>
                <StatusBadge value={draft.data.status} />
                <StatusBadge value={draft.data.severity} />
              </div>
              {selectedInfo?.review_advice?(
                <div className="mt-3 rounded border border-border p-3">
                  <p className="text-xs font-semibold uppercase">Belegbasierte Empfehlung · regelbasiert (keine KI-Konfidenz)</p>
                  <p className="mt-1 text-sm font-semibold">{selectedInfo.review_advice.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedInfo.review_advice.reason}</p>
                  <p className="mt-1 text-xs">{t("Belege","Evidence")}: {selectedInfo.review_advice.evidence.map(e=>`${e.kind}:${e.record_id.slice(0,8)}`).join(" · ")||t("Nicht vorhanden","Not available")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("Menschliche Freigabe erforderlich. Dies ist kein bestätigter Fehlalarm.","Human approval required. Never treat this as a confirmed false positive.")}</p>
                </div>
              ):null}
              <p className="mt-2 text-sm text-muted-foreground">{draft.data.notice}</p>
              <p className="mt-3 text-sm">{draft.data.summary}</p>
              <ol className="mt-4 space-y-2">
                {draft.data.claims.map((claim) => (
                  <li key={claim.position} className="rounded border border-border p-3 text-sm">
                    <p>{claim.statement}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {claim.citations.map((citation) => `${citation.kind}:${citation.record_id.slice(0, 8)}`).join(" · ") || "No citation"}
                    </p>
                  </li>
                ))}
              </ol>
              {draft.data.status === "pending_approval" ? (
                <div className="mt-4">
                  <textarea className="field min-h-24 py-2" placeholder={t("Begründung für Ablehnung oder Änderungswunsch","Note for a rejection or a change request")} value={note} onChange={(event) => setNote(event.target.value)} />
                  {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={decide.isPending} onClick={() => decide.mutate({ decision: "approved", note })}>{t("Genehmigen","Approve")}</Button>
                    <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "rejected", note })}>{t("Ablehnen","Reject")}</Button>
                    <Button variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "rejected", intent: "request_changes", note })}>{t("Änderungen anfordern","Request changes")}</Button>
                  </div>
                </div>
              ) : draft.data.approval ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {decisionLabel(draft.data.approval.decision, draft.data.approval.note, t)} {t("von","by")} {draft.data.approval.actor} · {formatTime(draft.data.approval.created_at)}
                  {draft.data.approval.note ? ` · ${visibleNote(draft.data.approval.note)}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium">{t("Letzte Entscheidungen","Recent decisions")}</h2>
        {history.length === 0 ? <EmptyState title={t("Keine Entscheidungen","No decisions")} body={t("Genehmigte und abgelehnte Freigaben erscheinen hier.","Approved and rejected drafts appear here.")} /> : null}
        {history.length > 0 ? (
          <div className="panel overflow-hidden rounded-lg">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("Freigabe","Draft")}</th>
                  <th>{t("Entscheidung","Decision")}</th>
                  <th>{t("Bearbeiter","Actor")}</th>
                  <th>{t("Zeitpunkt","When")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item.id)}>
                    <td>{item.title}</td>
                    <td>{decisionLabel(item.approval?.decision, item.approval?.note, t)}</td>
                    <td>{item.approval?.actor}</td>
                    <td className="font-mono text-xs">{formatTime(item.approval?.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function decisionLabel(decision: string | undefined, note: string | null | undefined,t:(de:string,en:string)=>string) {
  if (note?.startsWith("[changes-requested]")) return t("Änderungen angefordert","Changes requested");
  if (decision === "approved") return t("Genehmigt","Approved");
  if (decision === "rejected") return t("Abgelehnt","Rejected");
  return t("Entschieden","Decided");
}

function visibleNote(note: string) {
  return note.replace(/^\[changes-requested]\n?/, "");
}
