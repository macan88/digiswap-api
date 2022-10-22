import { IncentivizedPoolStats } from 'src/interfaces/stats/incentivizedPool.dto';
import {
  LPInformationQueryDto,
  PriceListMap,
  ProtocolDto,
  ProtocolMetricsDto,
  TokenAmountDto,
} from '../dto/dashboardData.dto';

export function mappingCurrencies(lpInformation: LPInformationQueryDto[]): string[] {
  const currencies = [];
  lpInformation.map((lp) => {
    if (lp.dexTrades && lp.dexTrades.length > 0) {
      currencies.push(lp.dexTrades[0].quoteCurrency.address);
      currencies.push(lp.dexTrades[0].baseCurrency.address);
    }
  });
  const uniqueCurrencies = filterUnique(currencies);
  return uniqueCurrencies;
}

export function filterUnique(data: string[]): string[] {
  const unique = [...new Set(data)];
  return unique;
}
export function calculateBalanceToken(
  token0Value: number,
  token1Value: number,
  supply: number,
  balanceLP: number,
): TokenAmountDto {
  const token0 = token0Value / (supply / 1e18);
  const token1 = token1Value / (supply / 1e18);
  const token0Amount = +(token0 * balanceLP);
  const token1Amount = +(token1 * balanceLP);

  return { token0Amount, token1Amount };
}
export function calculateTVLIncentivizedPools(incentivizedPools: IncentivizedPoolStats[], type: string): number {
  let value = 0;
  incentivizedPools.map((pool: any) => {
    if (type === 'jungle' && pool.t0Symbol && pool.id > 20) {
      value += +pool.stakedTvl;
    }
  });
  return value;
}
export function getLastMarketCapAndBurnData(protocol: ProtocolDto) {
  const marketCapData = protocol.marketCap?.history ?? [];
  const burnedData = protocol.burned?.history ?? [];
  const mintedData = protocol.minted?.history ?? [];

  return { marketCapData, burnedData, mintedData };
}
export function mappingProtocolData(protocol: ProtocolDto): ProtocolMetricsDto[] {
  const data = [];
  data.push(protocol.holders);
  data.push(protocol.marketCap);
  data.push(protocol.burned);
  data.push(protocol.pol);
  return data;
}
export function mappingTokensHistory(priceList: PriceListMap, filterPol: any, filterOpp: any, time: string) {
  Object.keys(filterOpp).map((f) => {
    if (!priceList[f]) {
      priceList[f] = {
        chainId: filterOpp[f].chainId,
        history: [],
      };
    }
    priceList[f].history.push({
      time,
      price: filterOpp[f].price,
    });
  });
  Object.keys(filterPol).map((f) => {
    if (!priceList[f]) {
      priceList[f] = {
        chainId: 56,
        history: [],
      };
    }
  });
}

function padTo2Digits(num) {
  return num.toString().padStart(2, '0');
}

export function formatDate(date): string {
  return [date.getUTCFullYear(), padTo2Digits(date.getUTCMonth() + 1), padTo2Digits(date.getUTCDate())].join('-');
}
