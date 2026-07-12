import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  addLiquidity(context: __compactRuntime.CircuitContext<PS>,
               amountA_0: bigint,
               amountB_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  swapAforB(context: __compactRuntime.CircuitContext<PS>,
            amountIn_0: bigint,
            fee_0: bigint,
            amountOut_0: bigint,
            minOut_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  swapBforA(context: __compactRuntime.CircuitContext<PS>,
            amountIn_0: bigint,
            fee_0: bigint,
            amountOut_0: bigint,
            minOut_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
}

export type ProvableCircuits<PS> = {
  addLiquidity(context: __compactRuntime.CircuitContext<PS>,
               amountA_0: bigint,
               amountB_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  swapAforB(context: __compactRuntime.CircuitContext<PS>,
            amountIn_0: bigint,
            fee_0: bigint,
            amountOut_0: bigint,
            minOut_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  swapBforA(context: __compactRuntime.CircuitContext<PS>,
            amountIn_0: bigint,
            fee_0: bigint,
            amountOut_0: bigint,
            minOut_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  addLiquidity(context: __compactRuntime.CircuitContext<PS>,
               amountA_0: bigint,
               amountB_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  swapAforB(context: __compactRuntime.CircuitContext<PS>,
            amountIn_0: bigint,
            fee_0: bigint,
            amountOut_0: bigint,
            minOut_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  swapBforA(context: __compactRuntime.CircuitContext<PS>,
            amountIn_0: bigint,
            fee_0: bigint,
            amountOut_0: bigint,
            minOut_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
}

export type Ledger = {
  readonly reserveA: bigint;
  readonly reserveB: bigint;
  readonly treasuryA: bigint;
  readonly treasuryB: bigint;
  readonly feeBps: bigint;
  readonly tradeCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
