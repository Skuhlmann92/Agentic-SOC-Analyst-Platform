"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/severity";
import { ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatTime, label } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";

export function AlertDetailView({ alertId, liveTriage=false }: { alertId: string; liveTriage?: boolean }) {
  const queryClient=useQueryClient();
  const [saving,setSaving]=useState(false);
  const [triageError,setTriageError]=useState("");
  async function setAlertStatus(next:string) {
    setSaving(true);
    setTriageError("");
    try{
      const response=await fetch("/api/platform/api/v1/alerts/"+encodeURIComponent(alertId)+"/status",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({status:next})
      });
      if(!response.ok)throw new Error("Triage status update failed");
      await queryClient.invalidateQueries({queryKey:["alert",alertId]});
      await queryClient.invalidateQueries({queryKey:["dashboard"]});
      await queryClient.invalidateQueries({queryKey:["alerts"]});
    }catch{setTriageError("Could not update the alert. Please retry.");}
    finally{setSaving(false);}
  }
  const alert = useQuery({ queryKey: ["alert", alertId], queryFn: () => sdk.getAlert(alertId) });
  const event = useQuery({
    queryKey: ["event", alert.data?.canonical_event_id],
    queryFn: () => sdk.getEvent(alert.data?.canonical_event_id || ""),
    enabled: Boolean(alert.data?.canonical_event_id),
  });

  if (alert.isLoading) return <LoadingBlock label="Loading alert" />;
  if (alert.isError) {
    return <ErrorState message={alert.error instanceof ApiClientError ? alert.error.message : "Alert was not found."} onRetry={() => alert.refetch()} />;
  }
  if (!alert.data) return null;
  const row = alert.data;

  return (
    <div>
      <PageHeader title={row.title} detail="Detection record. Running an investigation drafts cited claims and does not change this alert." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={row.severity} />
        <StatusBadge value={row.status} />
        <span className="text-sm text-muted-foreground">{label(row.source)}</span>
        {liveTriage ? (
          <>
            <Button disabled={saving||row.status==="in_review"} onClick={()=>setAlertStatus("in_review")}>Mark in review</Button>
            <Button disabled={saving||row.status==="closed"} onClick={()=>setAlertStatus("closed")}>Close alert</Button>
            <Button disabled={saving||row.status==="suppressed"} onClick={()=>setAlertStatus("suppressed")}>Suppress</Button>
            <Button disabled={saving||row.status==="new"} onClick={()=>setAlertStatus("new")}>Reopen</Button>
          </>
        ) : <span className="text-xs text-muted-foreground">Read-only sample detection</span>}
      </div>
      {triageError ? <p className="mb-3 text-sm text-danger">{triageError}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel rounded-lg p-4">
          <h2 className="text-sm font-medium">Detection</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Field name="Detected" value={formatTime(row.detected_at)} />
            <Field name="Rule" value={row.rule_name || "—"} />
            <Field name="Vendor" value={row.vendor || "—"} />
            <Field name="Product" value={row.product || "—"} />
            <Field name="External id" value={row.external_id || "—"} />
            <Field name="Alert id" value={row.id} mono />
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">{row.description || "No description was stored."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {row.technique_ids.length === 0 ? <span className="text-sm text-muted-foreground">No ATT&CK techniques are associated with this alert.</span> : null}
            {row.technique_ids.map((technique) => (
              <span key={technique} className="rounded border border-accent/30 px-2 py-1 font-mono text-xs text-accent">{technique}</span>
            ))}
            {row.tactics.map((tactic) => (
              <span key={tactic} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">{tactic}</span>
            ))}
          </div>
        </section>
        <section className="panel rounded-lg p-4">
          <h2 className="text-sm font-medium">Linked event</h2>
          {event.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading the canonical event.</p> : null}
          {event.isError ? <p className="mt-3 text-sm text-danger">The linked event could not be loaded.</p> : null}
          {!row.canonical_event_id ? <p className="mt-3 text-sm text-muted-foreground">This alert has no canonical event.</p> : null}
          {event.data?.document?.wazuh_context ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wazuh event details · Windows / decoder / rule</h3>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{JSON.stringify(event.data.document.wazuh_context,null,2)}</pre>
            </div>
          ) : null}
          {event.data ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>{event.data.message}</p>
              <p className="text-muted-foreground">{event.data.class_name} · {event.data.activity_name}</p>
              <p>Host {event.data.hostname || "—"} · User {event.data.username || "—"}</p>
              <p className="font-mono text-xs text-muted-foreground">{formatTime(event.data.event_time)}</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Field({ name, value, mono = false }: { name: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{name}</dt>
      <dd className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1"}>{value}</dd>
    </div>
  );
}
