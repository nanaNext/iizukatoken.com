export async function postJSON(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || String(res.status));
  }
  return await res.json();
}

export async function getLoginOptions(email) {
  return await postJSON('/api/webauthn/login/options', { email });
}

export async function verifyLogin(email, response) {
  return await postJSON('/api/webauthn/login/verify', { email, response });
}

export async function getRegisterOptions(email) {
  return await postJSON('/api/webauthn/register/options', { email });
}

export async function verifyRegister(email, response) {
  return await postJSON('/api/webauthn/register/verify', { email, response });
}
