const url = process.argv[2];
if (!url) {
  console.error('missing_url');
  process.exit(2);
}

(async () => {
  const res = await fetch(url, { redirect: 'manual' });
  const pick = (name) => res.headers.get(name);
  const out = {
    status: res.status,
    location: pick('location'),
    buildId: pick('x-build-id'),
    processId: pick('x-process-id'),
    xFrameOptions: pick('x-frame-options'),
    csp: pick('content-security-policy'),
    debugOrigUrl: pick('x-debug-origurl'),
    debugPath: pick('x-debug-path')
  };
  console.log(JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
