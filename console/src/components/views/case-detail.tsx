"use client";
import {CorrelationAiPanel} from "@/components/views/correlation-ai-panel";

import { useQuery, useQueries } from "@tanstack/react-query";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/severity";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { formatTime } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";

export function CaseDetailView({ caseId }: { caseId: string }) {
  const record = useQuery({ queryKey: ["case", caseId], queryFn: () => sdk.getCase(caseId) });
  const investigations = useQueries({
    queries: (record.data?.investigation_ids ?? []).map((id) => ({
      queryKey: ["investigation", id],
      queryFn: () => sdk.getInvestigation(id),
    })),
  });
  const findings = useQueries({
    queries: (record.data?.finding_ids ?? []).map((id) => ({
      queryKey: ["finding", id],
      queryFn: () => sdk.getFinding(id),
    })),
  });

  if (record.isLoading) return <LoadingBlock label="Loading case" />;
  if (record.isError || !record.data) {
    return <ErrorState message={record.error instanceof ApiClientError ? record.error.message : "Case was not found."} onRetry={() => record.refetch()} />;
  }
  const item = record.data;

  return (
    <div>
      <PageHeader title={item.title} detail={item.description || "No description was stored on this case."} />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge value={item.status} />
        <StatusBadge value={item.severity} />
        <span className="text-sm text-muted-foreground">{item.assignee || "Unassigned"} · opened {formatTime(item.opened_at)}</span>
      </div>
      {item.correlation?<section className="panel mb-4 rounded-xl p-4">
       <h2 className="text-sm font-bold">Automatische Korrelation · Rule + Host + 60 Minuten</h2>
       <p className="mt-2 text-sm text-muted-foreground">{item.correlation.explanation}. {item.correlation.alert_count} miteinander verknüpfte Meldungen auf {item.correlation.hostname}; Regel {item.correlation.rule_id}.</p>
       <p className="mt-2 text-xs text-muted-foreground">Dies ist ein Analysehinweis, kein bestätigter Sicherheitsvorfall. Jeder Beleg lässt sich öffnen.</p>
       <div className="mt-3 flex flex-wrap gap-2">{item.correlation.evidence_alert_ids.slice(0,20).map(id=><Link href={`/alerts/${id}`} key={id} className="rounded border border-border px-2 py-1 font-mono text-xs text-accent">Alert {id.slice(0,8)}</Link>)}</div>
      </section>:null}
      {item.external_ref?.startsWith("CORR-")?<CorrelationAiPanel caseId={caseId}/>:null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel rounded-lg p-4">
          <h2 className="mb-3 text-sm font-medium">Investigations</h2>
          {item.investigation_ids.length === 0 ? <EmptyState title="No investigations" body="This case has no linked investigations." /> : null}
          <ul className="space-y-2">
            {investigations.map((query) => (
              <li key={query.data?.id || "loading"}>
                {query.isLoading ? <p className="text-sm text-muted-foreground">Loading investigation</p> : null}
                {query.data ? (
                  <Link className="block rounded border border-border p-3 hover:border-accent/40" href={`/investigations/${query.data.id}`}>
                    <p className="font-medium">{query.data.title}</p>
                    <p className="text-xs text-muted-foreground">{query.data.status} · {query.data.priority}</p>
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel rounded-lg p-4">
          <h2 className="mb-3 text-sm font-medium">Findings</h2>
          {item.finding_ids.length === 0 ? <EmptyState title="No findings" body="Approval of an investigation draft does not create a finding." /> : null}
          <ul className="space-y-2">
            {findings.map((query) =>
              query.data ? (
                <li key={query.data.id} className="rounded border border-border p-3">
                  <p className="font-medium">{query.data.title}</p>
                  <p className="text-xs text-muted-foreground">{query.data.status} · {query.data.severity} · {formatTime(query.data.created_at)}</p>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
