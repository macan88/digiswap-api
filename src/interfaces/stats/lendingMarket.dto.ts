export class LendingMarket {
  readonly name: string;
  readonly marketAddress: string;
  readonly totalSupply: number;
  readonly totalBorrows: number;
  readonly tokenPrice: number;
  readonly apys?: {
    borrowApyPercent?: number;
    supplyApyPercent?: number;
    borrowDistributionApyPercent?: number;
    supplyDistributionApyPercent?: number;
    totalSupplyBalanceUsd?: number;
  };
}

export class LendingMarketInitialDto {
  name: string;
  contract: string;
  asset: string;
}
export class LendingMetadataDto {
  cToken: string;
  exchangeRateCurrent: number;
}
