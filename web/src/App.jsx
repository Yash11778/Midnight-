import React, { useEffect, useMemo, useRef, useState } from 'react';
import Scene from './Scene.jsx';
import { api } from './api.js';
import { listInjectedWallets, waitForWallets, connectWallet, readWalletSummary, NETWORK_ID } from './wallet.js';
import { loadGame, applySwap, applyEvent, rankFor, RANKS, ACHIEVEMENTS } from './game.js';

const fmt = (v) => Number(v).toLocaleString('en-US');
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const TOKENS = { A: 'nUSD', B: 'aUSD' };
const AMOUNT_CHIPS = [50000, 100000, 250000, 500000];
const SLIPPAGES = [0.1, 0.5, 1.0];
const ROUTES = [['Swap', 'swap'], ['Pool', 'pool'], ['Activity', 'activity'], ['Rank', 'rank'], ['How it works', 'how']];

const I = {
  shield: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z"/></svg>),
  bolt: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>),
  coins: (p) => (<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3"/><path d="M15 12c3.3 0 6-1.3 6-3s-2.7-3-6-3"/><path d="M21 9v6c0 1.7-2.7 3-6 3-1 0-2-.1-2.8-.3"/></svg>),
  swap: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M7 4v13M7 17l-3-3M7 17l3-3M17 20V7M17 7l-3 3M17 7l3 3"/></svg>),
  eyeoff: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.6 9.6 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.2 3M6.1 6.7A11.6 11.6 0 003 12c0 2.5 4 7 9 7 1.4 0 2.7-.3 3.9-.8"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" {...p}><path d="M5 12l5 5L20 6"/></svg>),
  scale: (p) => (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3v18M7 6h10M5 6l-3 6h6L5 6zM19 6l-3 6h6l-3-6z"/></svg>),
  doc: (p) => (<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M14 3H6v18h12V7l-4-4z"/><path d="M14 3v4h4M8 13h8M8 17h6"/></svg>),
  x: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>),
  star: (p) => (<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 17.2 6.4 20.2l1.2-6.2L3 9.6l6.3-.8L12 3z"/></svg>),
  flame: (p) => (<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 3c1 3-3 4.5-3 8a3 3 0 006 0c0-1.2-.5-2-.5-2 2 1 3.5 3 3.5 5.5A6 6 0 016 14.5C6 9.5 11 8 12 3z"/></svg>),
  lock: (p) => (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>),
};

const Coin = ({ t }) => (<span className={`coin ${t === TOKENS.A ? 'a' : 'b'}`}>{t[0]}</span>);
const routeFromHash = () => (window.location.hash.replace('#/', '') || 'swap');

export default function App() {
  const [state, setState] = useState(null);
  const [dir, setDir] = useState('AtoB');
  const [amount, setAmount] = useState('250000');
  const [slip, setSlip] = useState(0.5);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [toast, setToast] = useState(null);
  const [err, setErr] = useState('');
  const [online, setOnline] = useState(false);
  const [activity, setActivity] = useState([]);
  const [mevSaved, setMevSaved] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [route, setRoute] = useState(routeFromHash());
  const stepTimer = useRef([]);

  // ---- gamification ----
  const [game, setGame] = useState(loadGame);
  const [awards, setAwards] = useState([]); // queued unlock/rank-up toasts
  const rk = useMemo(() => rankFor(game.xp), [game.xp]);
  const pushAwards = ({ unlocked, rankUp }) => {
    const items = [
      ...(rankUp ? [{ key: `rank-${rankUp.name}-${Date.now()}`, kind: 'rank', title: `Rank up — ${rankUp.name}`, desc: rankUp.note }] : []),
      ...unlocked.map((a) => ({ key: `ach-${a.id}`, kind: 'ach', title: `Achievement — ${a.name}`, desc: `${a.desc} · +75 XP`, icon: a.icon })),
    ];
    if (!items.length) return;
    setAwards((q) => [...q, ...items]);
    items.forEach((it) => setTimeout(() => setAwards((q) => q.filter((x) => x.key !== it.key)), 7000));
  };

  // ---- browser wallet connect ----
  const [walletModal, setWalletModal] = useState(false);
  const [detected, setDetected] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [connecting, setConnecting] = useState(null); // key being connected
  const [wallet, setWallet] = useState(null); // { connected, info, summary }
  const [walletErr, setWalletErr] = useState('');

  const openWalletModal = async () => {
    setWalletModal(true); setWalletErr(''); setDetecting(true);
    const found = await waitForWallets();
    setDetected(found);
    setDetecting(false);
  };

  const pickWallet = async (key) => {
    setConnecting(key); setWalletErr('');
    try {
      const { connected, info } = await connectWallet(key);
      const summary = await readWalletSummary(connected);
      setWallet({ connected, info, summary });
      setWalletModal(false);
    } catch (e) {
      setWalletErr(String(e.message || e));
    } finally {
      setConnecting(null);
    }
  };

  const disconnectWallet = () => setWallet(null);

  const tokenIn = dir === 'AtoB' ? TOKENS.A : TOKENS.B;
  const tokenOut = dir === 'AtoB' ? TOKENS.B : TOKENS.A;

  useEffect(() => {
    const onHash = () => { setRoute(routeFromHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (r) => { if (window.location.hash !== `#/${r}`) window.location.hash = `#/${r}`; setRoute(r); window.scrollTo({ top: 0 }); };

  const refresh = async () => {
    try {
      const [s, a] = await Promise.all([api.state(), api.activity().catch(() => [])]);
      setState(s); setActivity(a); setOnline(true);
    } catch { setOnline(false); }
  };
  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (!busy) refresh(); }, 4000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    const n = Number(amount);
    if (!n || n <= 0) { setQuote(null); return; }
    const h = setTimeout(async () => {
      try { setQuote(await api.quote(Math.floor(n), dir)); } catch { setQuote(null); }
    }, 250);
    return () => clearTimeout(h);
  }, [amount, dir, state?.tradeCount]);

  const impactPct = useMemo(() => {
    if (!quote || quote.spotBps === '0') return 0;
    const spot = Number(quote.spotBps), exec = Number(quote.execBps);
    return spot ? Math.max(0, (1 - exec / spot) * 100) : 0;
  }, [quote]);
  const mevEstimate = useMemo(() => (quote ? Math.round(Number(quote.amountOut) * (impactPct / 100)) : 0), [quote, impactPct]);
  const minOut = quote ? Math.floor(Number(quote.amountOut) * (1 - slip / 100)) : 0;

  const runSwap = async () => {
    const n = Math.floor(Number(amount));
    if (!n || n <= 0) return;
    setErr(''); setBusy(true); setStep(0);
    const seq = [900, 4500, 12000];
    stepTimer.current = seq.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    try {
      const r = await api.swap(n, dir, minOut);
      setStep(4); setState(r.state); setPulse((p) => p + 1); setMevSaved((m) => m + mevEstimate);
      const g = applySwap(game, { amountIn: n, dir, mev: mevEstimate });
      setGame(g.next); pushAwards(g);
      setToast({ ...r.swap, txId: r.txId, ms: r.proofMs, receiptId: r.receiptId, xp: g.gainedXp });
      setTimeout(() => setToast(null), 9000);
      refresh();
    } catch (e) { setErr(String(e.message || e)); }
    finally {
      stepTimer.current.forEach(clearTimeout);
      setTimeout(() => { setBusy(false); setStep(0); }, 500);
    }
  };

  const openReceipt = async (id) => {
    try {
      setReceipt(await api.receipt(id));
      const g = applyEvent(game, (s) => { s.receipts += 1; });
      setGame(g.next); pushAwards(g);
    } catch (e) { setErr(String(e.message || e)); }
  };
  const downloadReceipt = (r) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${r.receiptId}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const rA = state ? Number(state.reserveA) : 0;
  const rB = state ? Number(state.reserveB) : 0;
  const total = rA + rB || 1;
  const revenue = state ? Number(state.treasuryA) + Number(state.treasuryB) : 0;

  /* ---------- shared pieces ---------- */
  const SwapCard = () => (
    <div className="card" id="swap">
      <div className="hd"><h3>Swap</h3><p>Amounts are hidden inside the proof.</p></div>
      <div className="swap">
        <div className="chips">
          {AMOUNT_CHIPS.map((c) => (
            <button key={c} className={`chip ${Number(amount) === c ? 'on' : ''}`} onClick={() => setAmount(String(c))}>{fmt(c)}</button>
          ))}
        </div>
        <div className="leg">
          <div className="row"><label>You pay</label><span className="bal">private</span></div>
          <div className="row">
            <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" />
            <span className="token"><Coin t={tokenIn} />{tokenIn}</span>
          </div>
        </div>
        <button className="arrow" title="Flip direction" onClick={() => setDir((d) => (d === 'AtoB' ? 'BtoA' : 'AtoB'))}><I.swap /></button>
        <div className="leg">
          <div className="row"><label>You receive</label><span className="bal">estimated</span></div>
          <div className="row">
            <div className={`out ${quote ? '' : 'dim'}`}>{quote ? fmt(quote.amountOut) : '0'}</div>
            <span className="token"><Coin t={tokenOut} />{tokenOut}</span>
          </div>
        </div>
        <div className="mev">
          <div className="mev-l"><span className="ic"><I.shield /></span><div><b>MEV shield</b><span>Est. value protected from front-running</span></div></div>
          <div className="mev-v">{quote ? `≈ ${fmt(mevEstimate)}` : '—'}<i>{tokenOut}</i></div>
        </div>
        <div className="slip">
          <span>Max slippage</span>
          <div className="slip-opts">
            {SLIPPAGES.map((s) => (<button key={s} className={`sopt ${slip === s ? 'on' : ''}`} onClick={() => setSlip(s)}>{s}%</button>))}
          </div>
        </div>
        <div className="meta">
          <div className="mrow"><span>Rate</span><b>{quote && Number(amount) ? `1 ${tokenIn} ≈ ${(Number(quote.amountOut) / Number(amount)).toFixed(4)} ${tokenOut}` : '—'}</b></div>
          <div className="mrow"><span>Protocol fee (0.25%)</span><b className="tag">{quote ? `${fmt(quote.fee)} ${tokenIn}` : '—'}</b></div>
          <div className="mrow"><span>Price impact</span><b>{quote ? `${impactPct.toFixed(2)}%` : '—'}</b></div>
          <div className="mrow"><span>Min received</span><b>{quote ? `${fmt(minOut)} ${tokenOut}` : '—'}</b></div>
        </div>
        <button className={`btn ${busy ? 'busy' : ''}`} disabled={busy || !quote || !online} onClick={runSwap}>
          {busy ? 'Proving…' : online ? 'Swap privately' : 'Backend offline'}
        </button>
        {err ? <div className="err">{err}</div> :
          <div className="hintline"><span className="ic"><I.shield /></span> Settled on Midnight with a real ZK proof</div>}
      </div>
    </div>
  );

  const StatsGrid = () => (
    <div className="stats">
      <div className="stat"><div className="k"><I.coins /> Total value locked</div><div className="v">{fmt(rA + rB)}</div><div className="sub">{TOKENS.A} + {TOKENS.B}</div></div>
      <div className="stat rev"><div className="k"><I.coins /> Protocol revenue</div><div className="v">{fmt(revenue)}</div><div className="sub">{state ? `${fmt(state.treasuryA)} ${TOKENS.A} · ${fmt(state.treasuryB)} ${TOKENS.B}` : ''}</div></div>
      <div className="stat"><div className="k"><I.bolt /> Swaps settled</div><div className="v">{state ? state.tradeCount : '—'}</div><div className="sub">each with a ZK proof</div></div>
      <div className="stat mev-stat"><div className="k"><I.shield /> MEV protected</div><div className="v">{fmt(mevSaved)}</div><div className="sub">est. this session</div></div>
    </div>
  );

  const ReserveBar = () => (
    <div className="reserve-bar">
      <div className="rb-head"><span>Reserves</span><span>{((rA / total) * 100).toFixed(1)}% / {((rB / total) * 100).toFixed(1)}%</span></div>
      <div className="rb-track"><div className="rb-a" style={{ width: `${(rA / total) * 100}%` }} /><div className="rb-b" style={{ width: `${(rB / total) * 100}%` }} /></div>
      <div className="rb-legend"><span><i style={{ background: '#0e7c66' }} />{TOKENS.A} {fmt(rA)}</span><span><i style={{ background: '#2a54a8' }} />{TOKENS.B} {fmt(rB)}</span></div>
    </div>
  );

  const Feed = () => (
    <div className="feed">
      {activity.length === 0 && <div className="feed-empty">No swaps yet — make the first private trade.</div>}
      {activity.map((a) => (
        <div className="fitem" key={a.id}>
          <span className="fic"><I.eyeoff /></span>
          <div className="fmain"><b>Private swap · {a.tokenIn} → {a.tokenOut}</b><span>fee {fmt(a.fee)} {a.tokenIn} · {new Date(a.at).toLocaleTimeString()}</span></div>
          <button className="frcpt" onClick={() => openReceipt(a.id)}><I.doc /> Receipt</button>
        </div>
      ))}
    </div>
  );

  const streakLive = Date.now() - game.stats.lastSwapAt <= 3 * 60 * 1000 && game.stats.streak > 1;
  const unlockedCount = Object.keys(game.unlocked).length;

  const RankCard = () => (
    <div className="card">
      <div className="hd"><h3>Trader rank</h3><p>Earn XP for every private swap. <a href="#/rank" onClick={(e) => { e.preventDefault(); go('rank'); }}>Ranks &amp; badges →</a></p></div>
      <div className="rankcard">
        <div className="rk-row">
          <div className="rk-medal"><I.star /></div>
          <div className="rk-main">
            <b>{rk.rank.name}</b>
            <span>Level {rk.level} · {fmt(game.xp)} XP{rk.next ? ` · ${fmt(rk.next.xp - game.xp)} to ${rk.next.name}` : ' · max rank'}</span>
          </div>
          {streakLive && <span className="rk-streak" title="Combo — swaps within 3 min keep it alive"><I.flame /> ×{game.stats.streak}</span>}
        </div>
        <div className="rk-track"><div className="rk-fill" style={{ width: `${Math.round(rk.progress * 100)}%` }} /></div>
        <div className="rk-badges">
          {ACHIEVEMENTS.map((a) => (
            <span key={a.id} className={`rk-badge ${game.unlocked[a.id] ? 'on' : ''}`} title={`${a.name} — ${a.desc}`}>
              {game.unlocked[a.id] ? (I[a.icon] || I.star)() : <I.lock />}
            </span>
          ))}
          <span className="rk-count">{unlockedCount}/{ACHIEVEMENTS.length}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => go('swap')}>
            <div className="mark"><I.shield /></div>
            <div className="name">Dark<b>Pool</b></div>
          </div>
          <nav className="navlinks">
            {ROUTES.map(([label, id]) => (
              <a key={id} href={`#/${id}`} className={`navlink ${route === id ? 'active' : ''}`}
                 onClick={(e) => { e.preventDefault(); go(id); }}>{label}</a>
            ))}
          </nav>
          <div className="nav-spacer" />
          <button className="pill rank-pill" title="Your trader rank" onClick={() => go('rank')}>
            <span className="rp-ic"><I.star /></span>{rk.rank.name} · <b>{fmt(game.xp)} XP</b>
          </button>
          <span className="pill nav-net"><span className={`dot ${online ? '' : 'off'}`} />{online ? 'Live' : 'Offline'} · Midnight local</span>
          {wallet ? (
            <button className="wallet-btn on" title={wallet.summary.unshieldedAddr} onClick={disconnectWallet}>
              <span className="wdot" />{wallet.info.name} · {short(wallet.summary.unshieldedAddr)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={openWalletModal}>
              <span className="wdot off" />Connect wallet
            </button>
          )}
        </div>
      </header>

      <div className="wrap">
        {/* ---------------- SWAP ---------------- */}
        {route === 'swap' && (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">Private swaps · zero-knowledge</div>
                <h1 className="h1">Trade without<br /><span className="ital">showing your hand.</span></h1>
                <p className="lede">Your trade size stays private — proven correct by zero-knowledge, invisible to front-running bots. Every swap pays a protocol fee, and you can disclose any trade to an auditor on demand.</p>
                <div className="hero-points">
                  <div className="hpoint"><span className="ic"><I.eyeoff /></span><div><b>Shielded amounts</b><span>Swap size is a private witness.</span></div></div>
                  <div className="hpoint"><span className="ic"><I.bolt /></span><div><b>MEV-resistant</b><span>Nothing to see, nothing to sandwich.</span></div></div>
                  <div className="hpoint"><span className="ic"><I.doc /></span><div><b>Auditable</b><span>Selective-disclosure receipts.</span></div></div>
                </div>
              </div>
              <div className="canvas-hold">
                <Scene pulse={pulse} busy={busy} />
                <div className="cap">{busy ? 'Generating zero-knowledge proof…' : 'Shielded liquidity pool'}</div>
              </div>
            </section>
            <section className="grid">
              <SwapCard />
              <div className="rcol">
                <div className="card"><div className="hd"><h3>Live pool</h3><p>Updates on every swap. <a href="#/pool" onClick={(e) => { e.preventDefault(); go('pool'); }}>Full details →</a></p></div>
                  <StatsGrid /><ReserveBar />
                </div>
                <RankCard />
              </div>
            </section>
          </>
        )}

        {/* ---------------- POOL ---------------- */}
        {route === 'pool' && (
          <>
            <div className="pagehead">
              <div className="eyebrow">Liquidity</div>
              <h1 className="ph-title">Pool &amp; protocol revenue</h1>
              <p className="ph-sub">Live on-chain state of the shielded nUSD / aUSD pool. Reserves are public for pricing; individual trade sizes are not.</p>
            </div>
            <section className="stack">
              <div className="card"><StatsGrid /><ReserveBar /></div>
              <div className="card">
                <div className="hd"><h3>Pool details</h3></div>
                <div className="details">
                  <div className="drow"><span>Contract address</span><b className="mono">{state ? state.address : '—'}</b></div>
                  <div className="drow"><span>Token A</span><b>{TOKENS.A} · reserve {fmt(rA)}</b></div>
                  <div className="drow"><span>Token B</span><b>{TOKENS.B} · reserve {fmt(rB)}</b></div>
                  <div className="drow"><span>Fee tier</span><b>0.25% ({state ? `${state.feeBps} bps` : '—'})</b></div>
                  <div className="drow"><span>Treasury (revenue)</span><b>{state ? `${fmt(state.treasuryA)} ${TOKENS.A} · ${fmt(state.treasuryB)} ${TOKENS.B}` : '—'}</b></div>
                  <div className="drow"><span>Total swaps</span><b>{state ? state.tradeCount : '—'}</b></div>
                </div>
              </div>
              <div className="card note-card">
                <div className="hd"><h3>Providing liquidity</h3><p>Demo runs a single seeded provider. Real multi-LP shares &amp; on-chain token custody are on the roadmap.</p></div>
              </div>
            </section>
          </>
        )}

        {/* ---------------- ACTIVITY ---------------- */}
        {route === 'activity' && (
          <>
            <div className="pagehead">
              <div className="eyebrow">On-chain, amounts hidden</div>
              <h1 className="ph-title">Private activity</h1>
              <p className="ph-sub">Everyone can see a swap happened — no one can see how big. You hold the receipts and choose who to show them to.</p>
            </div>
            <section className="stack">
              <div className="card"><Feed /></div>
              <div className="card note-card">
                <div className="hd"><h3>Selective disclosure</h3><p>Each swap generates a signed audit receipt. Open one and export it to prove a trade to a regulator or auditor — while the chain still reveals nothing to anyone else.</p></div>
              </div>
            </section>
          </>
        )}

        {/* ---------------- RANK ---------------- */}
        {route === 'rank' && (
          <>
            <div className="pagehead">
              <div className="eyebrow">Trader profile</div>
              <h1 className="ph-title">The quieter you trade,<br />the louder your rank.</h1>
              <p className="ph-sub">Every private swap earns XP — bigger trades, quick combos, and audit receipts earn more. Nothing here touches the chain: your record stays on your machine, like your trade sizes.</p>
            </div>
            <section className="stack">
              <RankCard />
              <div className="card">
                <div className="hd"><h3>Rank ladder</h3><p>+40 XP per swap, plus size and combo bonuses. Achievements pay +75 XP each.</p></div>
                <div className="ladder">
                  {RANKS.map((r, i) => (
                    <div key={r.name} className={`lrow ${rk.level === i + 1 ? 'now' : ''} ${game.xp >= r.xp ? 'past' : ''}`}>
                      <span className="ln">{i + 1}</span>
                      <div className="lmain"><b>{r.name}</b><span>{r.note}</span></div>
                      <b className="lxp">{fmt(r.xp)} XP</b>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="hd"><h3>Achievements</h3><p>{unlockedCount} of {ACHIEVEMENTS.length} unlocked.</p></div>
                <div className="achgrid">
                  {ACHIEVEMENTS.map((a) => (
                    <div key={a.id} className={`ach ${game.unlocked[a.id] ? 'on' : ''}`}>
                      <span className="aic">{game.unlocked[a.id] ? (I[a.icon] || I.star)() : <I.lock />}</span>
                      <div><b>{a.name}</b><span>{a.desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="hd"><h3>Lifetime stats</h3></div>
                <div className="details">
                  <div className="drow"><span>Private swaps settled</span><b>{fmt(game.stats.swaps)}</b></div>
                  <div className="drow"><span>Volume hidden from the mempool</span><b>{fmt(game.stats.volume)}</b></div>
                  <div className="drow"><span>Largest shielded swap</span><b>{fmt(game.stats.maxSwap)}</b></div>
                  <div className="drow"><span>Est. MEV protected</span><b>{fmt(game.stats.mev)}</b></div>
                  <div className="drow"><span>Best combo</span><b>×{game.stats.streakBest}</b></div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ---------------- HOW IT WORKS ---------------- */}
        {route === 'how' && (
          <>
            <div className="pagehead">
              <div className="eyebrow">Under the hood</div>
              <h1 className="ph-title">How DarkPool keeps trades private</h1>
              <p className="ph-sub">A shielded constant-product AMM written in Compact, settling with real zero-knowledge proofs on Midnight.</p>
            </div>
            <section className="stack">
              <div className="card">
                <div className="hd"><h3>The swap, step by step</h3></div>
                <div className="how-steps">
                  <div className="hstep"><div className="n">1</div><div><b>You enter an amount</b><span>It stays on your machine — never broadcast in the clear to the mempool.</span></div></div>
                  <div className="hstep"><div className="n">2</div><div><b>A ZK proof is generated (~16s)</b><span>The proof server proves the swap math and your balance are valid — while hiding the values.</span></div></div>
                  <div className="hstep"><div className="n">3</div><div><b>It settles on Midnight</b><span>Reserves and the protocol fee update on-chain. Observers see a swap happened, not how big.</span></div></div>
                </div>
              </div>
              <div className="card">
                <div className="hd"><h3>Why it&apos;s private</h3></div>
                <div className="privacy">
                  <div className="pv"><div className="ic"><I.eyeoff /></div><b>Hidden input</b><p>The Compact contract takes your amount as a private witness — the compiler forbids leaking it to public state.</p></div>
                  <div className="pv"><div className="ic"><I.shield /></div><b>Proven correct</b><p>A ZK proof shows the swap math is valid without revealing the numbers, so no one can fake a better price.</p></div>
                  <div className="pv"><div className="ic"><I.doc /></div><b>Disclose on demand</b><p>Export a signed receipt to prove a trade to an auditor — no one else ever sees it.</p></div>
                </div>
              </div>
              <div className="card">
                <div className="hd"><h3>Status &amp; roadmap</h3></div>
                <div className="roadmap">
                  <div className="rm live"><span className="dot" /><div><b>Live now</b><span>Shielded AMM deployed · bidirectional swaps · dual-token treasury · selective-disclosure receipts · live UI.</span></div></div>
                  <div className="rm next"><span className="dot" /><div><b>Next</b><span>Real shielded-token custody (Zswap coins) · public testnet · browser wallet (Lace) connect · multi-LP shares.</span></div></div>
                </div>
              </div>
            </section>
          </>
        )}

        <div className="foot">
          <span>DarkPool DEX · built on Midnight</span>
          <span>Demo · reserves tracked in-contract · real shielded-token custody on the roadmap</span>
          <span className="mono">{state ? `contract ${short(state.address)}` : ''}</span>
        </div>
      </div>

      {busy && (
        <div className="overlay">
          <div className="proofcard">
            <div className="ring" />
            <h4>Generating zero-knowledge proof</h4>
            <p>Your trade size never leaves your machine in the clear. The proof server is proving the swap is valid.</p>
            <div className="steps">
              {['Building the shielded transaction', 'Witnessing your private amount', 'Generating the ZK proof', 'Settling on Midnight'].map((label, i) => (
                <div key={i} className={`step ${step > i ? 'done' : step === i ? 'active' : ''}`}><span className="s">{step > i ? <I.check /> : i + 1}</span>{label}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {awards.length > 0 && (
        <div className="awards">
          {awards.map((a) => (
            <div key={a.key} className={`award ${a.kind}`} onClick={() => setAwards((q) => q.filter((x) => x.key !== a.key))}>
              <span className="aw-ic">{a.kind === 'rank' ? <I.star /> : (I[a.icon] || I.star)()}</span>
              <div><b>{a.title}</b><span>{a.desc}</span></div>
            </div>
          ))}
        </div>
      )}

      {toast && toast.info && (
        <div className="toast" onClick={() => setToast(null)}>
          <div className="t"><I.shield /> Demo wallet</div><div className="d">{toast.info}</div>
        </div>
      )}
      {toast && !toast.info && (
        <div className="toast">
          <div className="t"><I.check /> Swap settled privately</div>
          <div className="d">{fmt(toast.amountIn)} {toast.tokenIn} → {fmt(toast.amountOut)} {toast.tokenOut} · fee {fmt(toast.fee)} · proof {(toast.ms / 1000).toFixed(1)}s{toast.xp ? <b className="txp"> +{toast.xp} XP</b> : null}</div>
          {toast.receiptId && <button className="tbtn" onClick={() => openReceipt(toast.receiptId)}>View audit receipt</button>}
        </div>
      )}

      {receipt && (
        <div className="overlay" onClick={() => setReceipt(null)}>
          <div className="proofcard rcard" onClick={(e) => e.stopPropagation()}>
            <button className="rclose" onClick={() => setReceipt(null)}><I.x /></button>
            <div className="rtag"><I.doc /> Selective-disclosure receipt</div>
            <h4>Audit receipt</h4>
            <p className="rnote">{receipt.note}</p>
            <div className="rrows">
              {[
                ['Direction', `${receipt.tokenIn} → ${receipt.tokenOut}`],
                ['Amount in', `${fmt(receipt.amountIn)} ${receipt.tokenIn}`],
                ['Amount out', `${fmt(receipt.amountOut)} ${receipt.tokenOut}`],
                ['Protocol fee', `${fmt(receipt.fee)} ${receipt.tokenIn} (${receipt.feeBps} bps)`],
                ['Settled', new Date(receipt.settledAt).toLocaleString()],
                ['Tx', short(receipt.txId)],
                ['Receipt id', receipt.receiptId],
              ].map(([k, v]) => (<div className="rrow" key={k}><span>{k}</span><b className="mono">{v}</b></div>))}
            </div>
            <button className="btn" onClick={() => downloadReceipt(receipt)}>Download receipt (JSON)</button>
          </div>
        </div>
      )}

      {walletModal && (
        <div className="overlay" onClick={() => setWalletModal(false)}>
          <div className="proofcard wcard" onClick={(e) => e.stopPropagation()}>
            <button className="rclose" onClick={() => setWalletModal(false)}><I.x /></button>
            <div className="rtag"><I.shield /> Browser wallet</div>
            <h4>Connect a wallet</h4>
            <p className="rnote">
              Looking for a Midnight wallet extension exposing the standard dApp connector on this network
              (<b className="mono">{NETWORK_ID}</b>). If your wallet is testnet/mainnet-only, connecting to this
              local network will fail.
            </p>

            {detecting && <div className="wscan"><span className="wspin" /> Scanning for wallets…</div>}

            {!detecting && detected.length === 0 && (
              <div className="wempty">
                No Midnight wallet detected in <span className="mono">window.midnight</span>. Make sure the
                extension is installed, enabled, and this page was loaded after it injected.
                <button className="wretry" onClick={openWalletModal}>Scan again</button>
              </div>
            )}

            {!detecting && detected.length > 0 && (
              <div className="wlist">
                {detected.map((w) => (
                  <button key={w.key} className="witem" disabled={connecting !== null} onClick={() => pickWallet(w.key)}>
                    {w.icon ? <img className="wicon" src={w.icon} alt="" /> : <span className="wicon wicon-fallback"><I.shield /></span>}
                    <div className="wmeta">
                      <b>{w.name}</b>
                      <span className="mono">{w.rdns}{w.apiVersion ? ` · v${w.apiVersion}` : ''}</span>
                    </div>
                    <span className="wgo">{connecting === w.key ? 'Connecting…' : 'Connect'}</span>
                  </button>
                ))}
              </div>
            )}

            {walletErr && <div className="err" style={{ marginTop: 14 }}>{walletErr}</div>}
          </div>
        </div>
      )}
    </>
  );
}
