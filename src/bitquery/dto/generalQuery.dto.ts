export class CurrencyDto {
  address: string;
  symbol: string;
  name: string;
}
export class BalanceDto {
  currency: {
    symbol: string;
    address: string;
  };
  value: number;
}
export class DexTradesDto {
  smartContract: {
    address: {
      address: string;
    };
  };
  quoteCurrency: CurrencyDto;
  baseCurrency: CurrencyDto;
}
export class BalanceTokensDto {
  balance: {
    balances?: BalanceDto[];
  }[];
  dexTrades: DexTradesDto[];
}
export class AddressGeneralInformationDto {
  address: string;
  balances: BalanceDto[];
  smartContract: {
    attributes: {
      value: number;
      name: string;
      address: {
        address: string;
      };
    }[];
  };
}
