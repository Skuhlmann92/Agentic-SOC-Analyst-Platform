import {createHash} from "node:crypto";

export type PolicyFinding={code:string;severity:"block"|"review";message:string};
export type ScriptAssessment={
  sha256:string;bytes:number;line_count:number;static_policy:"blocked"|"manual_review_required";
  static_policy_passed:boolean;ast_verified:false;execution_enabled:false;
  findings:PolicyFinding[];checked_at:string;
};

const blockers:Array<[RegExp,string,string]>=[
 [/\b(?:Invoke-Expression|IEX)\b/i,"dynamic_execution","Dynamic PowerShell execution must never be trusted from generated code."],
 [/\b(?:-EncodedCommand|-enc)\b/i,"encoded_execution","Encoded PowerShell payloads are forbidden."],
 [/\b(?:DownloadString|DownloadFile|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|curl(?:\.exe)?|wget(?:\.exe)?)\b/i,"network_fetch","Downloaded or network-fetched content is not permitted in generated remediation."],
 [/\b(?:Add-MpPreference|Set-MpPreference|Remove-MpPreference|Disable-WindowsOptionalFeature|Set-ExecutionPolicy|Unblock-File)\b/i,"security_setting","Changes to security controls and execution policy are blocked."],
 [/\b(?:Remove-Item|Clear-EventLog|wevtutil|Format-Volume|Clear-Disk|Initialize-Disk|bcdedit|diskpart|cipher\.exe)\b/i,"destructive_command","Deletion, event log clearing and disk or boot operations are prohibited."],
 [/\b(?:Restart-Computer|Stop-Computer|shutdown(?:\.exe)?|Restart-Service|Stop-Service)\b/i,"service_disruption","Service interruption and reboot commands require a separate operational plan."],
 [/\b(?:Set-NetFirewallProfile|Disable-NetFirewallRule|New-NetFirewallRule|Set-NetFirewallRule)\b/i,"firewall_change","Firewall modifications require a separate pre-approved playbook."],
 [/\b(?:New-Service|Register-ScheduledTask|schtasks|sc\.exe|New-LocalUser|Add-LocalGroupMember|net(?:\.exe)?\s+(?:user|localgroup))\b/i,"persistence_or_privileges","Changes to services, scheduled tasks or privileges are blocked."],
 [/\b(?:Start-Process|&\s*\$|Invoke-Command|Enter-PSSession|New-PSSession|ScriptBlock::Create|Add-Type|Reflection\.Assembly)\b/i,"indirect_execution","Indirect execution, remote execution and runtime code compilation are blocked."],
 [/\b(?:Invoke-CimMethod|Invoke-WmiMethod|Set-ItemProperty|New-ItemProperty|reg(?:\.exe)?\s+(?:add|delete))\b/i,"system_mutation","System configuration and registry mutations need a separately reviewed procedure."],
 [/\b(?:[A-Za-z0-9-]+\s*\|\s*(?:iex|Invoke-Expression))\b/i,"pipeline_execution","Script piping to dynamic execution is blocked."]
];
const reviewers:Array<[RegExp,string,string]>=[
 [/\b(?:Set-|Enable-|Disable-|Install-|Uninstall-|New-|Remove-|Clear-|Start-)\w+\b/i,"mutating_verb","Potentially mutating command requires explicit review."],
 [/\b(?:try|catch|finally|trap)\b/i,"error_handling","Review exception handling to avoid misleading success output."],
 [/\$env:|\\Users\\|C:\\/i,"environment_specific","Host-specific paths and environment variables need verification."],
 [/\b(?:WhatIf|Confirm)\b/i,"what_if_claim","WhatIf support must be verified on individual commands; it is not a universal dry-run."]
];

export function assessPowerShell(script:string):ScriptAssessment{
 const sha256=createHash("sha256").update(script,"utf8").digest("hex");
 const findings:PolicyFinding[]=[];
 if(!script.trim())findings.push({code:"empty_script",severity:"block",message:"No script to review."});
 if(Buffer.byteLength(script,"utf8")>24000)findings.push({code:"script_too_large",severity:"block",message:"Script exceeds the 24 KB validation limit."});
 if(script.includes("\u0000"))findings.push({code:"null_byte",severity:"block",message:"Unexpected NUL characters in script."});
 for(const [pattern,code,message] of blockers){
  if(pattern.test(script))findings.push({code,severity:"block",message});
 }
 for(const [pattern,code,message] of reviewers){
  if(pattern.test(script))findings.push({code,severity:"review",message});
 }
 // Regex checks are not PowerShell syntax validation, command-resolution, sandboxing or a malware scan.
 return {sha256,bytes:Buffer.byteLength(script,"utf8"),line_count:script.split(/\r?\n/).length,
   static_policy:findings.some(f=>f.severity==="block")?"blocked":"manual_review_required",
   static_policy_passed:!findings.some(f=>f.severity==="block"),ast_verified:false,
   execution_enabled:false,findings,checked_at:new Date().toISOString()};
}
