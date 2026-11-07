import crypto from 'node:crypto';
const e = crypto.createECDH('prime256v1'); e.generateKeys();
console.log(`VAPID_PUBLIC_KEY=${e.getPublicKey().toString('base64url')}\nVAPID_PRIVATE_KEY=${e.getPrivateKey().toString('base64url')}`);
