const base = '/api';

async function j(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `${r.status} ${r.statusText}`);
  }
  return r.json();
}
const post = (path, body) =>
  j(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const api = {
  health: () => j(`${base}/health`),
  state: () => j(`${base}/state`),
  activity: () => j(`${base}/activity`),
  receipt: (id) => j(`${base}/receipt/${id}`),
  quote: (amountIn, dir) => post('/quote', { amountIn: String(amountIn), dir }),
  swap: (amountIn, dir, minOut) =>
    post('/swap', { amountIn: String(amountIn), dir, minOut: minOut ? String(minOut) : undefined }),
};
