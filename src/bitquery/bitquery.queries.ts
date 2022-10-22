import { CandleOptionsDto } from './dto/candle.dto';

export const QUOTE_CURRENCY_BSC = {
  WBNB: {
    symbol: 'wbnb',
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    stable: false,
  },
  BUSD: {
    symbol: 'busd',
    address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    stable: true,
  },
  USDT: {
    symbol: 'usdt',
    address: '0x55d398326f99059ff775485246999027b3197955',
    stable: true,
  },
};
export const QUOTE_CURRENCY_MATIC = {
  USDT: {
    symbol: 'usdt',
    address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    stable: true,
  },
  USDC: {
    symbol: 'busd',
    address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    stable: true,
  },
};

export function queryPairInformation(address: string, network: string) {
  return `{
        ethereum(network: ${network}) {
            smartContractCalls(
              options: {desc: "count", limit: 10, offset: 0}
          date: {since: null, till: null}
          caller: {is: "${address}"}
        ) {
              smartContract {
                address {
                  address
                  annotation
            }
            contractType
            currency {
                  name
                  symbol
            }
      }
          max_date: maximum(of: date)
          count
          uniq_methods: count(uniq: smart_contract_methods)
          gasValue(calculate: average)
    }
  }}`;
}

export function queryPoolBalances(
  addressLP: string,
  network: string,
  baseAddress: string,
  targetAddress: string,
  quoteCurrency: string,
) {
  return `{
        ethereum(network: ${network}) {
          address(address: {is: "${addressLP}"}) {
            balances(currency: {in: ["${baseAddress}","${targetAddress}"]}) {
              currency {
                symbol
                address
              }
              value
            }
          }
          transfers {
            minted: amount(
              calculate: sum
              sender: {is: "0x0000000000000000000000000000000000000000"}
            )
            burned: amount(
              calculate: sum
              receiver: {in: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001", "0x000000000000000000000000000000000000dead"]}
            )
            currency(currency: {is: "${addressLP}"}) {
              symbol
              name
            }
          }
        base: dexTrades(
            baseCurrency: {is: "${baseAddress}"}
            quoteCurrency: {is: "${quoteCurrency}"}
            options: {desc: ["block.height", "transaction.index"], limit: 1}
          ) {
            block {
              height
              timestamp {
                time(format: "%Y-%m-%d %H:%M:%S")
              }
            }
            transaction {
              index
            }
            quotePrice
            }
        target: dexTrades(
            baseCurrency: {is: "${targetAddress}"}
            quoteCurrency: {is: "${quoteCurrency}"}
            options: {desc: ["block.height", "transaction.index"], limit: 1}
          ) {
            block {
              height
              timestamp {
                time(format: "%Y-%m-%d %H:%M:%S")
              }
            }
            transaction {
              index
            }
            quotePrice
            }
          }
      }
      `;
}
export function queryTokenInformation(network: string, baseCurrency: string, quoteCurrency: string) {
  return `{
        ethereum(network: ${network}) {
          transfers(date: {since: null, till: null}, amount: {gt: 0}) {
            minted: amount(
              calculate: sum
            sender: {in: ["0x0000000000000000000000000000000000000000","0x0000000000000000000000000000000000000001"]}
        )
        burned: amount(
              calculate: sum
            receiver: {in: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001", "0x000000000000000000000000000000000000dead"]}
        )
        currency(currency: {is: "${baseCurrency}"}) {
              symbol
            name
      }
    }
      dexTrades(
            baseCurrency: {is: "${baseCurrency}"}
          quoteCurrency: {is: "${quoteCurrency}"}
          options: {desc: ["block.height", "transaction.index"], limit: 1}
      ) {
            block {
              height
            timestamp {
                time(format: "%Y-%m-%d %H:%M:%S")
                unixtime
        }
      }
        transaction {
              index
      }
        quotePrice
    }
  }
}`;
}

export function queryCandleData(
  baseCurrency: string,
  quoteCurrency: string,
  network: string,
  options: CandleOptionsDto,
) {
  const { from: since, to: till, minTrade, interval: window } = options;
  return `{
        ethereum(network: ${network}) {
          dexTrades(
            options: {asc: "timeInterval.minute"}
            date: {since: "${since}", till: "${till}"}
            baseCurrency: {is: "${baseCurrency}"}
            quoteCurrency: {is: "${quoteCurrency}"}
            tradeAmountUsd: {gt: ${minTrade}}
            exchangeName: {is: "DigiDex"}
          ) {
            timeInterval {
              minute(count: ${window}, format: "%Y-%m-%dT%H:%M:%SZ")
            }
            baseCurrency {
              symbol
              address
            }
            quoteCurrency {
              symbol
              address
            }
            tradeAmount(in: USD)
            trades: count
            quotePrice
            maximum_price: quotePrice(calculate: maximum)
            minimum_price: quotePrice(calculate: minimum)
            open_price: minimum(of: block, get: quote_price)
            close_price: maximum(of: block, get: quote_price)
          }
        }
      }`;
}

export function queryTreasuryGdigi(address: string) {
  return `{
    ethereum(network: bsc) {
      address(address: {is: "${address}"}) {
        smartContract {
          attributes {
            name
            type
            address {
              address
              annotation
            }
            value
          }
        }
      }
    }
  }
  `;
}

export function queryLPVolume(network: string, fromDate: string, toDate: string) {
  return `
 query($address: [String!], $baseCurrency: [String!]){
  ethereum(network: ${network}) {
    address(address: {in: $address}) {
      balances(currency: {in: $baseCurrency}) {
        currency {
          symbol
          address
        }
        value
      }
      address
    }
    dexTrades(
      options: {desc: "count"}
      smartContractAddress: {in: $address}
      time: {between: ["${fromDate}", "${toDate}"]}
    ) {
      count
      tradeAmount(in: USDT)
      smartContract {
        address {
          address
        }
      }
    }
  }
}
  `;
}

export function queryLPTreasuryBill() {
  return `query ($address: [String!]) {
    ethereum(network: bsc) {
      smartContractCalls(
        options: {desc: "count", offset: 0}
        caller: {in: $address}
        smartContractType: {is: DEX}
      ) {
        caller {
          address
        }
        smartContract {
          address {
            address
          }
          contractType
        }
        count
      }
    }
  }
  `;
}

export function queryTreasuryAddressInformation() {
  return `query ($network: EthereumNetwork!, $lpAddresses: [String!], $principalAddress:[ String!]) {
    ethereum(network: $network) {
      address(address: {in: $principalAddress}) {
        balances(currency: {in: $lpAddresses}) {
          currency {
            symbol
            address
          }
          value
        }
      }
      dexTrades(options: {limit: 1}, smartContractAddress: {in: $lpAddresses}) {
        smartContract {
          address {
            address
          }
        }
        quoteCurrency {
          address
          symbol
          name
        }
        baseCurrency {
          address
          name
          symbol
        }
      }
    }
  }
  `;
}

export function queryAddressGeneralInformation() {
  return `query ($network: EthereumNetwork!, $lpAddresses: [String!], $currencies: [String!]) {
    ethereum(network: $network) {
      address(address: {in: $lpAddresses}) {
        address
        balances(
          currency: {in: $currencies}
        ) {
          currency {
            address
            symbol
          }
          value
        }
        smartContract {
          attributes {
            value
            name
            address {
              address
            }
          }
        }
      }
    }
  }
  `;
}

export function queryGetTokenPrice() {
  return `query ($network: EthereumNetwork!, $address: String!, $quoteCurrency: String!, $mainCurrency: String!, $date: ISO8601DateTime) {
    ethereum(network: $network) {
      tokenPrice: dexTrades(
        options: {limit: 1, desc: "block.timestamp.time"}
        baseCurrency: {is: $address}
        quoteCurrency: {is: $quoteCurrency}
        tradeAmountUsd: {gt: 10}
        date: {till: null, since: $date}
      ) {
        baseCurrency {
          address
          symbol
          name
        }
        block {
          timestamp {
            time(format: "%Y-%m-%d %H:%M:%S")
          }
        }
        count
        quotePrice(calculate: median)
      },
      mainPrice: dexTrades(
        options: {limit: 1, desc: "block.timestamp.time"}
        baseCurrency: {is: $quoteCurrency}
        quoteCurrency: {is: $mainCurrency}
        date: {till: null, since: $date}
      ) {
        block {
          height
          timestamp {
            time(format: "%Y-%m-%d %H:%M:%S")
          }
        }
        quoteCurrency {
          symbol
        }
        quotePrice
      }
    }
  }`;
}

export function queryTransfers() {
  return `query($network: EthereumNetwork!, $receiver: [String!], $curriencies: [String!], $date: ISO8601DateTime){
    ethereum(network: $network) {
      transfers(
        options: {asc: "block.timestamp.time"}
        date: {till: null, since: $date}
        amount: {gt: 0}
        receiver: {in: $receiver}
        currency: {in: $curriencies}
      ) {
        block {
          timestamp {
            time(format: "%Y-%m-%d %H:%M:%S")
          }
          height
        }
        amount
        currency {
          address
          symbol
        }
      }
    }
  }
  `;
}

export function querySupplyAndPrice() {
  return `query($network: EthereumNetwork!, $principalToken: String!, $mainToken: String!, $quoteCurrency: String!, $from: ISO8601DateTime, $to: ISO8601DateTime){
    ethereum(network: $network) {
      dexTrades(
        baseCurrency: {is: $principalToken}
        quoteCurrency: {is: $mainToken}
        options: {desc: ["block.height", "transaction.index"], limit: 1}
        date: {since: $from, till: $to}
      ) {
        block {
          height
          timestamp {
            time(format: "%Y-%m-%d %H:%M:%S")
          }
        }
        transaction {
          index
        }
        baseCurrency {
          symbol
        }
        quoteCurrency {
          symbol
        }
        quotePrice
      }
      mainPrice: dexTrades(
        baseCurrency: {is: $mainToken}
        quoteCurrency: {is: $quoteCurrency}
        options: {desc: ["block.height", "transaction.index"], limit: 1}
        date: {since: $from, till: $to}
      ) {
        block {
          height
          timestamp {
            time(format: "%Y-%m-%d %H:%M:%S")
          }
        }
        transaction {
          index
        }
        baseCurrency {
          symbol
        }
        quoteCurrency {
          symbol
        }
        quotePrice
      }
      transfers(date: {since: $from, till: $to}, amount: {gt: 0}) {
        minted: amount(
          calculate: sum
          sender: {is: "0x0000000000000000000000000000000000000000"}
        )
        burned: amount(
          calculate: sum
          receiver: {in: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001", "0x000000000000000000000000000000000000dead"]}
        )
        currency(currency: {is: $principalToken}) {
          symbol
          name
        }
      }
    }
  }
  `;
}
export function queryBalancesPoolAddressByDate() {
  return `query ($address: [String!], $from: ISO8601DateTime, $to: ISO8601DateTime, $currency: String!){
    ethereum(network: bsc) {
      address(
        address: {in: $address}
      ) {
        balances(
          currency: {is: $currency}
          date: {since: $from, till: $to}
        ) {
          value
        }
      }
    }
  }
  `;
}
export function queryMultipleBalanceByDate() {
  return `query ($address: [String!], $currency: [String!], $from: ISO8601DateTime, $to: ISO8601DateTime, $network: EthereumNetwork!) {
    ethereum(network: $network) {
      address(address: {in: $address}) {
        balances(
          currency: {in: $currency}
          date: {since: $from, till: $to}
        ) {
          value
          currency {
            address
            symbol
          }
        }
        address
      }
    }
  }
  `;
}
export function queryMintedBurnedToken() {
  return `query($network: EthereumNetwork!, $address: String!, $from: ISO8601DateTime, $to: ISO8601DateTime){
    ethereum(network: $network) {
      transfers(date: {since: $from, till: $to}) {
        minted: amount(
          calculate: sum
          sender: {is: "0x0000000000000000000000000000000000000000"}
        )
        burned: amount(
          calculate: sum
          receiver: {in: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000001", "0x000000000000000000000000000000000000dead"]}
        )
        currency(currency: {is: $address}) {
          symbol
          name
        }
      }
    }
  }`;
}
