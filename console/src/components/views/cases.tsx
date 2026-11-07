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

const STATUSES = ["", "open", "investigating", "contained", "recovered", "closed"];

export function CasesView() {
  const {t}=usePreferences();
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const cases = useQuery({
    queryKey: ["cases", status, severity, cursor],
    queryFn: () => sdk.listCases({ case_status: status, severity, limit: 25, cursor }),
  });

  return (
    <div>
      <PageHeader
        title={t("Vorfälle","Case management")}
        detail={t("Vorfälle mit Bearbeitungsstatus, Priorität und verantwortlichem Analysten. Die Übersicht verändert keine Fälle.","Incidents with status, severity and assigned analyst. This view does not modify cases.")}
      />
      <div className="mb-4 flex gap-2">
        <select className="field max-w-xs" value={status} onChange={(event) => { setStatus(event.target.value); setCursors([]); }}>
          {STATUSES.map((item) => <option key={item || "all"} value={item}>{item ? label(item) : t("Alle Status","All statuses")}</option>)}
        </select>
        <select className="field max-w-xs" value={severity} onChange={(event) => { setSeverity(event.target.value); setCursors([]); }}>
          {["", "critical", "high", "medium", "low", "informational", "unknown"].map((item) => (
            <option key={item || "all"} value={item}>{item ? label(item) : t("Alle Schweregrade","All severities")}</option>
          ))}
        </select>
      </div>
      {cases.isLoading ? <LoadingBlock label={t("Vorfälle werden geladen","Loading cases")} /> : null}
      {cases.isError ? <ErrorState message={cases.error instanceof ApiClientError ? cases.error.message : "Cases could not be loaded."} onRetry={() => cases.refetch()} /> : null}
      {cases.data && cases.data.data.length === 0 ? (
        <EmptyState
          title={t("Keine Vorfälle","No cases")}
          body={status || severity ? t("Keine Vorfälle entsprechen den Filtern.","No cases match these filters.") : t("Noch keine Vorfälle angelegt.","No cases have been opened yet.")}
        />
      ) : null}
      {cases.data && cases.data.data.length > 0 ? (
        <div className="panel overflow-hidden rounded-lg">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Vorfall","Case")}</th>
                <th>Status</th>
                <th>{t("Schweregrad","Severity")}</th>
                <th>{t("Zuständig","Assignee")}</th>
                <th>{t("Eröffnet","Opened")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.data.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="font-medium text-accent hover:underline" href={`/cases/${item.id}`}>{item.title}</Link>
                    <p className="text-xs text-muted-foreground">{item.external_ref || t("Keine externe Referenz","No external reference")}</p>
                  </td>
                  <td><StatusBadge value={item.status} /></td>
                  <td><StatusBadge value={item.severity} /></td>
                  <td>{item.assignee || t("Nicht zugewiesen","Unassigned")}</td>
                  <td className="font-mono text-xs">{formatTime(item.opened_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {cases.data ? (
        <Pager
          page={cursors.length + 1}
          hasPrevious={cursors.length > 0}
          hasNext={cases.data.page.has_more}
          onPrevious={() => setCursors((items) => items.slice(0, -1))}
          onNext={() => cases.data?.page.next_cursor && setCursors((items) => [...items, cases.data?.page.next_cursor || ""])}
        />
      ) : null}
    </div>
  );
}
