export class FarmStatsDto {
  readonly address: string;
  readonly name: string;
  readonly poolIndex: number;
  readonly t0Address: string;
  readonly t0Symbol: string;
  readonly t0Decimals: number;
  readonly p0: number;
  readonly q0: number;
  readonly t1Address: string;
  readonly t1Symbol: string;
  readonly t1Decimals: number;
  readonly p1: number;
  readonly q1: number;
  readonly price: number;
  readonly rewardTokenPrice: number;
  readonly rewardTokenSymbol: string;
  readonly totalSupply: number;
  readonly tvl: number;
  readonly stakedTvl: number;
  readonly apr: number;
  readonly decimals: number;
  lpRewards?: any;
}
