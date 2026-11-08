import {createHmac, timingSafeEqual} from "node:crypto";

// The key is a random 20–64 byte hexadecimal value provisioned outside the app.
export function matchingTotpStep(secretHex:string, code:string, now=Date.now()):number|null {
 if(!/^(?:[0-9a-fA-F]{2}){20,64}$/.test(secretHex)||!/^\d{6}$/.test(code))return null;
 const secret=Buffer.from(secretHex,"hex"), current=Math.floor(now/30000);
 for(const step of [current-1,current,current+1]) {
  if(step<0)continue;
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
  const digest=createHmac("sha1",secret).update(counter).digest(),offset=digest[digest.length-1]&15;
  const expected=String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
  if(timingSafeEqual(Buffer.from(expected),Buffer.from(code)))return step;
 }
 return null;
}
