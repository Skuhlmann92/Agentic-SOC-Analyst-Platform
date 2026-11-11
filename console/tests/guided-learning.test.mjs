import assert from "node:assert/strict";
import {test} from "node:test";
import {learningFields,learningScenario,learningSteps} from "../src/lib/guided-learning.ts";

const base={
  id:"alert-1",tenant_id:"tenant-a",canonical_event_id:"event-1",
  source:"wazuh",external_id:null,title:"Repeated failed SSH logins",
  description:"Several failed authentication events",severity:"high",status:"new",
  rule_id:"5710",rule_name:"Failed SSH login",vendor:"Wazuh",product:"Wazuh",
  technique_ids:[],tactics:[],detected_at:"2026-11-11T11:00:00Z",
  created_at:"2026-11-11T11:00:00Z",updated_at:"2026-11-11T11:00:00Z"
};
const event={
  id:"event-1",source:"wazuh",event_time:"2026-11-11T11:00:00Z",
  class_name:"Authentication",activity_name:"Logon failure",
  severity:"high",outcome:"failure",hostname:"linux-01",username:"alice",
  message:"Failed login attempt",technique_ids:[],document:{}
};

test("SSH and Windows authentication alerts trigger authentication learning questions",()=>{
  assert.equal(learningScenario(base,event),"authentication");
  assert.equal(learningScenario({...base,title:"Windows Event 4625",rule_name:null,description:null},undefined),"authentication");
  const steps=learningSteps(base,event,"de");
  assert.equal(steps.length,6);
  assert.match(steps[2].action,/Anmeldungen/);
  assert.match(steps[3].hint,/Schweregrad/);
});
test("Process events do not masquerade as confirmed compromise",()=>{
  const process={...base,title:"PowerShell process",rule_name:"Suspicious process",description:null};
  assert.equal(learningScenario(process,null),"process");
  assert.match(learningSteps(process,null,"en")[2].action,/parent process/);
});
test("Missing fields are omitted rather than populated with invented values",()=>{
  const fields=learningFields({...base,rule_id:null,rule_name:null},{...event,hostname:null,username:null},"de");
  assert.ok(!fields.some(x=>["Regel-ID","Regelname","Host","Benutzer"].includes(x.key)));
  assert.equal(fields.find(x=>x.key==="Schweregrad")?.value,"high");
});
test("Generic and English guides remain usable with missing linked event",()=>{
  const alert={...base,title:"Custom detection",rule_name:null,description:null};
  assert.equal(learningScenario(alert,null),"generic");
  assert.equal(learningSteps(alert,null,"en").length,6);
  assert.ok(learningSteps(alert,null,"en").every(step=>step.title&&step.action&&step.objective&&step.hint));
});
