export const TIMELINE_PRESETS={
  "1h":{label:"1 hour",minutes:60,stepMinutes:1},
  "6h":{label:"6 hours",minutes:360,stepMinutes:5},
  "24h":{label:"24 hours",minutes:1440,stepMinutes:15},
  "7d":{label:"7 days",minutes:10080,stepMinutes:60},
} as const;
export type TimelineRange=keyof typeof TIMELINE_PRESETS;
export type TimelineSeverity="critical"|"high"|"medium"|"low"|"informational"|"unknown";
export const TIMELINE_SEVERITIES:TimelineSeverity[]=["critical","high","medium","low","informational","unknown"];
export type TimelineBucket={timestamp:string;total:number;critical:number;high:number;medium:number;low:number;informational:number;unknown:number};
export type TimelineResponse={range:TimelineRange;step_minutes:number;timezone:"Europe/Berlin";total:number;start:string;end:string;data:TimelineBucket[]};
export function timelineOptions(input:string|null):{range:TimelineRange;step:number;points:number}{
 const range=input&&Object.prototype.hasOwnProperty.call(TIMELINE_PRESETS,input)?input as TimelineRange:"24h";
 const preset=TIMELINE_PRESETS[range];
 return {range,step:preset.stepMinutes,points:preset.minutes/preset.stepMinutes};
}
export function timelineBounds(step:number,points:number,now=Date.now()){
 const stepMs=step*60000;
 const endMs=Math.floor(now/stepMs)*stepMs;
 return {startMs:endMs-(points-1)*stepMs,endMs,stepMs};
}
export function createTimeline(range:TimelineRange,step:number,points:number,raw:Array<{bucket:unknown;severity:unknown;count:unknown}>,now=Date.now()):TimelineResponse{
 const {startMs,endMs,stepMs}=timelineBounds(step,points,now);
 const data:TimelineBucket[]=Array.from({length:points},(_,i)=>({
  timestamp:new Date(startMs+i*stepMs).toISOString(),total:0,critical:0,high:0,medium:0,low:0,informational:0,unknown:0
 }));
 for(const row of raw){
  const time=new Date(String(row.bucket)).getTime();
  if(!Number.isFinite(time)||time<startMs||time>endMs)continue;
  const index=Math.round((time-startMs)/stepMs);
  if(index<0||index>=data.length)continue;
  const key=TIMELINE_SEVERITIES.includes(row.severity as TimelineSeverity)?row.severity as TimelineSeverity:"unknown";
  const count=Number(row.count);
  if(!Number.isFinite(count)||count<0)continue;
  data[index][key]+=count;
  data[index].total+=count;
 }
 return {range,step_minutes:step,timezone:"Europe/Berlin",
  start:new Date(startMs).toISOString(),end:new Date(endMs+stepMs).toISOString(),
  total:data.reduce((sum,item)=>sum+item.total,0),data};
}
