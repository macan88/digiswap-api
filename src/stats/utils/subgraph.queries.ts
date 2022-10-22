export interface FiltersDayData {
  first?: number;
  skip?: number;
  startTimestamp?: number;
  endTimestamp?: number;
  order?: string;
  filter: string;
}
export const liquidityQuery = `{
      uniswapFactory(id: "0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6") {
        id
        totalVolumeUSD
        totalLiquidityUSD
        totalLiquidityETH
      }
    }`;

export const polygonLiquidityQuery = `{
      uniswapFactory(id: "0xcf083be4164828f00cae704ec15a36d711491284") {
        id
        totalVolumeUSD
        totalLiquidityUSD
        totalLiquidityETH
      }
    }`;

export const pairsQuery = `{
  pairs {
    id
    token0 {
      id
      symbol
      derivedBNB: derivedETH
			tradeVolumeUSD
    }
    token1 {
      id
      symbol
      derivedBNB: derivedETH
			tradeVolumeUSD
    }
    token0Price
    token1Price
    reserve0
    reserve1
    volumeUSD
    totalSupply
    derivedBNB: reserveETH
  }
}`;

export function topTokensQuery(block: string) {
  let input = '';
  if (block !== 'now') {
    input = ` block: {number: ${block}}`;
  }

  return `{
    tokens(orderBy: tradeVolumeUSD orderDirection: desc first: 500${input}) {
      id
      symbol
      name
      tokenDayData(orderBy: date orderDirection: desc, first: 1) {
        id
        priceUSD
        totalLiquidityUSD
      }
    }
  }`;
}

export const FULL_INFO = `id
date
totalVolumeUSD
dailyVolumeUSD
dailyVolumeBNB: dailyVolumeETH
totalLiquidityUSD
totalLiquidityBNB: totalLiquidityETH`;

export const VOLUME_INFO = `time: date
amount: dailyVolumeUSD`;
export function dayData({ first, skip, startTimestamp, endTimestamp, order = 'desc', filter }: FiltersDayData) {
  const limit = first ? `first: ${first}, skip: ${skip ?? 0},` : '';
  const dateGt = startTimestamp ? `date_gt: ${startTimestamp},` : '';
  const dateLt = endTimestamp ? `date_lt: ${endTimestamp}` : '';
  return `{
    apeswapDayDatas: uniswapDayDatas(${limit} where: { ${dateGt} ${dateLt} }, orderBy: date, orderDirection: ${order}) {
      ${filter}
    }
  }`;
}

export function swapsData(pair: string, startTime: number, endTime: number, first = 1000, skip = 0) {
  return `{
    swaps(where: { pair:"${pair}" timestamp_gt: ${startTime} timestamp_lte: ${endTime}} first: ${first} skip: ${skip} orderBy: timestamp) {
      id
      pair {
        id
        token0 {
          id
        }
        token1 {
          id
        }
      }
      transaction {
        id
      }
      from
      timestamp
      sender
      amountUSD
    }
  }`;
}
export function usersPairDayData(pair: string, startTime: number, endTime: number, first = 1000, skip = 0) {
  return `{
    userPairDayDatas
      (orderBy: date, orderDirection: desc, 
      where: {pair: "${pair}" date_gt: ${startTime} date_lte: ${endTime} } first: ${first} skip: ${skip}) {
        id
        user {
          id
        }
        pair {
          id
        }
        dailyVolumeUSD
        date
    }
  }`;
}
export function userPairDayData(pair: string, startTime: number, endTime: number, address: string) {
  return `{
    userPairDayDatas
      (orderBy: date, orderDirection: desc, 
      where: {pair: "${pair}" date_gt: ${startTime} date_lte: ${endTime} user: "${address}"} ) {
        id
        user {
          id
        }
        pair {
          id
        }
        dailyVolumeUSD
        date
    }
  }`;
}

export const allPricesQuery = `{
  tokens(orderBy: tradeVolumeUSD orderDirection: desc first: 1000) {
    id
    symbol
    name
    derivedBNB: derivedETH
    tokenDayData(orderBy: date orderDirection: desc, first: 1) {
      id
      dailyTxns
      priceUSD
    }
  }
}`;

export const MAIN_NETWORK_PRICE = (block?: number) => {
  const queryString = block
    ? `
    query bundles {
      bundles(where: { id:1 } block: {number: ${block}}) {
        id
        ethPrice
      }
    }
  `
    : ` query bundles {
      bundles(where: { id:1 }) {
        id
        ethPrice
      }
    }
  `;
  return queryString;
};

export const GET_BLOCK = (timestampFrom, timestampTo) => `
  {
    blocks(
      first: 1
      orderBy: timestamp
      orderDirection: asc
      where: { timestamp_gt: ${timestampFrom}, timestamp_lt: ${timestampTo} }
    ) {
      id
      number
      timestamp
    }
  }
`;
export const GET_BLOCKS = (timestamps) => {
  let queryString = 'query blocks {';
  queryString += timestamps.map((timestamp) => {
    return `t${timestamp}:blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${
      timestamp + 600
    } }) {
      number
    }`;
  });
  queryString += '}';
  return queryString;
};

export const PAIRS_BULK = (pairs) => {
  let queryString = `{
    pairs(
      where: {id_in: [`;
  queryString += pairs.map((p) => `"${p.toLowerCase()}",`);
  queryString = queryString.slice(0, -1);
  queryString += `]}
  orderBy: trackedReserveETH
  orderDirection: desc
) {
  id
  txCount
  token0 {
    id
    symbol
    name
    totalLiquidity
    derivedETH
  }
  token1 {
    id
    symbol
    name
    totalLiquidity
    derivedETH
  }
  reserve0
  reserve1
  reserveUSD
  totalSupply
  trackedReserveETH
  reserveETH
  volumeUSD
  untrackedVolumeUSD
  token0Price
  token1Price
  createdAtTimestamp
}
}`;
  return queryString;
};

export const PAIRS_HISTORICAL_BULK = (block, pairs) => {
  let pairsString = `[`;
  pairs.map((pair) => {
    return (pairsString += `"${pair}"`);
  });
  pairsString += ']';
  const queryString = `
  query pairs {
    pairs(first: 200, where: {id_in: ${pairsString}}, block: {number: ${block}}, orderBy: trackedReserveETH, orderDirection: desc) {
      id
      reserveUSD
      trackedReserveETH
      volumeUSD
      untrackedVolumeUSD
    }
  }
  `;
  return queryString;
};

export const PAIR_DATA = (pairAddress, block) => {
  return `
    {
      pairs(${block ? `block: {number: ${block}}` : ``} where: { id: "${pairAddress}"} ) {
        id
    txCount
    token0 {
      id
      symbol
      name
      totalLiquidity
      derivedETH
    }
    token1 {
      id
      symbol
      name
      totalLiquidity
      derivedETH
    }
    reserve0
    reserve1
    reserveUSD
    totalSupply
    trackedReserveETH
    reserveETH
    volumeUSD
    untrackedVolumeUSD
    token0Price
    token1Price
    createdAtTimestamp
      }
    }`;
};
export const TOKEN_PRICE = (address: string, block: number, first: number) => {
  return `query tokenPrice {
    token(
      id: "${address.toLowerCase()}"
      ${block ? `block: {number: ${block}}` : ``}
    ) {
      tokenDayData(orderBy: date, orderDirection: desc,first: ${first}) {
        priceUSD
        token {
          name
        }
        date
      }
    }
  }`;
};
export const VALUE_PAIRS_DAILY = (date: number) => {
  return `{
    pairDayDatas(
      orderBy: date
      orderDirection: desc
      where: {date: ${date}}
      first: 500
    ) {
      id
      pairAddress
      reserveUSD
      date
    }
  }`;
};
