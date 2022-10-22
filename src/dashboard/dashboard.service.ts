import { HttpService, Injectable, Logger } from '@nestjs/common';
import {
  BillsConfig,
  HistoryInformationDto,
  HistoryTreasury,
  LendingMarketsDto,
  LocationDescription,
  MiscDescriptions,
  NetworkDescriptionMap,
  OperationBalanceCurrencyDto,
  PairInformationDto,
  ProtocolMetricsDescriptions,
  ProtocolMetricsDto,
  TokenPriceFilter,
  TokenTreasuryDto,
  TreasuryDto,
  Vault,
} from './dto/dashboardData.dto';
import { BitqueryService } from 'src/bitquery/bitquery.service';
import { multicall, multicallNetwork } from 'src/utils/lib/multicall';
import { LP_ABI } from 'src/stats/utils/abi/lpAbi';
import { PriceService } from 'src/stats/price.service';
import { Dashboard as DashboardDB, DashboardDocument } from './schemas/dashboard.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { calculateBalanceToken, filterUnique, formatDate, mappingCurrencies } from './helpers/helpers';
import { ConfigService } from '@nestjs/config';
import { OLA_COMPOUND_ABI } from 'src/stats/utils/abi/olaCompoundAbi';
import { SubgraphService } from 'src/stats/subgraph.service';
import { LendingMetadataDto } from 'src/interfaces/stats/lendingMarket.dto';
import { BalanceTokensDto, AddressGeneralInformationDto, CurrencyDto } from 'src/bitquery/dto/generalQuery.dto';
import { PricesMap } from 'src/interfaces/stats/misc.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly NETWORKS = this.config.get<NetworkDescriptionMap>('chainNetworksAvailables');
  constructor(
    private config: ConfigService,
    private bitqueryService: BitqueryService,
    private httpService: HttpService,
    private priceService: PriceService,
    @InjectModel(DashboardDB.name)
    private dashboardModel: Model<DashboardDocument>,
    private subgraphService: SubgraphService,
  ) {}

  async getTreasuryData(): Promise<TreasuryDto> {
    const info = await this.verifyDashboardData('treasury');
    if (info) return info.treasury;
    await this.createOrUpdateDashboardData({ 'treasury.createdAt': new Date() });
    this.calculateTreasuryData();
    const dashboard = await this.findDashboardData();
    return dashboard.treasury;
  }
  async calculateTreasuryData(): Promise<TreasuryDto> {
    this.logger.log('Attemping to calculate Treasury Data...');
    try {
      const data: TreasuryDto = {
        value: 0,
        lpTokens: [],
        valueOperational: 0,
        valuePol: 0,
        tokens: [],
        valueApePol: 0,
        valuePartnerPol: 0,
      };

      await this.calculatePol(data);
      await this.calculateOperationalFunds(data);
      await this.mappingHistoryPolOperational();
      data.value = data.valuePol + data.valueOperational;
      data.createdAt = new Date();
      await this.createOrUpdateDashboardData({ treasury: data });
      this.logger.log('Successfully generated Treasury Data.');
      return data;
    } catch (error) {
      this.logger.error(error.message);
      this.logger.error('Something went wrong generated Treasury Data. Get from database');
      const dashboard = await this.findDashboardData();
      return dashboard.treasury;
    }
  }

  async getHistory(): Promise<HistoryTreasury[]> {
    const dashboard = await this.findDashboardData();
    return dashboard.history.history;
  }

  async mappingHistoryPol(data: TreasuryDto) {
    const { valuePol, valueApePol, valuePartnerPol } = data;
    const dashboard = await this.findDashboardData();
    const pol = dashboard.historyTreasury?.pol;
    const last: string = pol ? Object.keys(pol)[Object.keys(pol).length - 1] : '';
    const formatLastTime = formatDate(new Date());
    if (last !== '' && !dashboard.historyTreasury?.pol[formatLastTime]) {
      dashboard.historyTreasury.pol[formatLastTime] = {
        lastDate: formatLastTime,
        value: valuePol,
        apeValue: valueApePol,
        partnerValue: valuePartnerPol,
      };
    }
    if (last !== '' && dashboard.historyTreasury?.pol[formatLastTime]) {
      dashboard.historyTreasury.pol[formatLastTime].value = valuePol;
      dashboard.historyTreasury.pol[formatLastTime].apeValue = valueApePol;
      dashboard.historyTreasury.pol[formatLastTime].partnerValue = valuePartnerPol;
      await this.createOrUpdateDashboardData({ 'historyTreasury.pol': dashboard.historyTreasury.pol });
    }
    let amount = 0;
    const mapping = Object.values(pol).map((f: HistoryInformationDto) => {
      const date = new Date(f.lastDate);
      amount = f.value;
      return {
        time: date.getTime() / 1000,
        amount: f.value,
        apeValue: f.apeValue,
        partnerValue: f.partnerValue,
      };
    });
    const info: ProtocolMetricsDto = {
      description: ProtocolMetricsDescriptions.pol,
      amount,
      type: 'money',
      history: mapping,
    };
    await this.createOrUpdateDashboardData({ 'protocol.pol': info });
  }
  async mappingHistoryPolOperational() {
    const dashboard = await this.dashboardModel.findOne();
    const pol = dashboard.historyTreasury.pol;
    const operational = dashboard.historyTreasury.operational;
    const dates = [...Object.keys(operational), ...Object.keys(pol)];
    const uniqueDates: string[] = filterUnique(dates);
    uniqueDates.sort();
    const historyTreasury: HistoryTreasury[] = [];
    uniqueDates.map((time: string) => {
      const date = new Date(time);
      const polValue = pol[time]?.value ?? 0;
      const apePolValue = pol[time]?.apeValue ?? 0;
      const partnerPolValue = pol[time]?.partnerValue ?? 0;
      const oppFundValue = operational[time]?.value ?? 0;
      if (polValue > 0 && oppFundValue > 0) {
        historyTreasury.push({
          timestamp: date.getTime() / 1000,
          oppFundValue,
          polValue,
          apePolValue,
          partnerPolValue,
        });
      }
    });
    await this.createOrUpdateDashboardData({ history: { history: historyTreasury, createdAt: new Date() } });
  }

  async findPairInformationByBlock(
    address: string,
    block: number,
    amount: number,
    chainId = 56,
  ): Promise<PairInformationDto> {
    const { data } = await this.subgraphService.getPairHistory({ id: address }, block, chainId);
    const pairs = data ? data.pairs : null;
    if (pairs) {
      const { reserveUSD, totalSupply, reserve0, reserve1, token0, token1 } = pairs[0];
      const price = reserveUSD / totalSupply;
      const reservePerUnit0 = reserve0 / totalSupply;
      const reservePerUnit1 = reserve1 / totalSupply;
      const reserveTotal0 = reservePerUnit0 * amount;
      const reserveTotal1 = reservePerUnit1 * amount;
      const total = price * amount;
      const token0value = total / 2 / reserveTotal0;
      const token1value = total / 2 / reserveTotal1;
      return {
        price,
        reservePerUnit0,
        reservePerUnit1,
        reserveTotal0,
        reserveTotal1,
        reserve0,
        reserve1,
        token0: {
          ...token0,
          amount: reserveTotal0,
          value: token0value * reserveTotal0,
        },
        token1: {
          ...token1,
          amount: reserveTotal1,
          value: token1value * reserveTotal1,
        },
        totalSupply,
        amount,
      };
    } else {
      const { base, target, liquidity, totalSupply } = await this.bitqueryService.calculatePairInformation(
        address,
        this.NETWORKS[chainId].chain,
      );
      const reserveUSD = liquidity;
      const price = reserveUSD / totalSupply;
      const reservePerUnit0 = base.pooled_token / totalSupply;
      const reservePerUnit1 = target.pooled_token / totalSupply;
      const reserveTotal0 = reservePerUnit0 * amount;
      const reserveTotal1 = reservePerUnit1 * amount;
      return {
        price,
        reservePerUnit0,
        reservePerUnit1,
        reserveTotal0,
        reserveTotal1,
        token0: {
          id: base.address,
          symbol: base.name,
          amount: base.pooled_token,
          value: base.price * base.pooled_token,
        },
        token1: {
          id: target.address,
          symbol: target.name,
          amount: target.pooled_token,
          value: target.price * target.pooled_token,
        },
        totalSupply,
        amount,
      };
    }
  }

  async calculatePol(data: TreasuryDto) {
    const LPTreasury = await this.getLPTreasury();
    let apeValue = 0,
      partnerValue = 0;
    await Promise.all(
      Object.values(this.NETWORKS).map(async ({ id: chainId, chain }) => {
        const filterBills = LPTreasury.filter((a) => a.lpToken.address[chainId] !== '');
        if (filterBills.length !== 0) {
          const mappingBills = filterBills.map((a) => a.lpToken.address[chainId].toLowerCase());
          const mappingLPTreasury = [...new Set(mappingBills)];
          const lpInformation = await Promise.all(
            mappingLPTreasury.map((mapping) =>
              this.bitqueryService.getTreasuryAddressInformation(
                chain,
                [mapping],
                this.config.get<string[]>(`${chainId}.contracts.pol`),
              ),
            ),
          );
          const currencies = mappingCurrencies(lpInformation);
          const prices = await this.priceService.getTokenPricesv2(chainId, currencies);
          mappingLPTreasury.map((address: string) => {
            const type =
              LPTreasury.find((lp) => lp.lpToken.address[chainId].toLowerCase() === address).billType.toLowerCase() ===
              MiscDescriptions.bananaBill
                ? MiscDescriptions.digiswap
                : MiscDescriptions.partner;
            data.lpTokens.push({ address, chainId, location: LocationDescription.pol, type });
          });
          const infoLPBalances = await this.bitqueryService.getAddressGeneralInformation(
            chain,
            mappingLPTreasury,
            currencies,
          );
          const promises = [];
          data.lpTokens.map((lp) => {
            const tokens = lpInformation.find(
              (info) =>
                info.dexTrades &&
                info.dexTrades.length > 0 &&
                info.dexTrades[0].smartContract.address.address.toLowerCase() === lp.address,
            );
            if (tokens) {
              promises.push(this.getTokensAndPriceInformation(tokens, lp.address, infoLPBalances, prices, chainId));
            }
          });
          const result = await Promise.all(promises);
          for (let index = 0; index < result.length; index++) {
            const {
              quoteCurrency,
              baseCurrency,
              token0Amount,
              token0Price,
              token1Amount,
              token1Price,
              lpSupply,
              lpAddress,
            } = result[index];
            const lp = data.lpTokens.find((lp) => lp.address === lpAddress);
            const lpValue = +token0Price + +token1Price;
            data.valuePol += lpValue;
            if (lp.type === MiscDescriptions.digiswap) {
              apeValue += lpValue;
            } else {
              partnerValue += lpValue;
            }
            data.valueApePol = apeValue;
            data.valuePartnerPol = partnerValue;
            lp.value = lpValue;
            lp.amount = lpSupply;
            lp.token0 = {
              address: quoteCurrency.address,
              symbol: quoteCurrency.symbol,
              amount: token0Amount,
              value: token0Price,
              location: LocationDescription.pol,
              chainId: chainId,
            };
            lp.token1 = {
              address: baseCurrency.address,
              symbol: baseCurrency.symbol,
              amount: token1Amount,
              value: token1Price,
              location: LocationDescription.pol,
              chainId: chainId,
            };
          }
          await this.mappingHistoryPol(data);
        }
      }),
    );
  }
  async calculateOperationalFunds(data: TreasuryDto) {
    const principalInfo = {};
    let promises = [];
    Object.values(this.NETWORKS).map(({ id: chainId }) => {
      const operationalBalanceCurrency: OperationBalanceCurrencyDto[] = this.config.get<OperationBalanceCurrencyDto[]>(
        `${chainId}.operationalBalanceCurrency`,
      );
      const operationalAddress = this.config.get<string>(`${chainId}.contracts.operational`);
      if (!principalInfo[chainId]) {
        principalInfo[chainId] = {
          operationalBalanceCurrency,
          operationalAddress,
        };
      }
      promises.push(
        this.bitqueryService.getAddressGeneralInformation(
          this.NETWORKS[chainId].chain,
          [operationalAddress],
          operationalBalanceCurrency.map((currency) => currency.address),
        ),
      );
    });
    const resultTokensBalance = await Promise.all(promises);
    promises = [];
    const partialInfo = [];
    const networksSymbol = Object.values(this.NETWORKS).map((network) => network.symbol);
    Object.values(this.NETWORKS).map(({ id: chainId }) => {
      const operationalBalanceCurrency = principalInfo[chainId].operationalBalanceCurrency;
      operationalBalanceCurrency.map((currency) => {
        const { isLP } = currency;
        let { address } = currency;
        let balance;
        for (let i = 0; i < resultTokensBalance.length; i++) {
          const item = resultTokensBalance[i][0];
          balance = item.balances.find(
            (info) =>
              info.currency.address.toLowerCase() === address.toLowerCase() ||
              address.toLowerCase() === info.currency.symbol.toLowerCase(),
          );
          if (balance) break;
        }
        if (networksSymbol.includes(address.toLowerCase()))
          address = this.config.get<string>(`${chainId}.contracts.${address.toLowerCase()}`);

        const basicInfo = {
          address,
          chainId,
          location: LocationDescription.operation,
          value: 0,
          amount: balance?.value ?? 0,
        };
        if (isLP) {
          promises.push(this.findPairInformationByBlock(address, 0, balance?.value ?? 0, chainId));
          const tokenData = {
            address: '',
            symbol: '',
            amount: 0,
            value: 0,
            location: LocationDescription.operation,
            chainId: chainId,
          };
          partialInfo.push({
            isLP,
            data: {
              ...basicInfo,
              type: 'digiswap',
              token0: { ...tokenData },
              token1: { ...tokenData },
            },
          });
        } else {
          promises.push(
            this.findTokenPrice({
              address,
              chainId,
              currency,
              operationalBalanceCurrency,
            }),
          );
          partialInfo.push({
            isLP,
            data: {
              ...basicInfo,
              symbol: balance?.currency.symbol,
              price: 0,
            },
          });
        }
      });
    });
    const resultPricesAddresses = await Promise.all(promises);
    for (let index = 0; index < partialInfo.length; index++) {
      const info = partialInfo[index];
      const { price } = resultPricesAddresses[index];
      const totalPrice = info.data.amount * price;
      info.data.value = totalPrice;
      if (info.isLP) {
        const resultInfo = { ...resultPricesAddresses[index] };
        info.data.token0.address = resultInfo.token0.id;
        info.data.token0.symbol = resultInfo.token0.symbol;
        info.data.token0.amount = resultInfo.token0.amount;
        info.data.token0.value = resultInfo.token0.value;
        info.data.token1.address = resultInfo.token1.id;
        info.data.token1.symbol = resultInfo.token1.symbol;
        info.data.token1.amount = resultInfo.token1.amount;
        info.data.token1.value = resultInfo.token1.value;
        data.lpTokens.push(info.data);
      } else {
        info.data.price = price;
        data.tokens.push(info.data);
      }
      data.valueOperational += totalPrice;
    }
    await this.calculateLendingMarketData(data);
    const dashboard = await this.findDashboardData();
    const last: string = dashboard.historyTreasury?.operational
      ? Object.keys(dashboard.historyTreasury.operational)[
          Object.keys(dashboard.historyTreasury.operational).length - 1
        ]
      : '';
    const formatLastTime = formatDate(new Date());
    if (last !== '' && !dashboard.historyTreasury?.operational[formatLastTime]) {
      dashboard.historyTreasury.operational[formatLastTime] = {
        lastDate: formatLastTime,
        value: data.valueOperational,
      };
    }
    if (last !== '' && dashboard.historyTreasury?.operational[formatLastTime]) {
      dashboard.historyTreasury.operational[formatLastTime].value = data.valueOperational;
      await this.createOrUpdateDashboardData({
        'historyTreasury.operational': dashboard.historyTreasury.operational,
      });
    }
  }
  async getTokensAndPriceInformation(
    tokens: BalanceTokensDto,
    lpAddress: string,
    infoLPBalances: AddressGeneralInformationDto[],
    prices: PricesMap,
    chainId: number,
  ): Promise<{
    quoteCurrency: CurrencyDto;
    baseCurrency: CurrencyDto;
    token0Amount: number;
    token0Price: number;
    token1Amount: number;
    token1Price: number;
    lpSupply: number;
    lpAddress: string;
  }> {
    const quoteCurrency = tokens.dexTrades[0].quoteCurrency;
    const baseCurrency = tokens.dexTrades[0].baseCurrency;
    let lpSupply = 0;
    tokens.balance.map((balance) => {
      if (balance.balances) lpSupply += +balance.balances[0].value;
    });

    const lpBalance = infoLPBalances.find((balance) => balance.address.toLowerCase() === lpAddress);
    let totalSupply = lpBalance.smartContract.attributes.find((a) => a?.name === 'totalSupply')?.value ?? 0;
    if (totalSupply === 0) {
      const [supply] = await multicallNetwork(
        LP_ABI,
        [
          {
            address: lpAddress,
            name: 'totalSupply',
          },
        ],
        chainId,
      );
      totalSupply = +supply;
    }
    const { token0Amount, token1Amount } = calculateBalanceToken(
      lpBalance.balances.find((l) => l.currency.address.toLowerCase() === quoteCurrency.address).value,
      lpBalance.balances.find((l) => l.currency.address.toLowerCase() === baseCurrency.address).value,
      totalSupply,
      lpSupply,
    );
    const token0Price = prices[quoteCurrency.address].usd * token0Amount;
    const token1Price = prices[baseCurrency.address].usd * token1Amount;

    return { quoteCurrency, baseCurrency, token0Amount, token0Price, token1Amount, token1Price, lpSupply, lpAddress };
  }
  async findTokenPrice({
    address,
    chainId,
    block = 0,
    timestamp = null,
    operationalBalanceCurrency = null,
    currency = null,
    limit = 1,
  }: TokenPriceFilter): Promise<{ price: number }> {
    let price = await this.calculateTokenPriceV2(address, chainId, block, limit);
    if (Array.isArray(price) || price > 0) return { price };
    const contract = currency.address !== '-' ? currency.address.toLowerCase() : currency.symbol;
    const find = operationalBalanceCurrency.find(
      (currency) => currency.address.toLowerCase() === contract.toLowerCase(),
    );
    const time = timestamp ? new Date(timestamp).toISOString() : null;
    price = find ? await this.calculateTokenPrice(contract, find.mainToken, chainId, time) : 0;
    return { price };
  }
  async calculateTokenPriceV2(address: string, chainId: number, block: number, limit: number): Promise<number> {
    try {
      const {
        token: { tokenDayData },
      } = await this.subgraphService.getTokenPriceByBlock(address, chainId, block, limit);
      return tokenDayData.length > 0 ? (block > 0 || limit === 1 ? tokenDayData[0].priceUSD : tokenDayData) : 0;
    } catch (error) {
      return 0;
    }
  }
  async calculateTokenPrice(address: string, mainToken: string, chainId: number, date = null): Promise<number> {
    try {
      const { tokenPrice, mainPrice } = await this.bitqueryService.getTokenPrice(
        this.NETWORKS[chainId].chain,
        address,
        mainToken,
        this.config.get<string>(`${chainId}.operationalMainData.mainCurrency`),
        date,
      );

      const priceToken =
        tokenPrice.length > 0
          ? tokenPrice[0].baseCurrency.address !== '-'
            ? tokenPrice[0].quotePrice * (mainPrice.length > 0 ? mainPrice[0].quotePrice : 1)
            : mainPrice[0].quotePrice
          : mainPrice.length > 0
          ? mainPrice[0].quotePrice
          : 0;

      return priceToken;
    } catch (error) {
      return 0;
    }
  }
  async getAssetOverview(): Promise<TokenTreasuryDto[]> {
    const data = await this.getTreasuryData();
    const tokens: TokenTreasuryDto[] = [];
    data.tokens.map((token) => {
      const index = tokens.findIndex(
        (t) =>
          (t?.symbol.toLowerCase().includes(token.symbol.toLowerCase()) ||
            token.symbol.toLowerCase().includes(t?.symbol.toLowerCase()) ||
            t?.symbol.toLowerCase() === token.symbol.toLowerCase()) &&
          t.location.toLowerCase() === token.location.toLowerCase(),
      );
      if (token.value && token.amount) {
        if (index > -1) {
          tokens[index].value += token.value;
          tokens[index].amount += token.amount;
        } else {
          tokens.push({
            symbol: token.symbol,
            amount: token.amount,
            value: token.value,
            price: token.price,
            location: token.location,
          });
        }
      }
    });
    data.lpTokens.map((token) => {
      if (token.token0?.value && token.token0?.amount) {
        const index0 = tokens.findIndex(
          (t) =>
            t?.symbol.toLowerCase() === token.token0.symbol.toLowerCase() &&
            t.location.toLowerCase() === token.location.toLowerCase(),
        );
        if (index0 > -1) {
          tokens[index0].value += token.token0.value;
          tokens[index0].amount += token.token0.amount;
        } else {
          tokens.push({
            symbol: token.token0.symbol,
            amount: token.token0.amount,
            value: token.token0.value,
            price: token.token0.price,
            location: token.location,
          });
        }
      }
      if (token.token1?.value && token.token1?.amount) {
        const index1 = tokens.findIndex(
          (t) =>
            t?.symbol.toLowerCase() === token.token1.symbol.toLowerCase() &&
            t.location.toLowerCase() === token.location.toLowerCase(),
        );
        if (index1 > -1) {
          tokens[index1].value += token.token1.value;
          tokens[index1].amount += token.token1.amount;
        } else {
          tokens.push({
            symbol: token.token1.symbol,
            amount: token.token1.amount,
            value: token.token1.value,
            price: token.token1.price,
            location: token.location,
          });
        }
      }
    });
    return tokens;
  }
  async getLPTreasury() {
    const bills = await this.getBillList();
    return bills;
  }
  createOrUpdateDashboardData(data) {
    return this.dashboardModel.updateOne(
      {},
      {
        $set: data,
        $currentDate: {
          createdAt: true,
        },
      },
      {
        upsert: true,
        timestamps: true,
      },
    );
  }

  findDashboardData() {
    return this.dashboardModel.findOne();
  }
  updateCreatedAtDashboard() {
    return this.dashboardModel.updateOne(
      {},
      {
        $currentDate: {
          createdAt: true,
        },
      },
    );
  }
  async verifyDashboardData(type) {
    const now = Date.now();

    const data = await this.findDashboardData();

    if (!data?.[type].createdAt) return null;
    const createdAt = data[type].createdAt;

    const lastCreatedAt = new Date(createdAt).getTime();
    const diff = now - lastCreatedAt;
    const time = 300000;
    if (diff > time) return null;
    delete data.treasury.createdAt;
    delete data.historyTreasury.createdAt;
    delete data.tvl.createdAt;
    delete data.distribution.createdAt;
    return data;
  }
  async getBillList(): Promise<BillsConfig[]> {
    const { data } = await this.httpService.get(this.config.get<string>('billListUrl')).toPromise();
    const filter = data.filter((bill) => !bill.inactive);
    return filter;
  }
  async getVaultsList(): Promise<Vault[]> {
    const { data } = await this.httpService.get(`${this.config.get<string>('apeswapListUrl')}/vaults.json`).toPromise();
    return data;
  }
  async calculateLendingMarketData(data: TreasuryDto) {
    const allLendingMarkets = this.config.get<LendingMarketsDto[]>(`56.lendingMarkets`);
    const olaCompoundLensContract = this.config.get<string>(`56.olaCompoundLens`);
    const operationalAddress = this.config.get<string>(`56.contracts.operational`);
    const infoTokensBalances = await this.bitqueryService.getAddressGeneralInformation(
      this.NETWORKS[56].chain,
      [operationalAddress],
      allLendingMarkets.map((market) => market.contract),
    );
    const callsMetadata = allLendingMarkets.map((markets) => ({
      address: olaCompoundLensContract,
      name: 'cTokenMetadata',
      params: [markets.contract],
    }));
    const allMetadata: [LendingMetadataDto[]] = await multicall(OLA_COMPOUND_ABI, callsMetadata);
    const prices = await this.priceService.getTokenPricesv2(
      56,
      allLendingMarkets.map((markets) => markets.asset),
    );
    for (let index = 0; index < infoTokensBalances[0].balances.length; index++) {
      const info = infoTokensBalances[0].balances[index];
      const lending = allLendingMarkets.find((market) => market.contract.toLowerCase() === info.currency.address);
      const asset = lending.asset.toLowerCase();
      const metadata = allMetadata.find(
        (metadata) => metadata[0]['cToken'].toLowerCase() === lending.contract.toLowerCase(),
      )[0];
      const rate = metadata['exchangeRateCurrent'] / 1e10 / 1e18;
      const units = rate * info.value;
      const price = prices[asset].usd * units;
      const i = data.tokens.findIndex((token) => token.address.toLowerCase() === asset);
      if (i > -1) {
        data.tokens[i].amount += units;
        data.tokens[i].value += price;
      } else {
        data.tokens.push({
          address: asset,
          amount: units,
          symbol: lending.name,
          chainId: 56,
          location: LocationDescription.operation,
          value: price,
          price: prices[asset].usd,
        });
      }
      data.valueOperational += price;
    }
  }
}
