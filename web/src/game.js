/* DarkPool gamification — XP, ranks, streaks, achievements.
   Pure logic + localStorage persistence; UI lives in App.jsx. */

const KEY = 'darkpool-game-v1';
const STREAK_WINDOW_MS = 3 * 60 * 1000; // swaps within 3 min keep the combo alive
const ACH_XP = 75;

export const RANKS = [
  { name: 'Watcher', xp: 0, note: 'Everyone starts in the open.' },
  { name: 'Cipher', xp: 150, note: 'Your first trades vanish into proofs.' },
  { name: 'Phantom', xp: 400, note: 'Bots can no longer read you.' },
  { name: 'Shadow Broker', xp: 900, note: 'You move size without a ripple.' },
  { name: 'Night Whale', xp: 1800, note: 'Deep liquidity, zero footprint.' },
  { name: 'Midnight Legend', xp: 3200, note: 'The pool remembers no one — except you.' },
];

export const ACHIEVEMENTS = [
  { id: 'first-shadow', name: 'First Shadow', desc: 'Settle your first private swap', icon: 'eyeoff', check: (s) => s.swaps >= 1 },
  { id: 'serial-cipher', name: 'Serial Cipher', desc: 'Settle 5 private swaps', icon: 'bolt', check: (s) => s.swaps >= 5 },
  { id: 'dark-dozen', name: 'Dark Dozen', desc: 'Settle 12 private swaps', icon: 'bolt', check: (s) => s.swaps >= 12 },
  { id: 'two-way-mirror', name: 'Two-Way Mirror', desc: 'Swap in both directions', icon: 'swap', check: (s) => s.dirs.AtoB && s.dirs.BtoA },
  { id: 'night-whale', name: 'Night Whale', desc: 'Hide a single swap of 500,000+', icon: 'coins', check: (s) => s.maxSwap >= 500000 },
  { id: 'million-mover', name: 'Million Mover', desc: 'Move 1,000,000 in lifetime volume', icon: 'coins', check: (s) => s.volume >= 1000000 },
  { id: 'bot-starver', name: 'Bot Starver', desc: 'Protect 50,000+ est. value from MEV', icon: 'shield', check: (s) => s.mev >= 50000 },
  { id: 'combo-cloak', name: 'Combo Cloak', desc: 'Chain 3 swaps within 3 minutes each', icon: 'bolt', check: (s) => s.streakBest >= 3 },
  { id: 'open-book', name: 'Open Book', desc: 'Open a selective-disclosure receipt', icon: 'doc', check: (s) => s.receipts >= 1 },
];

const fresh = () => ({
  xp: 0,
  stats: { swaps: 0, volume: 0, maxSwap: 0, dirs: { AtoB: false, BtoA: false }, mev: 0, streak: 0, streakBest: 0, receipts: 0, lastSwapAt: 0 },
  unlocked: {}, // id -> unlock timestamp
});

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw), stats: { ...fresh().stats, ...JSON.parse(raw).stats } };
  } catch {}
  return fresh();
}

export function saveGame(g) {
  try { localStorage.setItem(KEY, JSON.stringify(g)); } catch {}
}

export function rankFor(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1] || null;
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { rank, next, level: i + 1, progress };
}

function checkUnlocks(g) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!g.unlocked[a.id] && a.check(g.stats)) {
      g.unlocked[a.id] = Date.now();
      g.xp += ACH_XP;
      unlocked.push(a);
    }
  }
  return unlocked;
}

/* Returns { next, gainedXp, unlocked: [achievement], rankUp: rank|null } */
export function applySwap(prev, { amountIn, dir, mev }) {
  const g = { ...prev, stats: { ...prev.stats, dirs: { ...prev.stats.dirs } }, unlocked: { ...prev.unlocked } };
  const before = rankFor(g.xp).level;
  const now = Date.now();

  const s = g.stats;
  s.streak = now - s.lastSwapAt <= STREAK_WINDOW_MS ? s.streak + 1 : 1;
  s.streakBest = Math.max(s.streakBest, s.streak);
  s.lastSwapAt = now;
  s.swaps += 1;
  s.volume += amountIn;
  s.maxSwap = Math.max(s.maxSwap, amountIn);
  s.dirs[dir] = true;
  s.mev += mev;

  const gainedXp = 40 + Math.min(60, Math.floor(amountIn / 10000)) + Math.min(50, (s.streak - 1) * 10);
  g.xp += gainedXp;

  const unlocked = checkUnlocks(g);
  const after = rankFor(g.xp);
  saveGame(g);
  return { next: g, gainedXp, unlocked, rankUp: after.level > before ? after.rank : null };
}

/* For non-swap actions (e.g. opening a receipt). */
export function applyEvent(prev, mutate) {
  const g = { ...prev, stats: { ...prev.stats, dirs: { ...prev.stats.dirs } }, unlocked: { ...prev.unlocked } };
  const before = rankFor(g.xp).level;
  mutate(g.stats);
  const unlocked = checkUnlocks(g);
  const after = rankFor(g.xp);
  saveGame(g);
  return { next: g, unlocked, rankUp: after.level > before ? after.rank : null };
}
