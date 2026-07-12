// Bridge to a Midnight browser wallet exposing the standard
// @midnight-ntwrk/dapp-connector-api under window.midnight.
//
// Wallets self-register at window.midnight[someKey] = { rdns, name, icon,
// apiVersion, connect(networkId) }. We don't hardcode a key — we scan
// whatever is present so this works with any compliant wallet (1am, Lace, ...).

// Matches the StandaloneConfig networkId used by the local Midnight network
// this dApp is deployed against (see midnight-local-dev/src/config.ts).
export const NETWORK_ID = 'undeployed';

export function listInjectedWallets() {
  const mw = typeof window !== 'undefined' ? window.midnight : undefined;
  if (!mw) return [];
  return Object.entries(mw).map(([key, api]) => ({
    key,
    rdns: api?.rdns ?? key,
    name: api?.name ?? key,
    icon: api?.icon ?? null,
    apiVersion: api?.apiVersion ?? null,
    api,
  }));
}

// Waits briefly for wallets to inject (extensions run after page scripts,
// so window.midnight may not be populated on the very first tick).
export function waitForWallets(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const first = listInjectedWallets();
    if (first.length) return resolve(first);
    const start = Date.now();
    const t = setInterval(() => {
      const found = listInjectedWallets();
      if (found.length || Date.now() - start > timeoutMs) {
        clearInterval(t);
        resolve(found);
      }
    }, 150);
  });
}

// Connects to a specific injected wallet by its window.midnight key.
// Returns { connected: ConnectedAPI, info } or throws with a clear message.
export async function connectWallet(key) {
  const mw = window.midnight;
  if (!mw || !mw[key]) throw new Error(`Wallet "${key}" is not injected — is the extension installed and enabled?`);
  const initial = mw[key];
  let connected;
  try {
    connected = await initial.connect(NETWORK_ID);
  } catch (e) {
    throw new Error(
      `${initial.name || key} rejected the connection for network "${NETWORK_ID}". ` +
      `This dApp runs on a local Midnight node, so the wallet must support connecting to a custom/local network. ` +
      `Original error: ${e?.message || e}`,
    );
  }
  return { connected, info: { key, rdns: initial.rdns, name: initial.name, icon: initial.icon, apiVersion: initial.apiVersion } };
}

export async function readWalletSummary(connected) {
  const [shielded, unshielded, dust, shieldedAddr, unshieldedAddr] = await Promise.all([
    connected.getShieldedBalances(),
    connected.getUnshieldedBalances(),
    connected.getDustBalance(),
    connected.getShieldedAddresses(),
    connected.getUnshieldedAddress(),
  ]);
  return { shielded, unshielded, dust, shieldedAddr: shieldedAddr.shieldedAddress, unshieldedAddr: unshieldedAddr.unshieldedAddress };
}
