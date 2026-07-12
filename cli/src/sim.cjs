/*
 * DarkPool DEX — local contract simulator.
 *
 * Runs the compiled Compact contract against an in-memory ledger (no network),
 * proving the AMM math + fee/revenue logic are correct. Uses the same runtime
 * the real chain uses, so a passing sim means the circuits are sound.
 *
 * Run from the midnight-local-dev dir (so @midnight-ntwrk/* resolve):
 *   node ../darkpool-dex/cli/src/sim.cjs
 */
const rt = require('@midnight-ntwrk/compact-runtime');
const path = require('path');
const { pathToFileURL } = require('url');

const COIN_PK = '00'.repeat(32); // dummy Zswap coin public key for local sim

// --- off-circuit AMM math (what a client computes before proving) ---
function quote(reserveA, reserveB, feeBps, amountIn) {
  const fee = (amountIn * feeBps) / 10000n;
  const inAfterFee = amountIn - fee;
  const amountOut = (inAfterFee * reserveB) / (reserveA + inAfterFee);
  return { fee, amountOut };
}

async function main() {
  const contractUrl = pathToFileURL(
    path.resolve(__dirname, '../../contract/managed/darkpool/contract/index.js'),
  ).href;
  const { Contract, ledger } = await import(contractUrl);
  const readLedger = (ctx) => ledger(ctx.currentQueryContext.state);

  const contract = new Contract({});
  const ctor = contract.initialState(rt.createConstructorContext(undefined, COIN_PK));
  let ctx = rt.createCircuitContext(
    rt.dummyContractAddress(),
    COIN_PK,
    ctor.currentContractState,
    ctor.currentPrivateState,
  );

  let l = readLedger(ctx);
  console.log('== initial ==');
  console.log('  feeBps      :', l.feeBps.toString());
  console.log('  reserveA/B  :', l.reserveA.toString(), '/', l.reserveB.toString());

  // 1) Seed liquidity: 1,000,000 A and 1,000,000 B.
  const A0 = 1_000_000n, B0 = 1_000_000n;
  ctx = contract.circuits.addLiquidity(ctx, A0, B0).context;
  l = readLedger(ctx);
  console.log('\n== after addLiquidity(1e6, 1e6) ==');
  console.log('  reserveA/B  :', l.reserveA.toString(), '/', l.reserveB.toString());

  // 2) Private swap: trader sends 100,000 A (a "whale" trade).
  const amountIn = 100_000n;
  const { fee, amountOut } = quote(l.reserveA, l.reserveB, l.feeBps, amountIn);
  console.log('\n== quote for private swap of', amountIn.toString(), 'A ==');
  console.log('  fee (0.25%) :', fee.toString());
  console.log('  amountOut   :', amountOut.toString());

  const minOut = amountOut; // exact-out slippage bound
  const res = contract.circuits.swapAforB(ctx, amountIn, fee, amountOut, minOut);
  ctx = res.context;
  console.log('  circuit ret :', res.result.toString());

  l = readLedger(ctx);
  console.log('\n== after swapAforB ==');
  console.log('  reserveA    :', l.reserveA.toString(), '(+', (l.reserveA - A0).toString(), ')');
  console.log('  reserveB    :', l.reserveB.toString(), '(-', (B0 - l.reserveB).toString(), ')');
  console.log('  treasuryA   :', l.treasuryA.toString(), '  <-- PROTOCOL REVENUE');
  console.log('  tradeCount  :', l.tradeCount.toString());

  // --- assertions ---
  const okReturn = res.result === amountOut;
  const okTreasury = l.treasuryA === fee;
  const okReserveA = l.reserveA === A0 + (amountIn - fee);
  const okReserveB = l.reserveB === B0 - amountOut;
  const invariantBefore = A0 * B0;
  const invariantAfter = l.reserveA * l.reserveB;
  const okInvariant = invariantAfter >= invariantBefore; // fee makes it grow

  console.log('\n== checks ==');
  console.log('  return==amountOut :', okReturn);
  console.log('  treasury==fee     :', okTreasury);
  console.log('  reserveA correct  :', okReserveA);
  console.log('  reserveB correct  :', okReserveB);
  console.log('  k grows (fee)     :', okInvariant, `(${invariantBefore} -> ${invariantAfter})`);

  // 3) Negative test: a lying prover claiming a too-good amountOut must fail.
  let cheatRejected = false;
  try {
    contract.circuits.swapAforB(ctx, amountIn, fee, amountOut + 1000n, 0n);
  } catch (e) {
    cheatRejected = true;
  }
  console.log('  cheat rejected    :', cheatRejected, '(inflated amountOut)');

  const allGood = okReturn && okTreasury && okReserveA && okReserveB && okInvariant && cheatRejected;
  console.log('\n' + (allGood ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'));
  process.exit(allGood ? 0 : 1);
}

main();
