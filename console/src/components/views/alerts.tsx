"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { usePreferences } from "@/lib/preferences";
import { Pager } from "@/components/pager";
import { StatusBadge } from "@/components/severity";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/states";
import { Button } from "@/components/ui/button";
import { formatTime, label } from "@/lib/format";
import { ApiClientError, sdk } from "@/lib/sdk/client";
import type { FacetBucket } from "@/lib/sdk/types";

const SOURCES = ["", "wazuh", "edr", "sigma_alert", "mock_edr_alert", "windows_event"];
const SEVERITIES = ["", "critical", "high", "medium", "low", "informational", "unknown"];
const STATUSES = ["", "new", "in_review", "closed", "suppressed"];
const SORTS = [
  ["event_time", "Detection time"],
  ["severity", "Severity"],
  ["created_time", "Created time"],
];

export function AlertsView() {
  const router = useRouter();
  const searchParams=useSearchParams();
  const {t} = usePreferences();
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState(searchParams.get("severity")||"");
  const [host, setHost] = useState(searchParams.get("host")||"");
  const [ruleId, setRuleId] = useState(searchParams.get("rule_id")||"");
  const [ruleLevel, setRuleLevel] = useState(searchParams.get("rule_level")||"");
  const [technique, setTechnique] = useState(searchParams.get("technique_id")||"");
  const [from,setFrom]=useState(searchParams.get("from")||"");
  const [to,setTo]=useState(searchParams.get("to")||"");
  const [source, setSource] = useState(searchParams.get("source")||"");
  const [status, setStatus] = useState("");
  const [eventType, setEventType] = useState("");
  const [sort, setSort] = useState("event_time");
  const [cursors, setCursors] = useState<string[]>([]);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [groupsOpen,setGroupsOpen]=useState(false);
  const [facetsOpen,setFacetsOpen]=useState(false);
  const cursor = cursors.at(-1);

  const params = useMemo(
    () => ({ q, severity, source, status, host,rule_id:ruleId,rule_level:ruleLevel,technique_id:technique,from,to,event_type: eventType, sort, limit: 25, cursor }),
    [q, severity, source, status, host,ruleId,ruleLevel,technique,from,to,eventType, sort, cursor],
  );
  const alerts = useQuery({ queryKey: ["alerts", params], queryFn: () => sdk.searchAlerts(params) });
  const correlated = useQuery({queryKey:["alert-groups"],queryFn:()=>sdk.alertGroups()});
  const facets = useQuery({
    queryKey: ["alert-facets", { q, severity, source, eventType }],
    queryFn: () => sdk.facets({ q, severity, source, event_type: eventType }),
  });

  useEffect(()=>{
    const params=new URLSearchParams();
    for(const [k,v] of Object.entries({q,severity,source,status,host,rule_id:ruleId,rule_level:ruleLevel,technique_id:technique,from,to,event_type:eventType})){
      if(v)params.set(k,v);
    }
    const query=params.toString();
    const target=window.location.pathname+(query?"?"+query:"");
    if(window.location.pathname+window.location.search!==target)window.history.replaceState(null,"",target);
  },[q,severity,source,status,host,ruleId,ruleLevel,technique,from,to,eventType]);
  function resetAll(){
    setQ("");setSeverity("");setSource("");setStatus("");setHost("");
    setRuleId("");setRuleLevel("");setTechnique("");setFrom("");setTo("");setEventType("");setCursors([]);
  }
  function resetPage() {
    setCursors([]);
  }

  return (
    <div>
      <PageHeader
        title={t("Sicherheitsmeldungen","Alert explorer")}
        detail={t("Erkennungen nach Schweregrad, Quelle und Status durchsuchen. Filter links verfeinern die Ergebnisse.","Search detections by severity, source and status. Use facets to refine the results.")}
      />
      <div className="mb-4 grid gap-2 md:grid-cols-6">
        <input className="field md:col-span-2" placeholder={t("Meldungen durchsuchen","Search alerts")} value={q} onChange={(event) => { setQ(event.target.value); resetPage(); }} />
        <Select value={severity} onChange={(value) => { setSeverity(value); resetPage(); }} options={SEVERITIES} placeholder={t("Priorität","Severity")} />
        <Select value={source} onChange={(value) => { setSource(value); resetPage(); }} options={SOURCES} placeholder={t("Quelle","Source")} />
        <Select value={status} onChange={(value) => { setStatus(value); resetPage(); }} options={STATUSES} placeholder={t("Status","Status")} />
        <select className="field" value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}>
          {SORTS.map(([value, name]) => (
            <option key={value} value={value}>{value==="event_time"?t("Erkennungszeit","Detection time"):value==="severity"?t("Priorität","Severity"):t("Erstellt","Created time")}</option>
          ))}
        </select>
      </div>
      <div className="panel mb-4 rounded-xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" aria-expanded={advancedOpen} onClick={()=>setAdvancedOpen(v=>!v)} className="text-xs font-bold uppercase tracking-wide text-accent">{advancedOpen?"▾":"▸"} {t("Weitere Filter","More filters")}</button>
          <button type="button" onClick={resetAll} className="text-xs font-semibold text-accent">{t("Alle Filter zurücksetzen","Clear all filters")}</button>
        </div>
        {advancedOpen ? <>
        {from||to?<p className="mb-3 text-xs text-muted-foreground">{t("Zeitbereich (Berlin)","Selected time window (Berlin)")}: {from?formatTime(from):"—"} – {to?formatTime(to):"—"} <button className="ml-3 font-semibold text-accent" onClick={()=>{setFrom("");setTo("");resetPage();}}>{t("Zeitfilter entfernen","Remove time filter")}</button></p>:null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className="field" value={host} onChange={e=>{setHost(e.target.value);resetPage();}} aria-label="Host"><option value="">{t("Alle Endgeräte","All hosts")}</option>{(facets.data?.host||[]).map(h=><option key={h.value} value={h.value}>{h.value}</option>)}</select>
          <input className="field" value={ruleId} placeholder={t("Wazuh-Regel-ID","Wazuh rule ID")} onChange={e=>{setRuleId(e.target.value);resetPage();}}/>
          <select className="field" value={ruleLevel} onChange={e=>{setRuleLevel(e.target.value);resetPage();}} aria-label="Wazuh rule level"><option value="">{t("Alle Regel-Level","All rule levels")}</option>{Array.from({length:16},(_,level)=><option key={level} value={String(level)}>Level {level}</option>)}</select>
          <input className="field" value={technique} placeholder="MITRE ATT&CK ID (T1059)" onChange={e=>{setTechnique(e.target.value);resetPage();}}/>
        </div>
        </> : null}
      </div>
      {correlated.data?.data?.length ? (
        <section className="panel mb-4 rounded-xl p-4">
          <button type="button" aria-expanded={groupsOpen} className="flex w-full items-center justify-between text-left text-sm font-semibold" onClick={()=>setGroupsOpen(v=>!v)}><span>{t("Korrelierte Alarmgruppen","Correlated alert groups")} · {correlated.data.data.length}</span><span className="text-accent">{groupsOpen?"▾":"▸"}</span></button>
          <p className="mb-3 text-xs text-muted-foreground">{t(
            "Unbestätigte Zusammenhänge aus den letzten sieben Tagen (gleicher Host, gleiche Regel, Quelle und Stunde). Keine automatisch erstellten Incidents.",
            "Unconfirmed correlations over seven days (same host, rule, source and hour). Not auto-created incidents."
          )}</p>
          {groupsOpen?<div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {correlated.data.data.slice(0,12).map(group=>(
              <button type="button" key={`${group.host}:${group.rule_id}:${group.source}:${group.bucket}`}
                className="rounded border border-border p-3 text-left text-sm hover:bg-white/5"
                onClick={()=>{
                  const start=Date.parse(group.bucket);
                  if(!Number.isFinite(start))return;
                  setHost(group.host);setRuleId(group.rule_id);setSource(group.source);
                  setFrom(new Date(start).toISOString());setTo(new Date(start+3600000).toISOString());
                  resetPage();
                }}>
                <span className="block font-semibold">{group.count} Alerts · {group.host}</span>
                <span className="block text-xs text-muted-foreground">Rule {group.rule_id} · {group.source} · {formatTime(group.bucket)}</span>
                <span className="mt-1 block text-xs text-accent">{t("Gruppe untersuchen","Investigate group")}</span>
              </button>
            ))}
          </div>:null}
        </section>
      ):null}
      <div className={`grid gap-4 ${facetsOpen?"lg:grid-cols-[220px_minmax(0,1fr)]":"lg:grid-cols-[minmax(0,1fr)]"}`}>
        <aside className="space-y-4">
          <button type="button" className="w-full rounded-lg border border-border p-2 text-left text-xs font-semibold text-accent" onClick={()=>setFacetsOpen(v=>!v)} aria-expanded={facetsOpen}>{facetsOpen?t("Facetten ausblenden","Hide facets"):t("Facetten anzeigen","Show facets")}</button>
          {facetsOpen?<>
          <FacetGroup title={t("Priorität","Severity")} buckets={facets.data?.severity} active={severity} onPick={(value) => { setSeverity(value === severity ? "" : value); resetPage(); }} />
          <FacetGroup title={t("Quelle","Source")} buckets={facets.data?.source} active={source} onPick={(value) => { setSource(value === source ? "" : value); resetPage(); }} />
          <FacetGroup title={t("Ereignistyp","Event type")} buckets={facets.data?.event_type} active={eventType} onPick={(value) => { setEventType(value === eventType ? "" : value); resetPage(); }} />
          <FacetGroup title={t("Endgerät","Host")} buckets={facets.data?.host} active={host} onPick={(value) => {setHost(host===value?"":value);resetPage();}} />
          <FacetGroup title={t("Nutzer","User")} buckets={facets.data?.user} active="" onPick={(value) => router.push(`/entities?type=user&q=${encodeURIComponent(value)}`)} />
          </>:null}
        </aside>
        <section>
          {alerts.isLoading ? <LoadingBlock label={t("Lade Meldungen","Loading alerts")} /> : null}
          {alerts.isError ? (
            <ErrorState message={alerts.error instanceof ApiClientError ? alerts.error.message : "Alerts could not be loaded."} onRetry={() => alerts.refetch()} />
          ) : null}
          {alerts.data && alerts.data.data.length === 0 ? (
            <EmptyState title={t("Keine Meldungen","No alerts")} body={t("Keine Erkennungen entsprechen den Filtern. Bitte Suche oder Auswahl zurücksetzen.","No detections match the current filters. Clear search or selections.")} />
          ) : null}
          {alerts.data && alerts.data.data.length > 0 ? (
            <div className="panel overflow-hidden rounded-lg">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("Meldung","Alert")}</th>
                    <th>{t("Priorität","Severity")}</th>
                    <th>{t("Status","Status")}</th>
                    <th>{t("Endgerät","Host")}</th>
                    <th>{t("Erkannt","Detected")}</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.data.data.map((alert) => (
                    <tr key={alert.id}>
                      <td>
                        <a className="font-medium text-accent hover:underline focus-visible:underline" href={`/alerts/${alert.id}`}>{alert.title}</a>
                        <p className="text-xs text-muted-foreground">{label(alert.source)} · {alert.rule_name || "no rule name"}</p>
                      </td>
                      <td><StatusBadge value={alert.severity} /></td>
                      <td><StatusBadge value={alert.status} /></td>
                      <td>{alert.hostname?<a className="font-semibold text-accent hover:underline" href={`/assets/${encodeURIComponent(alert.hostname)}`}>{alert.hostname}</a>:"—"}</td>
                      <td className="whitespace-nowrap font-mono text-xs">{formatTime(alert.detected_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {alerts.data ? (
            <Pager
              page={cursors.length + 1}
              hasPrevious={cursors.length > 0}
              hasNext={alerts.data.page.has_more}
              onPrevious={() => setCursors((items) => items.slice(0, -1))}
              onNext={() => {
                if (alerts.data?.page.next_cursor) setCursors((items) => [...items, alerts.data.page.next_cursor || ""]);
              }}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option || "all"} value={option}>{option ? label(option) : `All ${placeholder.toLowerCase()}`}</option>
      ))}
    </select>
  );
}

function FacetGroup({
  title,
  buckets,
  active,
  onPick,
}: {
  title: string;
  buckets?: FacetBucket[];
  active: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="panel rounded-lg p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      {!buckets ? <p className="text-xs text-muted-foreground">Loading</p> : null}
      {buckets && buckets.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : null}
      <div className="space-y-1">
        {(buckets ?? []).map((bucket) => (
          <Button
            key={bucket.value}
            variant="ghost"
            size="sm"
            className={`w-full justify-between ${active === bucket.value ? "text-accent" : ""}`}
            onClick={() => onPick(bucket.value)}
          >
            <span className="truncate">{bucket.value}</span>
            <span className="font-mono text-xs">{bucket.count}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
