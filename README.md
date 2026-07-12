# DarkPool DEX — private swaps on Midnight

A **shielded constant-product AMM** on [Midnight](https://midnight.network). Trade sizes
are **private zero-knowledge witnesses** — proven correct without being revealed — so
front-running / sandwich bots have nothing to see. Every swap pays a **0.25% protocol fee**
that accrues on-chain (the revenue model).

```
┌──────────────┐     REST      ┌───────────────────┐   ZK proofs   ┌──────────────────┐
│  web (Vite)  │ ───────────▶  │  darkpool-server  │ ───────────▶  │  Midnight local  │
│  React + 3D  │ ◀───────────  │  (Midnight SDK)   │ ◀───────────  │  node + indexer  │
└──────────────┘   live state  └───────────────────┘   deploy/call │  + proof server  │
                                                                    └──────────────────┘
```

## What's inside

| Path | What it is |
|------|-----------|
| `contract/src/darkpool.compact` | The Compact smart contract (shielded AMM + fee → treasury) |
| `contract/managed/darkpool/` | Compiled output: ZK prover/verifier keys + TS bindings |
| `cli/src/sim.cjs` | Local simulator — validates AMM math, revenue & ZK soundness (no chain) |
| `../midnight-local-dev/deploy-darkpool.mjs` | Deploys to the local chain + runs one private swap (CLI demo) |
| `../midnight-local-dev/darkpool-server.mjs` | Backend: keeps the deployed contract loaded, serves REST |
| `web/` | Frontend: React + react-three-fiber, light theme, live dashboard |

## Prerequisites
- Node.js ≥ 22, Docker + Docker Compose
- The compiler is fetched automatically (compactc **0.31.1**, language **0.23**, runtime **0.16.0**)

## Run it

**1. Start the local Midnight network** (node + indexer + proof server):
```bash
cd midnight-local-dev
docker compose -f standalone.yml up -d
```

**2. (optional) Quick sanity check — no chain needed:**
```bash
cd darkpool-dex && node cli/src/sim.cjs        # prints ✅ ALL CHECKS PASSED
```

**3. Start the backend** (deploys the contract + seeds a pool; ~90s the first time):
```bash
cd midnight-local-dev
node darkpool-server.mjs                        # serves http://127.0.0.1:8730
```

**4. Start the frontend:**
```bash
cd darkpool-dex/web
npm install      # first time only
npm run dev                                      # opens http://localhost:5273
```

Open **http://localhost:5273**, enter an amount, and click **Swap privately**. The proof
overlay runs while the proof server generates a real ZK proof (~15–25s), then the pool
reserves and **protocol revenue** update live.

### Recompile the contract (if you edit the `.compact`)
```bash
cd midnight-local-dev
COMPACTC_VERSION=0.31.1 node node_modules/.bin/run-compactc \
  ../darkpool-dex/contract/src/darkpool.compact \
  ../darkpool-dex/contract/managed/darkpool
```

## Revenue model
- **0.25% swap fee** on every trade, skimmed to an on-chain treasury (`treasuryA`).
- Roadmap: a shielded-execution priority premium, and a compliance/selective-disclosure
  subscription for institutions (uniquely possible on Midnight).

## Why Midnight
The contract takes the swap amount as a **private witness**; the Compact compiler
*statically forbids* leaking it to public state without an explicit `disclose()`. The swap
math is proven with a zero-knowledge circuit (division-free, using multiplication-only
range checks). That's privacy that a transparent chain simply cannot offer.

## Endpoints (backend)
`GET /api/health` · `GET /api/state` · `POST /api/quote {amountIn}` · `POST /api/swap {amountIn}`
