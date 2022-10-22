export const LocationDescription = {
  operation: 'Operational Funds',
  pol: 'POL',
};
export const ProtocolMetricsDescriptions = {
  marketCap: 'Market Cap',
  burned: 'Digichain Burned',
  minted: 'DIGICHAIN Minted',
  pol: 'POL',
};
export const DistributionDescriptions = {
  burn: 'Burn Wallet',
  gdigi: 'GDIGI',
  pools: 'Pools',
  liquidity: 'Liquidity',
  other: 'Other',
};
export const MiscDescriptions = {
  digiswap: 'digiswap',
  partner: 'partner',
  bananaBill: 'digichain bill',
};
export class NetworkDescriptionDto {
  id: number;
  description: string;
  symbol: string;
  chain: string;
}

export type NetworkDescriptionMap = Record<number, NetworkDescriptionDto>;
type OperationalValueMap = Record<number, number>;
export type PriceListMap = Record<string, { chainId: number; history: { time?: string; price?: number }[] }>;
export class TokenTreasuryDto {
  address?: string;
  symbol?: string;
  value?: number;
  amount?: number;
  chainId?: number;
  location?: string;
  price?: number;
}
export class TreasuryLPDto {
  address: string;
  amount?: number;
  value?: number;
  chainId: number;
  token0?: TokenTreasuryDto;
  token1?: TokenTreasuryDto;
  location: string;
  type?: string;
}

export class HistoryTreasury {
  timestamp: number;
  polValue: number;
  oppFundValue: number;
  apePolValue: number;
  partnerPolValue: number;
}
export class AllHistoryTreasuryDto {
  history: HistoryTreasury[];
  createdAt?: any;
}
export class HistoryDto {
  pol: any;
  operational: any;
  createdAt?: any;
}
//principal
export class TreasuryDto {
  value: number;
  valuePol: number;
  valueApePol: number;
  valuePartnerPol: number;
  valueOperational: number;
  lpTokens: TreasuryLPDto[];
  tokens?: TokenTreasuryDto[];
  createdAt?: any;
  operational?: OperationalValueMap;
}

export class LockedValueDto {
  farms: number;
  pools: number;
  jungle: number;
  lending: number;
  maximizers: number;
  other: number;
  createdAt?: any;
}
export class History {
  amount: number;
  time: number;
}

export class VolumeDto {
  data: TradeVolumeDto[];
  dataMapping: TradeVolumeDto[];
  createdAt: any;
}
export class TradeVolumeDto {
  description: string;
  history: History[];
}

export class ProtocolDto {
  holders: ProtocolMetricsDto;
  marketCap: ProtocolMetricsDto;
  burned: ProtocolMetricsDto;
  pol: ProtocolMetricsDto;
  minted: ProtocolMetricsDto;
  createdAt: any;
}
export class ProtocolMetricsDto {
  description: string;
  amount: number;
  type?: string;
  history: History[];
}

export class DistributionDTo {
  description: string;
  amount: number;
}
export class BananaDistribution {
  total: number;
  distribution: DistributionDTo[];
  createdAt?: any;
}
//principal
export class OverviewDto {
  // tvl: LockedValueDto[];
  volume: TradeVolumeDto[];
  protocolMetrics: ProtocolMetricsDto[];
  bananaDistribution: DistributionDTo[];
}

export class Token {
  symbol: string;
  address?: string;
  decimals?: number;
  name?: string;
  lpToken?: boolean;
}

export class LPToken {
  symbol: string;
  address: string;
  decimals: number;
  mainToken: string;
  quoteToken: string;
}

export class BillsConfig {
  index: number;
  billType: string;
  contractAddress: string;
  lpToken: LPToken;
  rewardToken: Token;
  inactive?: boolean;
}

export class TokenAmountDto {
  token0Amount: number;
  token1Amount: number;
}

export class DexTradesQueryDto {
  quoteCurrency: Token;
  baseCurrency: Token;
}
export class LPInformationQueryDto {
  dexTrades: DexTradesQueryDto[];
}

export class OperationBalanceCurrencyDto {
  address: string;
  mainToken: string;
  isLP?: boolean;
}

export class LendingMarketsDto {
  name: string;
  contract: string;
  asset?: string;
}

export class InfoLP {
  address: string;
  balances: any;
  smartContract: any;
  lp: any;
}

export interface Address {
  97?: string;
  56?: string;
  137?: string;
}
export interface VaultConfig {
  id: number;
  pid: number;
  type: 'MAX' | 'AUTO' | 'BURN';
  version: 'V1' | 'V2';
  availableChains: number[];
  stratAddress: Address;
  platform: string;
  token: Token;
  quoteToken?: Token;
  stakeToken: Token;
  rewardToken: Token;
  masterchef: any;
  inactive?: boolean;
  depositFee?: number;
  rewardsInSeconds?: boolean;
  fee?: string;
}

export interface Vault extends VaultConfig {
  totalStaked?: string;
  totalAllocPoint?: string;
  keeperFee?: string;
  withdrawFee?: string;
  allocPoint?: string;
  weight?: number;
  stakeTokenPrice?: number;
  rewardTokenPrice?: number;
  strategyPairBalance?: string;
  strategyPairBalanceFixed?: string;
  totalInQuoteToken?: string;
  totalInQuoteTokenInMasterChef?: string;
  stakeTokenDecimals?: string;
  masterChefPairBalance?: string;
  apy?: {
    daily?: number;
    yearly?: number;
  };
  userData?: {
    allowance: string;
    tokenBalance: string;
    stakedBalance: string;
    stakedWantBalance: string;
    pendingRewards: string;
  };
}

export interface PairInformationDto {
  price: number;
  reservePerUnit0: number;
  reservePerUnit1: number;
  reserveTotal0: number;
  reserveTotal1: number;
  reserve0?: number;
  reserve1?: number;
  totalSupply: number;
  token0: {
    id: string;
    symbol: string;
    amount: number;
    value: number;
  };
  token1: {
    id: string;
    symbol: string;
    amount: number;
    value: number;
  };
  amount: number;
}

export interface TokenPriceFilter {
  address: string;
  chainId: number;
  block?: number;
  timestamp?: number;
  operationalBalanceCurrency?: OperationBalanceCurrencyDto[];
  currency?: any;
  limit?: any;
}

interface HistoryDataDto {
  time: number;
  value?: number;
  amount?: number;
  price?: number;
  amountBanana?: number;
  amountGnana?: number;
}
export class AllHistoryTvlDto {
  pairs: {
    total: number;
    history: HistoryDataDto[];
  };
  pools: {
    total: number;
    history: HistoryDataDto[];
  };
  jungle: Record<
    string,
    {
      history: HistoryDataDto[];
    }
  >;
  lending: Record<
    string,
    {
      history: HistoryDataDto[];
    }
  >;
}

export class RatioDto {
  createdAt: any;
  history: RatioHistoryDto[];
}

export class RatioHistoryDto {
  timestamp: number;
  ratio: number;
}

export class HistoryInformationDto {
  lastDate: string;
  value: number;
  apeValue: number;
  partnerValue: number;
}
