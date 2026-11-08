import {randomBytes} from 'node:crypto';
const bytes=randomBytes(20), alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let buffer=0,bits=0,base32='';
for(const byte of bytes){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;base32+=alphabet[(buffer>>>bits)&31];buffer &= (1<<bits)-1;}}
if(bits)base32+=alphabet[(buffer<<(5-bits))&31];
console.log('Vercel SOC_ADMIN_TOTP_SECRET_HEX:',bytes.toString('hex'));
console.log('Authenticator setup key:',base32);
console.log('Store both securely; do not commit or send them in chat.');
