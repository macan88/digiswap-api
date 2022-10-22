import { LiteStats } from './liteStats.dto';

export interface WalletStats {
  tvl: number;
  digichainPrice: number;
  aggregateApr: number;
  aggregateAprPerDay: number;
  aggregateAprPerWeek: number;
  aggregateAprPerMonth: number;
  dollarsEarnedPerDay: number;
  dollarsEarnedPerWeek: number;
  dollarsEarnedPerMonth: number;
  dollarsEarnedPerYear: number;
  digichainsEarnedPerDay: number;
  digichainsEarnedPerWeek: number;
  digichainsEarnedPerMonth: number;
  digichainsEarnedPerYear: number;
  digichainsInWallet: number;
  pendingReward?: number;
  pools?: LiteStats[];
  farms?: LiteStats[];
  incentivizedPools?: LiteStats[];
  pendingRewardUsd: number;
  pendingRewardDigichain: number;
}
