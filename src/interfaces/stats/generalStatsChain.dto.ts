import { ApiHideProperty } from '@nestjs/swagger';

export class StatsChain {
  @ApiHideProperty()
  tvl: number;
  totalLiquidity: number;
  totalVolume: number;
}

export class GeneralStatsChain {
  tvl: number;
  totalLiquidity: number;
  totalVolume: number;
  bsc: StatsChain;
  polygon: StatsChain;
  burntAmount: number;
  totalSupply: number;
  circulatingSupply: number;
  marketCap: number;
  gdigiCirculatingSupply: number;
  lendingTvl: number;
  partnerCount?: number;
}
