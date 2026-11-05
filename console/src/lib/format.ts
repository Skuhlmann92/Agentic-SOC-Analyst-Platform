/** Operator-facing timezone. Store event instants in UTC; render and group them in Europe/Berlin. */
export const SOC_TIME_ZONE = "Europe/Berlin";

export function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: SOC_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short", hourCycle: "h23",
  }).format(date);
}

export function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SOC_TIME_ZONE,year: "numeric",month: "2-digit",day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shortId(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 8);
}

export function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

export function countLabel(count: number, hasMore: boolean) {
  return hasMore ? `${count}+` : String(count);
}
