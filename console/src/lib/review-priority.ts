/** Transparent queue ordering using stored fields only; not a calibrated risk/confidence score. */
type DraftLike={id:string;severity:string;created_at:string;review_advice?:{kind:string;evidence?:Array<unknown>}};
const weights:Record<string,number>={critical:80,high:60,medium:40,low:20,informational:5};
export function reviewPriority(item:DraftLike,now=Date.now()){
 const severity=(item.severity||"").toLowerCase();
 const base=weights[severity]??10;
 const ageMs=Date.parse(item.created_at);
 // Older approvals gain a bounded urgency bonus, not false precision.
 const hours=Number.isFinite(ageMs)?Math.max(0,Math.floor((now-ageMs)/3600000)):0;
 const ageBonus=Math.min(15,Math.floor(hours/6));
 const citations=Math.min(5,item.review_advice?.evidence?.length??0);
 const escalation=item.review_advice?.kind==="escalate"?5:0;
 return {score:base+ageBonus+citations+escalation,
   explanation:`Schweregrad: ${severity||"unbekannt"}; Wartezeit: ${hours} h; Belege: ${citations}; Eskalationshinweis: ${escalation?"ja":"nein"}`};
}
export function sortReviewQueue<T extends DraftLike>(items:readonly T[],mode:"priority"|"newest"):T[]{
 return [...items].sort((a,b)=>{
  if(mode==="priority"){const score=reviewPriority(b).score-reviewPriority(a).score;if(score!==0)return score;}
  const ta=Date.parse(a.created_at),tb=Date.parse(b.created_at);
  return (Number.isFinite(tb)?tb:0)-(Number.isFinite(ta)?ta:0)||a.id.localeCompare(b.id);
 });
}
