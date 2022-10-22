import { Injectable, Logger } from '@nestjs/common';
import { BitqueryService } from 'src/bitquery/bitquery.service';
import { formatDate, getLastMarketCapAndBurnData } from './helpers/helpers';
import { ConfigService } from '@nestjs/config';
import { SubgraphService } from 'src/stats/subgraph.service';
import { StatsService } from 'src/stats/stats.service';
import { LendingMarketInitialDto } from 'src/interfaces/stats/lendingMarket.dto';
import { DashboardService } from './dashboard.service';
import sleep from 'sleep-promise';
import {
  MiscDescriptions,
  NetworkDescriptionMap,
  OperationBalanceCurrencyDto,
  ProtocolMetricsDescriptions,
  ProtocolMetricsDto,
} from './dto/dashboardData.dto';

@Injectable()
export class DashboardHistoryHelperService {
  private readonly logger = new Logger(DashboardHistoryHelperService.name);
  private readonly FIRST_TIME = 1613174400;
  private readonly NETWORKS = this.config.get<NetworkDescriptionMap>('chainNetworksAvailables');
  constructor(
    private config: ConfigService,
    private bitqueryService: BitqueryService,
    private subgraphService: SubgraphService,
    private statsService: StatsService,
    private dashboardService: DashboardService,
  ) {}

  async calculateAllTvl() {
    await this.calculatePairTvl();
    await this.calculatePoolTvl();
    await this.calculateJungleTvl();
    await this.calculateLendingTvl();
    const dashboard = await this.dashboardService.findDashboardData();
    const mcap = dashboard.protocol.marketCap;
    const tvl = dashboard.tvlHistory;

    const history = [];
    mcap.history.map((cap) => {
      let valueTvl = 0;
      const time = cap.time;
      const valuePair = tvl.pairs.history.find((h) => h.time === time)?.value ?? 0;
      const valuePool = tvl.pools.history.find((h) => h.time === time)?.value ?? 0;
      Object.keys(tvl.jungle).map((jungle) => {
        const valueJungle = tvl.jungle[jungle].history.find((h) => h.time === time)?.value ?? 0;
        valueTvl += valueJungle;
      });
      Object.keys(tvl.lending).map((lend) => {
        const valueLending = tvl.lending[lend].history.find((h) => h.time === time)?.value ?? 0;
        valueTvl += valueLending;
      });
      valueTvl += +valuePair + +valuePool;
      history.push({
        timestamp: time,
        ratio: (cap.amount ?? 0) / valueTvl,
      });
    });
    await this.dashboardService.createOrUpdateDashboardData({ ratio: { history, createdAt: new Date() } });
    return history;
  }
  async calculatePairTvl() {
    const dashboard = await this.dashboardService.findDashboardData();
    const pairs = dashboard.tvlHistory.pairs;
    const now = new Date();
    const nowTime = now.getTime() / 1000;
    let time = pairs ? pairs.history[pairs.history.length - 1].time + 86400 : this.FIRST_TIME;
    const allInfo = {
      total: 0,
      history: pairs ? [...pairs.history] : [],
    };
    const promises = [];
    while (time < nowTime) {
      promises.push(this.subgraphService.getValuePairsByDate(time));
      time += 86400;
    }
    const result = await Promise.all(promises);
    for (let index = 0; index < result.length; index++) {
      const pairDays = result[index];
      let value = 0;
      pairDays.map((p: any) => {
        value += +p.reserveUSD;
      });
      allInfo.total += value;
      allInfo.history.push({
        time,
        value,
      });
    }
    await this.dashboardService.createOrUpdateDashboardData({ 'tvlHistory.pairs': allInfo });
    this.logger.log('Success pair tvl');
  }
  async calculatePoolTvl() {
    const pools = await this.statsService.getIncentivizedPools();
    const onlyBananaPools = pools.filter(
      (pool) => pool.stakeToken.toLowerCase() === this.config.get<string>('56.contracts.digichain'),
    );
    const onlyGnanaPools = pools.filter(
      (pool) => pool.stakeToken.toLowerCase() === this.config.get<string>('56.contracts.goldenBanana'),
    );
    const contractsBananaPool = onlyBananaPools.map((pool) => pool.address);
    contractsBananaPool.push(this.config.get<string>('56.contracts.masterDigi'));
    const contractsGnanaPool = onlyGnanaPools.map((pool) => pool.address);
    const lastHour = 'T23:59:59';
    const now = new Date();
    const nowTime = now.getTime();
    const dashboard = await this.dashboardService.findDashboardData();
    const historyPool =
      dashboard.tvlHistory.pools && dashboard.tvlHistory.pools.history.length > 0 ? dashboard.tvlHistory.pools : null;
    let initTime = historyPool ? historyPool.history[historyPool.history.length - 1].time + 86400 : 1613260800;
    let initTimeDate = new Date(initTime * 1000);
    let fromTime = formatDate(initTimeDate);
    let toTime = `${fromTime}${lastHour}`;
    let amountBanana = historyPool ? historyPool.history[historyPool.history.length - 1].amountBanana : 0;
    let amountGnana = historyPool ? historyPool.history[historyPool.history.length - 1].amountGnana : 0;
    const allInfo = {
      total: 0,
      history: historyPool ? [...historyPool.history] : [],
    };
    const historyPriceBanana = await this.subgraphService.getTokenPriceByBlock(
      this.config.get<string>('56.contracts.digichain'),
      56,
      0,
      1000,
    );
    const promisesBalancesBanana = [];
    const promisesBalancesGnana = [];
    const priceList = [];
    while (initTimeDate.getTime() < nowTime) {
      promisesBalancesBanana.push(
        this.bitqueryService.getBalancesPoolAddressByDate(
          contractsBananaPool,
          fromTime,
          toTime,
          this.config.get<string>('56.contracts.digichain'),
        ),
      );
      promisesBalancesGnana.push(
        this.bitqueryService.getBalancesPoolAddressByDate(
          contractsGnanaPool,
          fromTime,
          toTime,
          this.config.get<string>('56.contracts.goldenBanana'),
        ),
      );
      const findPrice = historyPriceBanana.token.tokenDayData.find((p: any) => p.date === initTime);
      const price = findPrice ? findPrice.priceUSD : 0;
      priceList.push(price);
      initTime += 86400;
      initTimeDate = new Date(initTime * 1000);
      fromTime = formatDate(initTimeDate);
      toTime = `${fromTime}${lastHour}`;
    }
    const resultBalancesBanana = await Promise.all(promisesBalancesBanana);
    const resultBalancesGnana = await Promise.all(promisesBalancesGnana);
    for (let index = 0; index < resultBalancesBanana.length; index++) {
      const balancesBanana = resultBalancesBanana[index];
      const balancesGnana = resultBalancesGnana[index];
      const price = priceList[index];
      balancesBanana.map((balance) => {
        amountBanana += balance.balances ? +balance.balances[0]?.value : 0;
      });
      balancesGnana.map((balance) => {
        amountGnana += balance.balances ? +balance.balances[0]?.value : 0;
      });
      allInfo.history.push({
        time: initTime,
        amountBanana,
        amountGnana,
        price,
        value: price * amountBanana + price * 1.389 * amountGnana,
      });
    }
    await this.dashboardService.createOrUpdateDashboardData({ 'tvlHistory.pools': allInfo });

    this.logger.log('Success pool tvl');
  }

  async calculateJungleTvl() {
    const pools = await this.statsService.getIncentivizedPools();
    const onlyJunglePools = pools.filter((pool) => pool.category === 'jungle');
    const lastHour = 'T23:59:59';
    const now = new Date();
    const nowTime = now.getTime();
    const dashboard = await this.dashboardService.findDashboardData();
    const jungles = dashboard.tvlHistory.jungle;
    const allInfo = jungles ?? {};
    const promises = [];
    const addressList = [];
    const timeList = [];
    onlyJunglePools.map(async (pool) => {
      const { address, stakeToken } = pool;
      let initTime =
        jungles !== undefined && jungles[address] && jungles[address].history.length > 0
          ? jungles[address].history[jungles[address].history.length - 1].time + 86400
          : 1645920000;
      let initTimeDate = new Date(initTime * 1000);
      let fromTime = formatDate(initTimeDate);
      let toTime = `${fromTime}${lastHour}`;
      while (initTimeDate.getTime() < nowTime) {
        promises.push(this.bitqueryService.getBalancesPoolAddressByDate([address], fromTime, toTime, stakeToken));
        timeList.push(initTime);
        addressList.push(address);
        initTime += 86400;
        initTimeDate = new Date(initTime * 1000);
        fromTime = formatDate(initTimeDate);
        toTime = `${fromTime}${lastHour}`;
      }
    });
    const result = await Promise.all(promises);
    let amount = 0;
    for (let index = 0; index < result.length; index++) {
      const balancesJungle = result[index];
      const address = addressList[index];
      const time = timeList[index];
      if (!allInfo[address]) {
        allInfo[address] = {
          history: [],
        };
        amount = 0;
      }
      amount = allInfo[address].history[allInfo[address].history.length - 1].amount;
      balancesJungle.map((balance) => {
        amount += balance.balances ? +balance.balances[0]?.value : 0;
      });
      allInfo[address].history.push({
        time,
        amount,
      });
    }
    await this.dashboardService.createOrUpdateDashboardData({ 'tvlHistory.jungle': allInfo });
    this.logger.log('Success jungle tvl');
  }

  async calculateLendingTvl(attempt = 0) {
    const lendingMarket: LendingMarketInitialDto[] = this.config.get<LendingMarketInitialDto[]>('56.lendingMarkets');
    const lastHour = 'T23:59:59';
    const now = new Date();
    const nowTime = now.getTime();
    const dashboard = await this.dashboardService.findDashboardData();
    const lendings = dashboard.tvlHistory.lending;
    const allInfo = lendings ?? {};

    try {
      await Promise.all(
        lendingMarket.map(async (market) => {
          const { contract: address, asset: stakeToken, name } = market;
          const historyPriceToken = await this.subgraphService.getTokenPriceByBlock(stakeToken, 56, 0, 1000);
          let initTime =
            lendings !== undefined && lendings[address] && lendings[address].history.length > 0
              ? lendings[address].history[lendings[address].history.length - 1].time + 86400
              : 1637280000;
          let initTimeDate = new Date(initTime * 1000);
          let fromTime = formatDate(initTimeDate);
          let toTime = `${fromTime}${lastHour}`;
          let amount =
            lendings !== undefined && lendings[address] && lendings[address].history.length > 0
              ? lendings[address].history[lendings[address].history.length - 1].amount
              : 0;
          while (initTimeDate.getTime() < nowTime) {
            const balancesJungle = await this.bitqueryService.getBalancesPoolAddressByDate(
              [address],
              fromTime,
              toTime,
              stakeToken.toLowerCase() === this.config.get<string>('56.contracts.bnb').toLowerCase()
                ? name
                : stakeToken,
            );
            balancesJungle.map((balance) => {
              amount += balance.balances ? +balance.balances[0]?.value : 0;
            });
            if (!allInfo[address]) {
              allInfo[address] = {
                history: [],
              };
            }
            const findPrice = historyPriceToken.token.tokenDayData.find((p: any) => p.date === initTime);
            let price = 0;
            if (findPrice) {
              price = findPrice.priceUSD;
            }
            allInfo[address].history.push({
              time: initTime,
              amount,
              price,
            });
            initTime += 86400;
            initTimeDate = new Date(initTime * 1000);
            fromTime = formatDate(initTimeDate);
            toTime = `${fromTime}${lastHour}`;
            await this.dashboardService.createOrUpdateDashboardData({ 'tvlHistory.lending': allInfo });
          }
        }),
      );
    } catch (error) {
      this.logger.error(`Something went wrong getting values pools`);
      this.logger.error(error);
      if (attempt < 5) {
        this.logger.log(`Retrying - Attempt: ${attempt}`);
        await sleep(2000 * attempt);
        return this.calculateLendingTvl(attempt + 1);
      }
      throw error;
    }
    this.logger.log('Success lending tvl');
  }
  async calculateHistoryPol() {
    this.logger.log('Attemping to calculate History Pol...');
    const dashboard = await this.dashboardService.findDashboardData();
    const firstTime = '2022-04-11';
    const now = Date.now();
    const last: any = dashboard.historyTreasury?.pol
      ? Object.keys(dashboard.historyTreasury.pol)[Object.keys(dashboard.historyTreasury.pol).length - 1]
      : firstTime;
    const lastDateTime = new Date(last);
    let lastTime = lastDateTime.getTime() / 1000 + 86400;
    const data = dashboard.historyTreasury?.pol ? { ...dashboard.historyTreasury.pol } : {};
    const LPTreasury = await this.dashboardService.getLPTreasury();
    const mappingBills = LPTreasury.map((a: any) => a.lpToken.address[56].toLowerCase());
    const mappingLPTreasury = [...new Set(mappingBills)];
    try {
      while (lastTime < now / 1000) {
        const formatLastTime = formatDate(new Date(lastTime * 1000));
        const blocks = await this.subgraphService.getBlocksFromTimestamps([lastTime + 72000]);
        if (blocks.length === 0) break;
        const blockNumber = blocks[0].number;
        const infoLPBalances = await this.bitqueryService.getMultipleBalanceByDate(
          this.config.get<string[]>(`56.contracts.pol`),
          mappingLPTreasury,
          firstTime,
          formatLastTime,
          this.NETWORKS[56].symbol,
        );
        await Promise.all(
          infoLPBalances.map(async (info) => {
            if (!data[formatLastTime]) {
              data[formatLastTime] = {
                lastDate: null,
                contracts: {},
                tokens: {},
                value: 0,
                apeValue: 0,
                partnerValue: 0,
              };
            }
            if (info.balances) {
              await Promise.all(
                info.balances.map(async (balance) => {
                  const contract = balance.currency.address;
                  const amount = balance.value;
                  const {
                    price: priceLP,
                    token0,
                    token1,
                    reserveTotal0,
                    reserveTotal1,
                  } = await this.dashboardService.findPairInformationByBlock(contract, blockNumber, amount);
                  const address0 = token0.id;
                  const address1 = token1.id;
                  if (!data[formatLastTime].contracts[contract]) {
                    data[formatLastTime].contracts[contract] = {
                      amount: 0,
                      value: 0,
                      price: 0,
                      type: '',
                    };
                  }
                  if (!data[formatLastTime].tokens[address0]) {
                    data[formatLastTime].tokens[address0] = {
                      amount: 0,
                    };
                  }
                  if (!data[formatLastTime].tokens[address1]) {
                    data[formatLastTime].tokens[address1] = {
                      amount: 0,
                    };
                  }
                  const billType = LPTreasury.find(
                    (treasury) => treasury.lpToken.address[56].toLowerCase() === contract,
                  )?.billType;
                  const type =
                    billType.toLowerCase() === MiscDescriptions.bananaBill
                      ? MiscDescriptions.digiswap
                      : MiscDescriptions.partner;
                  if (type === MiscDescriptions.digiswap) {
                    data[formatLastTime].apeValue += amount * priceLP;
                  } else {
                    data[formatLastTime].partnerValue += amount * priceLP;
                  }
                  data[formatLastTime].tokens[address0].amount += reserveTotal0;
                  data[formatLastTime].tokens[address1].amount += reserveTotal1;
                  data[formatLastTime].contracts[contract].amount += amount;
                  data[formatLastTime].contracts[contract].value += amount * priceLP;
                  data[formatLastTime].contracts[contract].price = priceLP;
                  data[formatLastTime].contracts[contract].type = type;
                  data[formatLastTime].lastDate = formatLastTime;
                  data[formatLastTime].value += amount * priceLP;
                  data[formatLastTime].block = blockNumber;
                  await this.dashboardService.createOrUpdateDashboardData({
                    'historyTreasury.pol': data,
                  });
                }),
              );
            }
          }),
        );

        lastTime += 86400;
      }
      this.logger.log('Successfully generated Historical POL Data.');
    } catch (error) {
      this.logger.error('An error occurred while obtaining the POL history data.');
    }
  }
  async calculateHistoryOperational() {
    this.logger.log('Attemping to calculate History Operational...');
    try {
      const dashboard = await this.dashboardService.findDashboardData();
      const firstTime = '2022-01-10';
      const last: any = dashboard.historyTreasury?.operational
        ? Object.keys(dashboard.historyTreasury.operational)[
            Object.keys(dashboard.historyTreasury.operational).length - 1
          ]
        : firstTime;
      const data = dashboard.historyTreasury?.operational ? { ...dashboard.historyTreasury.operational } : {};
      const operationalChainIds = [1, 56, 137];
      const now = Date.now();
      const lastDateTime = new Date(last);
      let lastTime = lastDateTime.getTime() / 1000 + 86400;
      while (lastTime < now / 1000) {
        const formatLastTime = formatDate(new Date(lastTime * 1000));
        await Promise.all(
          operationalChainIds.map(async (chainId) => {
            const blocks = await this.subgraphService.getBlocksFromTimestamps([lastTime + 72000], chainId);
            if (blocks.length === 0) return;
            const blockNumber = blocks[0].number;
            const operationalBalanceCurrency: OperationBalanceCurrencyDto[] = this.config.get<
              OperationBalanceCurrencyDto[]
            >(`${chainId}.operationalBalanceCurrency`);
            const operationalAddress = this.config.get<string>(`${chainId}.contracts.operational`);
            const infoLPBalances = await this.bitqueryService.getMultipleBalanceByDate(
              [operationalAddress],
              operationalBalanceCurrency.map((currency) => currency.address),
              firstTime,
              formatLastTime,
              this.NETWORKS[chainId].symbol,
            );
            await Promise.all(
              infoLPBalances.map(async (info) => {
                if (!data[formatLastTime]) {
                  data[formatLastTime] = {
                    lastDate: null,
                    contracts: {},
                    tokens: {},
                    value: 0,
                  };
                }
                if (info.balances) {
                  await Promise.all(
                    info.balances.map(async (balance) => {
                      const contract =
                        balance.currency.address !== '-'
                          ? balance.currency.address.toLowerCase()
                          : this.config.get<string>(`${chainId}.contracts.${balance.currency.symbol.toLowerCase()}`);
                      const amount = balance.value;
                      const find = operationalBalanceCurrency.find(
                        (currency: any) => currency.address.toLowerCase() === contract.toLowerCase(),
                      );
                      let priceAddress = 0;
                      if (amount > 0) {
                        if (find && find.isLP) {
                          const { price } = await this.dashboardService.findPairInformationByBlock(
                            contract,
                            blockNumber,
                            amount,
                            chainId,
                          );
                          priceAddress = price;
                        } else {
                          const { price } = await this.dashboardService.findTokenPrice({
                            address: contract,
                            chainId,
                            block: blockNumber,
                            timestamp: lastTime + 72000,
                            operationalBalanceCurrency,
                            currency: balance.currency,
                          });
                          priceAddress = price;
                        }
                      }
                      if (!data[formatLastTime]) {
                        data[formatLastTime] = {
                          lastDate: null,
                          contracts: {},
                          value: 0,
                          block: 0,
                        };
                      }
                      if (!data[formatLastTime].contracts[contract]) {
                        data[formatLastTime].contracts[contract] = {
                          amount: 0,
                          value: 0,
                          chainId: 0,
                          price: 0,
                        };
                      }

                      data[formatLastTime].contracts[contract].amount += amount;
                      data[formatLastTime].contracts[contract].value += amount * priceAddress;
                      data[formatLastTime].contracts[contract].price = priceAddress;
                      data[formatLastTime].lastDate = formatLastTime;
                      data[formatLastTime].contracts[contract].chainId = chainId;
                      data[formatLastTime].value += amount * priceAddress;
                      data[formatLastTime].block = blockNumber;
                      await this.dashboardService.createOrUpdateDashboardData({
                        'historyTreasury.operational': data,
                      });
                    }),
                  );
                }
              }),
            );
          }),
        );
        lastTime += 86400;
      }
      this.logger.log('Successfully generated Historical Operational Data.');
    } catch (error) {
      console.log(error);
      this.logger.error('An error occurred while obtaining the Historical Operational data');
    }
  }
  async calculateHistoryMarketCapAndBurn() {
    this.logger.log('Attemping to calculate MarketCap and Burn Data...');
    const dashboard = await this.dashboardService.findDashboardData();
    const { marketCapData, burnedData, mintedData } = getLastMarketCapAndBurnData(dashboard.protocol);
    let marketCapTotal = marketCapData.length > 0 ? marketCapData[marketCapData.length - 1].amount : 0;
    let burnTotal = burnedData.length > 0 ? burnedData[burnedData.length - 1].amount : 0;
    let mintedTotal = mintedData.length > 0 ? mintedData[mintedData.length - 1].amount : 0;
    const lastRecord = dashboard.protocol.marketCap;
    let last: any = lastRecord.history
      ? lastRecord.history[lastRecord.history.length - 1].time + 86400
      : this.FIRST_TIME;
    const now = Date.now();
    while (last < now / 1000) {
      const formatLastTime = formatDate(new Date(last * 1000));
      const { dexTrades, mainPrice, transfers } = await this.bitqueryService.getSupplyAndPrice(
        this.NETWORKS[56].symbol,
        this.config.get<string>(`56.contracts.digichain`),
        this.config.get<string>(`56.contracts.bnb`),
        this.config.get<string>(`56.contracts.busd`),
        formatLastTime,
        formatLastTime,
      );
      const price = dexTrades.length > 0 ? dexTrades[0].quotePrice * mainPrice[0].quotePrice : 0;
      const burned = transfers[0].burned;
      const minted = transfers[0].minted;
      mintedTotal += minted;
      burnTotal += burned;
      marketCapTotal = (mintedTotal - burnTotal) * price;
      marketCapData.push({
        amount: marketCapTotal,
        time: last,
      });
      burnedData.push({
        amount: burnTotal,
        time: last,
      });
      mintedData.push({
        amount: mintedTotal,
        time: last,
      });
      const protocolMarketCap: ProtocolMetricsDto = {
        description: ProtocolMetricsDescriptions.marketCap,
        amount: marketCapTotal,
        type: 'money',
        history: marketCapData,
      };
      const protocolBurned: ProtocolMetricsDto = {
        description: ProtocolMetricsDescriptions.burned,
        amount: burnTotal,
        type: 'number',
        history: burnedData,
      };
      const protocolMinted: ProtocolMetricsDto = {
        description: ProtocolMetricsDescriptions.minted,
        amount: mintedTotal,
        type: 'number',
        history: mintedData,
      };
      await this.dashboardService.createOrUpdateDashboardData({ 'protocol.marketCap': protocolMarketCap });
      await this.dashboardService.createOrUpdateDashboardData({ 'protocol.burned': protocolBurned });
      await this.dashboardService.createOrUpdateDashboardData({ 'protocol.minted': protocolMinted });
      last += 86400;
    }
  }
}
