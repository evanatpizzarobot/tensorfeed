// Generate a fresh Ed25519 keypair for the AFTA receipt signing rail.
//
// Run with: node worker/scripts/generate-receipt-key.mjs
//
// Output:
//   1. The PRIVATE JWK -> paste into:
//      cd worker && wrangler secret put RECEIPT_PRIVATE_KEY_JWK
//   2. The PUBLIC JWK -> overwrite the file at:
//      public/.well-known/tensorfeed-receipt-key.json
//
// Rotation: generate a new keypair, update the secret, ship the new
// public key in a separate commit. Optionally publish both old and new
// keys during a rotation window via /.well-known/tensorfeed-receipt-keys.json
// (plural, JWKS-style). Phase 1 ships single-key only.

import { webcrypto } from 'node:crypto';

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: 'Ed25519' },
  true,
  ['sign', 'verify'],
);

const pubJwk = await webcrypto.subtle.exportKey('jwk', publicKey);
const privJwk = await webcrypto.subtle.exportKey('jwk', privateKey);

// Stable kid (key id): first 16 hex chars of SHA-256(public x).
const xBytes = Buffer.from(pubJwk.x.replace(/-/g, '+').replace(/_/g, '/') + '==', 'base64');
const digest = await webcrypto.subtle.digest('SHA-256', xBytes);
const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
const kid = hex.slice(0, 16);

const enriched = {
  ...pubJwk,
  kid,
  use: 'sig',
  alg: 'EdDSA',
};
const enrichedPriv = {
  ...privJwk,
  kid,
  use: 'sig',
  alg: 'EdDSA',
};

console.log('=== RECEIPT KEYPAIR (Ed25519) ===');
console.log('');
console.log('PRIVATE JWK (paste into: cd worker && wrangler secret put RECEIPT_PRIVATE_KEY_JWK):');
console.log('');
console.log(JSON.stringify(enrichedPriv));
console.log('');
console.log('---');
console.log('');
console.log('PUBLIC JWK (overwrite public/.well-known/tensorfeed-receipt-key.json with the JSON below):');
console.log('');
console.log(JSON.stringify(enriched, null, 2));
console.log('');
console.log('Key id (kid): ' + kid);
console.log('');
console.log('After deploy, verify with:');
console.log('  curl -s https://tensorfeed.ai/api/meta | jq .agent_fair_trade.receipts');
console.log('');
