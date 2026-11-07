"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import {usePreferences} from "@/lib/preferences";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/severity";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { formatTime, label } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";

const STATUSES = ["", "open", "active", "blocked", "closed"];

export function InvestigationsView() {
  const {t}=usePreferences();
  const [status, setStatus] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const rows = useQuery({
    queryKey: ["investigations", status, cursor],
    queryFn: () => sdk.listInvestigations({ investigation_status: status, limit: 25, cursor }),
  });

  return (
    <div>
      <PageHeader
        title={t("Untersuchungen","Investigations")}
        detail={t("Untersuchungen mit Hypothesen und Status öffnen, um Ereignisverlauf, Meldungen und Agentenanalysen zu prüfen.","Open investigations to review their timeline, linked alerts and agent runs.")}
      />
      <select className="field mb-4 max-w-xs" value={status} onChange={(event) => { setStatus(event.target.value); setCursors([]); }}>
        {STATUSES.map((item) => <option key={item || "all"} value={item}>{item ? label(item) : t("Alle Status","All statuses")}</option>)}
      </select>
      {rows.isLoading ? <LoadingBlock label={t("Untersuchungen werden geladen","Loading investigations")} /> : null}
      {rows.isError ? <ErrorState message={rows.error instanceof ApiClientError ? rows.error.message : "Investigations could not be loaded."} onRetry={() => rows.refetch()} /> : null}
      {rows.data && rows.data.data.length === 0 ? (
        <EmptyState
          title={t("Keine Untersuchungen","No investigations")}
          body={status ? t("Keine Untersuchungen mit diesem Status.","No investigations match this status.") : t("Noch keine Untersuchungen vorhanden.","No investigations have been created yet.")}
        />
      ) : null}
      {rows.data && rows.data.data.length > 0 ? (
        <div className="panel overflow-hidden rounded-lg">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Untersuchung","Investigation")}</th>
                <th>Status</th>
                <th>{t("Priorität","Priority")}</th>
                <th>{t("Zuständig","Assignee")}</th>
                <th>{t("Eröffnet","Opened")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.data.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="font-medium text-accent hover:underline" href={`/investigations/${item.id}`}>{item.title}</Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{item.hypothesis || t("Keine Hypothese erfasst","No hypothesis")}</p>
                  </td>
                  <td><StatusBadge value={item.status} /></td>
                  <td className="uppercase">{item.priority}</td>
                  <td>{item.assignee || t("Nicht zugewiesen","Unassigned")}</td>
                  <td className="font-mono text-xs">{formatTime(item.opened_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {rows.data ? (
        <Pager
          page={cursors.length + 1}
          hasPrevious={cursors.length > 0}
          hasNext={rows.data.page.has_more}
          onPrevious={() => setCursors((items) => items.slice(0, -1))}
          onNext={() => rows.data?.page.next_cursor && setCursors((items) => [...items, rows.data?.page.next_cursor || ""])}
        />
      ) : null}
    </div>
  );
}
