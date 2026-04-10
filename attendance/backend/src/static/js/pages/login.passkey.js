import { getLoginOptions, verifyLogin, getRegisterOptions, verifyRegister } from '../api/webauthn.api.js';

const $ = (sel) => document.querySelector(sel);

function toBase64Url(u8) {
  return btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function doLoginWithPasskey() {
  const emailEl = $('#email');
  const email = emailEl ? String(emailEl.value || '').trim() : '';
  if (!email) return;
  const opts = await getLoginOptions(email);
  const publicKey = {
    challenge: fromBase64Url(opts.challenge),
    timeout: opts.timeout || 60000,
    rpId: opts.rpId || opts.rpID,
    userVerification: opts.userVerification || 'preferred',
    allowCredentials: (opts.allowCredentials || []).map(c => ({ type: c.type, id: fromBase64Url(toBase64Url(new Uint8Array(c.id))) }))
  };
  const cred = await navigator.credentials.get({ publicKey });
  const resp = {
    id: cred.id,
    rawId: toBase64Url(new Uint8Array(cred.rawId)),
    type: cred.type,
    response: {
      authenticatorData: toBase64Url(new Uint8Array(cred.response.authenticatorData)),
      clientDataJSON: toBase64Url(new Uint8Array(cred.response.clientDataJSON)),
      signature: toBase64Url(new Uint8Array(cred.response.signature)),
      userHandle: cred.response.userHandle ? toBase64Url(new Uint8Array(cred.response.userHandle)) : null
    }
  };
  const r = await verifyLogin(email, resp);
  sessionStorage.setItem('accessToken', r.accessToken);
  sessionStorage.setItem('user', JSON.stringify({ username: r.username, email: r.email, role: r.role }));
  window.location.replace('/ui/portal');
}

async function doRegisterPasskey() {
  const emailEl = $('#email');
  const email = emailEl ? String(emailEl.value || '').trim() : '';
  if (!email) return;
  const opts = await getRegisterOptions(email);
  const publicKey = {
    challenge: fromBase64Url(opts.challenge),
    rp: { id: opts.rpID || opts.rpId, name: opts.rpName },
    user: {
      id: fromBase64Url(opts.user.id || opts.userID),
      name: opts.user.name || email,
      displayName: opts.user.displayName || email
    },
    pubKeyCredParams: opts.pubKeyCredParams,
    timeout: opts.timeout || 60000,
    attestation: opts.attestation || 'none',
    authenticatorSelection: opts.authenticatorSelection || { residentKey: 'preferred', userVerification: 'preferred' }
  };
  const cred = await navigator.credentials.create({ publicKey });
  const resp = {
    id: cred.id,
    rawId: toBase64Url(new Uint8Array(cred.rawId)),
    type: cred.type,
    response: {
      attestationObject: toBase64Url(new Uint8Array(cred.response.attestationObject)),
      clientDataJSON: toBase64Url(new Uint8Array(cred.response.clientDataJSON)),
      transports: cred.response.getTransports ? cred.response.getTransports() : undefined
    }
  };
  await verifyRegister(email, resp);
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = $('#passkeyBtn');
  if (btn) btn.addEventListener('click', () => { doLoginWithPasskey().catch(e => { const el = document.querySelector('#error'); if (el) { el.textContent = e.message || String(e); el.style.display = 'block'; } }); });
  const emailEl = $('#email');
  if (emailEl) emailEl.addEventListener('change', () => {});
  const reg = $('#registerPasskeyBtn');
  if (reg) reg.addEventListener('click', () => { doRegisterPasskey().catch(e => { const el = document.querySelector('#error'); if (el) { el.textContent = e.message || String(e); el.style.display = 'block'; } }); });
});
