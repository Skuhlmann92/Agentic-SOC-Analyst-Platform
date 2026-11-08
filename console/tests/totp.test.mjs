import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchingTotpStep} from '../src/lib/totp.ts';
// RFC 6238 SHA-1 test vector, reduced to six digits, at 59 seconds.
const secret=Buffer.from('12345678901234567890').toString('hex');
test('accepts RFC time-based vector',()=>assert.equal(matchingTotpStep(secret,'287082',59000),1));
test('accepts adjacent step and rejects expired or malformed values',()=>{
 assert.equal(matchingTotpStep(secret,'287082',90000),null);
 assert.equal(matchingTotpStep(secret,'287082',60000),1);
 assert.equal(matchingTotpStep(secret,'28708a',59000),null);
 assert.equal(matchingTotpStep('00','287082',59000),null);
});
