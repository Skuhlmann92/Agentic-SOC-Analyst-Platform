"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/severity";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatTime, label } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";

export function ReviewsView() {
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [bulkIds,setBulkIds] = useState<string[]>([]);
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
        setSelected(remaining.data.find((item) => item.id !== result.id)?.id ?? "");
      } catch {
        // Do not navigate using a stale queue if the refresh failed.
        setSelected("");
        setError("Decision saved, but the pending queue could not be refreshed. Reload the queue to continue.");
      }
    },
    onError: async (reason) => {
      if (reason instanceof ApiClientError && reason.status === 409) {
        // Another reviewer got there first: reload the truth from the server.
        setNote("");
        setError("This draft was already decided by another reviewer. The queue has been refreshed.");
        await client.invalidateQueries({ queryKey: ["reviews"] });
        await client.invalidateQueries({ queryKey: ["draft", selected] });
        return;
      }
      setError(reason instanceof ApiClientError ? reason.message : "The decision was not recorded.");
    },
  });

  const pending = queue.data?.data ?? [];
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
      setSelected(refreshed.data[0]?.id??"");
    },
    onError: async (reason) => {
      setError(reason instanceof ApiClientError?reason.message:"Bulk decision failed.");
      await client.invalidateQueries({queryKey:["reviews"]});
      setBulkIds([]);
    }
  });

  const history = (decided.data?.data ?? []).filter((item) => item.approval);

  return (
    <div>
      <PageHeader
        title="Review queue"
        detail="A reviewer approves, rejects, or requests changes. Request changes records a rejection with your note. No canonical record is changed."
      />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <section className="panel rounded-lg p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Pending approval</p>
          {queue.isLoading ? <LoadingBlock label="Loading reviews" /> : null}
          {queue.isError ? <ErrorState message={queue.error instanceof ApiClientError ? queue.error.message : "The queue could not be loaded."} onRetry={() => queue.refetch()} /> : null}
          {queue.data && queue.data.data.length === 0 ? <EmptyState title="Queue is clear" body="No draft is waiting for a person." /> : null}
          <p className="mb-2 text-xs text-muted-foreground">Grouping is a suggested correlation, not a confirmed incident.</p>
          <div className="space-y-3">
            {[...grouped.entries()].map(([key,members]) => (
              <div key={key} className="rounded border border-border p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{members[0].review_group?.label??"Ungrouped"} · {members.length}</p>
                  {members.length>1 && members[0].review_group ? (
                    <button className="text-xs text-accent" onClick={()=>setBulkIds(members.slice(0,20).map(x=>x.id))}>
                      Select group
                    </button>
                  ):null}
                </div>
                {members.map(item=>(
                  <div key={item.id} className="flex items-center gap-2">
                    <input type="checkbox" aria-label={`Select ${item.title}`} checked={bulkIds.includes(item.id)}
                      onChange={e=>setBulkIds(old=>e.target.checked?[...new Set([...old,item.id])]:old.filter(id=>id!==item.id))}/>
                    <button className={`min-w-0 flex-1 rounded px-2 py-2 text-left text-sm hover:bg-white/5 ${selected===item.id?"bg-accent/10":""}`}
                      onClick={()=>setSelected(item.id)}>
                      <span className="block truncate">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{label(item.severity)} · {formatTime(item.created_at)}</span>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {bulkIds.length>0 ? (
            <div className="mt-3 rounded border border-border p-3">
              <p className="text-xs">{bulkIds.length} selected. Bulk actions require the same host, rule, source and one-hour window; the server verifies this again.</p>
              {!validBulk?<p className="mt-1 text-xs text-danger">Select at least two matching pending approvals (max 20).</p>:null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button disabled={!validBulk||bulk.isPending||decide.isPending} onClick={()=>{
                  if(window.confirm(`Approve ${bulkIds.length} selected drafts? Each draft receives a separately recorded decision.`))bulk.mutate("approved");
                }}>Approve selected</Button>
                <Button variant="danger" disabled={!validBulk||bulk.isPending||decide.isPending} onClick={()=>{
                  if(window.confirm(`Reject ${bulkIds.length} selected drafts?`))bulk.mutate("rejected");
                }}>Reject selected</Button>
                <Button variant="secondary" onClick={()=>setBulkIds([])}>Clear</Button>
              </div>
            </div>
          ):null}
        </section>
        <section>
          {!selected ? <EmptyState title="Select a draft" body="Open a pending draft to read its claims and record a decision." /> : null}
          {draft.isLoading ? <LoadingBlock label="Loading draft" /> : null}
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
                  <p className="mt-1 text-xs">Evidence: {selectedInfo.review_advice.evidence.map(e=>`${e.kind}:${e.record_id.slice(0,8)}`).join(" · ")||"Not available"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Human approval required. Never treat this as a confirmed false positive.</p>
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
                  <textarea className="field h-20 py-2" placeholder="Note for a rejection or a change request" value={note} onChange={(event) => setNote(event.target.value)} />
                  {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={decide.isPending} onClick={() => decide.mutate({ decision: "approved", note })}>Approve</Button>
                    <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "rejected", note })}>Reject</Button>
                    <Button variant="secondary" disabled={decide.isPending} onClick={() => decide.mutate({ decision: "rejected", intent: "request_changes", note })}>Request changes</Button>
                  </div>
                </div>
              ) : draft.data.approval ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {decisionLabel(draft.data.approval.decision, draft.data.approval.note)} by {draft.data.approval.actor} · {formatTime(draft.data.approval.created_at)}
                  {draft.data.approval.note ? ` · ${visibleNote(draft.data.approval.note)}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium">Recent decisions</h2>
        {history.length === 0 ? <EmptyState title="No decisions" body="Approved and rejected drafts appear here." /> : null}
        {history.length > 0 ? (
          <div className="panel overflow-hidden rounded-lg">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Draft</th>
                  <th>Decision</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} onClick={() => setSelected(item.id)}>
                    <td>{item.title}</td>
                    <td>{decisionLabel(item.approval?.decision, item.approval?.note)}</td>
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

function decisionLabel(decision: string | undefined, note: string | null | undefined) {
  if (note?.startsWith("[changes-requested]")) return "Changes requested";
  if (decision === "approved") return "Approved";
  if (decision === "rejected") return "Rejected";
  return "Decided";
}

function visibleNote(note: string) {
  return note.replace(/^\[changes-requested]\n?/, "");
}
