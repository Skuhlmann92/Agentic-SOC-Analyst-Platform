import type {Alert, EventDetail} from "./sdk/types";

export type LearningLevel = "beginner" | "advanced" | "expert";
export type LearningLocale = "de" | "en";
export type LearningStep = {
  title: string;
  objective: string;
  action: string;
  hint: string;
};
export type FieldExplanation = {key:string; value:string; description:string};

export function learningScenario(alert:Alert,event?:EventDetail|null):"authentication"|"process"|"generic" {
  const text=[alert.title,alert.rule_name,alert.description,event?.activity_name,event?.class_name]
    .filter(Boolean).join(" ").toLowerCase();
  if(/ssh|brute.?force|authenticat|anmeld|logon|login|4624|4625|password/.test(text))return "authentication";
  if(/powershell|process|prozess|command.?line|4688|sysmon/.test(text))return "process";
  return "generic";
}

export function learningFields(alert:Alert,event:EventDetail|null|undefined,locale:LearningLocale):FieldExplanation[] {
  const t=(de:string,en:string)=>locale==="de"?de:en;
  const entries:Array<[string,string|null|undefined,string]>= [
    [t("Schweregrad","Severity"),alert.severity,t("Priorisierung der Erkennung; kein Beweis für eine erfolgreiche Kompromittierung.","Detection priority; not proof of a successful compromise.")],
    [t("Quelle","Source"),alert.source,t("Sensor oder Erkennungssystem, das die Meldung erzeugt hat.","Sensor or detection system that produced the alert.")],
    [t("Regel-ID","Rule ID"),alert.rule_id,t("Kennung der Erkennungsregel. Sie beschreibt die Regel, nicht das Ergebnis deiner Untersuchung.","Identifier of a detection rule; not the outcome of your investigation.")],
    [t("Regelname","Rule name"),alert.rule_name,t("Beschreibung der Detektionslogik. Prüfe, ob die ursprünglichen Ereignisse die Regel stützen.","Description of detection logic. Check whether source events support the rule.")],
    [t("Host","Host"),event?.hostname,t("Das protokollierende oder zugeordnete System; nicht zwangsläufig das Ziel eines Angriffs.","The reporting or associated system, not necessarily an attack target.")],
    [t("Benutzer","User"),event?.username,t("Benutzerbezug aus dem Ereignis. Die Identität des tatsächlichen Verursachers kann abweichen.","User reference from the event; actual actor attribution may differ.")],
    [t("Ereignisergebnis","Event outcome"),event?.outcome,t("Technisches Resultat des Ereignisses, nicht automatisch das Resultat des gesamten Vorfalls.","Technical outcome of this event, not necessarily the whole incident.")],
    [t("Ereignistyp","Event class"),event?.class_name,t("Normalisierte Kategorie des gespeicherten Ereignisses.","Normalized category of the stored event.")],
  ];
  return entries.filter((e):e is [string,string,string]=>Boolean(e[1]&&e[1].trim()))
    .map(([key,value,description])=>({key,value,description}));
}

export function learningSteps(alert:Alert,event:EventDetail|null|undefined,locale:LearningLocale):LearningStep[] {
  const t=(de:string,en:string)=>locale==="de"?de:en;
  const scenario=learningScenario(alert,event);
  const specific=scenario==="authentication"?[
    t("Suche nach fehlgeschlagenen und erfolgreichen Anmeldungen auf demselben Host und im selben Zeitfenster.","Look for failed and successful logins on the same host and in the same time window."),
    t("Vergleiche Quell-IP, Zielsystem, Benutzer, Zeitfolge und Authentifizierungsergebnis.","Compare source IP, target system, user, sequence and authentication outcome.")
  ]:scenario==="process"?[
    t("Prüfe Prozessname, Kommandozeile, Elternprozess und ausführenden Benutzer, soweit aufgezeichnet.","Inspect process name, command line, parent process and user, where available."),
    t("Eine auffällige Kommandozeile allein belegt noch keine bösartige Ausführung.","A suspicious command line alone does not prove malicious execution.")
  ]:[
    t("Suche nach weiteren Ereignissen desselben Hosts, Benutzers oder Indikators in zeitlicher Nähe.","Look for nearby events on the same host, user or indicator."),
    t("Vergleiche unabhängige Quellen und markiere fehlende Daten ausdrücklich.","Cross-check independent sources and explicitly flag missing data.")
  ];
  return [
    {title:t("1. Meldung verstehen","1. Understand the alert"),
     objective:t("Unterscheide Erkennungsregel, Schweregrad und beobachtete Aktivität.","Distinguish detection rule, severity and observed activity."),
     action:t("Lies Beschreibung, Regel und verknüpftes Ereignis. Was ist tatsächlich protokolliert?","Read description, rule and linked event. What was actually logged?"),
     hint:t("Eine Meldung ist ein Hinweis. Ihre Beschreibung ist nicht automatisch ein bestätigter Vorfall.","An alert is a signal. Its description does not automatically confirm an incident.")},
    {title:t("2. Hypothesen bilden","2. Form hypotheses"),
     objective:t("Formuliere mindestens eine verdächtige und eine harmlose Erklärung.","Form at least one suspicious and one benign explanation."),
     action:t("Notiere, welche Erklärung die Daten stützen könnten und welche Belege noch fehlen.","Consider which explanation the data could support and what evidence is missing."),
     hint:t("Unterscheide Beobachtung (Loginhalt) von Schlussfolgerung (mögliche Absicht).","Distinguish observation (log contents) from inference (possible intent).")},
    {title:t("3. Zusammenhänge prüfen","3. Check correlations"),
     objective:t("Untersuche weitere Ereignisse, ohne eine Angriffskette zu erfinden.","Investigate additional events without inventing an attack chain."),
     action:specific[0],
     hint:specific[1]},
    {title:t("4. Beweise bewerten","4. Assess evidence"),
     objective:t("Trenne nachgewiesene Fakten von unbelegten Vermutungen.","Separate proven facts from unsupported assumptions."),
     action:t("Welche Event-ID, welcher Zeitstempel und welche Quelle stützen deine Einschätzung?","Which event ID, timestamp and source support your assessment?"),
     hint:t("Ein hoher Schweregrad oder eine MITRE-Zuordnung beweisen keinen Angriffserfolg.","High severity or a MITRE mapping does not prove attacker success.")},
    {title:t("5. Sichere nächste Schritte","5. Safe next steps"),
     objective:t("Priorisiere lesende Diagnose und vermeide voreilige Änderungen.","Prioritize read-only diagnosis and avoid premature changes."),
     action:t("Wähle weitere Prüfungen oder dokumentiere eine begründete Eskalation. Keine automatische Ausführung.","Choose further checks or document a justified escalation. No automatic execution."),
     hint:t("Blockierung, Isolierung und Skriptausführung benötigen eine gesonderte Risikoprüfung und Freigabe.","Blocking, isolation and script execution need separate risk assessment and authorization.")},
    {title:t("6. Erkenntnisse festhalten","6. Capture lessons"),
     objective:t("Formuliere eine begrenzte, prüfbare Schlussfolgerung.","Form a bounded, verifiable conclusion."),
     action:t("Fasse zusammen: Was ist bekannt? Was bleibt offen? Was sollte als Nächstes passieren?","Summarize: What is known? What remains unknown? What should happen next?"),
     hint:t("Wenn Evidenz fehlt, ist 'nicht geklärt' eine korrekte Bewertung.","When evidence is missing, 'unresolved' is a valid assessment.")}
  ];
}
