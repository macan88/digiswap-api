import { Injectable, Logger } from '@nestjs/common';
import {
  BananaDistribution,
  DistributionDescriptions,
  DistributionDTo,
  LockedValueDto,
  NetworkDescriptionMap,
  ProtocolMetricsDescriptions,
  ProtocolMetricsDto,
  RatioHistoryDto,
  Token,
  TradeVolumeDto,
  VaultConfig,
} from './dto/dashboardData.dto';
import OverviewData from './data/overiew.json';
import masterchefABI from './data/masterchef.json';
import { chunk } from 'lodash';
import BigNumber from 'bignumber.js';
import { BitqueryService } from 'src/bitquery/bitquery.service';
import { multicall, multicallNetwork } from 'src/utils/lib/multicall';
import { LP_ABI } from 'src/stats/utils/abi/lpAbi';
import { PriceService } from 'src/stats/price.service';
import {
  calculateTVLIncentivizedPools,
  filterUnique,
  getLastMarketCapAndBurnData,
  mappingProtocolData,
} from './helpers/helpers';
import { ConfigService } from '@nestjs/config';
import { SubgraphService } from 'src/stats/subgraph.service';
import { StatsService } from 'src/stats/stats.service';
import { StatsNetworkService } from 'src/stats/stats.network.service';
import fetchVaultCalls from './helpers/fetchVaultsCalls';
import { ERC20_ABI } from 'src/stats/utils/abi/erc20Abi';
import { getBalanceNumber } from 'src/utils/math';
import { VOLUME_INFO } from 'src/stats/utils/subgraph.queries';
import { GeneralStats } from 'src/interfaces/stats/generalStats.dto';
import { DashboardService } from './dashboard.service';

@Injectable()
export class DashboardOverviewService {
  private readonly logger = new Logger(DashboardOverviewService.name);
  private readonly FIRST_TIME = 1613174400;
  private readonly NETWORKS = this.config.get<NetworkDescriptionMap>('chainNetworksAvailables');
  constructor(
    private config: ConfigService,
    private bitqueryService: BitqueryService,
    private priceService: PriceService,
    private subgraphService: SubgraphService,
    private statsService: StatsService,
    private statsNetworkService: StatsNetworkService,
    private dashboardService: DashboardService,
  ) {}

  async getOverviewVolume(): Promise<TradeVolumeDto[]> {
    const info = await this.dashboardService.verifyDashboardData('volume');
    if (info) return info.volume.dataMapping;
    await this.dashboardService.createOrUpdateDashboardData({ 'volume.createdAt': new Date() });
    this.calculateOverviewVolume();
    const dashboard = await this.dashboardService.findDashboardData();
    return dashboard.volume.dataMapping;
  }

  async calculateOverviewVolume() {
    this.logger.log('Attemping to calculate Volume Data...');
    const dashboard = await this.dashboardService.findDashboardData();
    const info = [];
    const promises = [];
    const volumeDataList = [];

    Object.values(this.NETWORKS).map(({ id: chainId, description }) => {
      const volumeData = dashboard.volume?.data?.find(
        (vol) => vol.description.toLowerCase() === description.toLowerCase(),
      );
      volumeDataList.push(volumeData);
      const time =
        volumeData && volumeData.history.length > 0
          ? volumeData.history[volumeData.history.length - 1].time
          : this.FIRST_TIME;
      promises.push(
        this.subgraphService.getDayData(
          {
            first: 1000,
            startTimestamp: time,
            order: 'asc',
            filter: VOLUME_INFO,
          },
          chainId,
        ),
      );
    });
    const result = await Promise.all(promises);
    Object.values(this.NETWORKS).map(({ description }, index) => {
      const data = result[index];
      const volumeData = volumeDataList[index];
      info.push({
        description,
        history: [...(volumeData ? volumeData.history : []), ...(data?.apeswapDayDatas ? data.apeswapDayDatas : [])],
      });
    });
    info.sort((a, b) => {
      if (a.description > b.description) return 1;
      if (a.description < b.description) return -1;
      return 0;
    });
    await this.dashboardService.createOrUpdateDashboardData({ 'volume.data': info });
    await this.mappingOverviewVolume();
    return info;
  }
  async mappingOverviewVolume() {
    const dashboard = await this.dashboardService.findDashboardData();
    const volumeList = dashboard.volume.data;
    let history = [];
    volumeList.map((volume) => (history = [...history, ...volume.history]));
    const times = history.map((h) => h.time);
    const uniqueTimes = filterUnique(times);
    const data = [];
    volumeList.map((v) => {
      const volumeHistory = [];
      let amount = 0;
      uniqueTimes.map((t) => {
        const find = v.history.find((f) => f.time === +t);
        if (find) amount += +find.amount;
        volumeHistory.push({
          time: t,
          amount,
        });
      });
      data.push({
        description: v.description,
        history: volumeHistory,
      });
    });
    await this.dashboardService.createOrUpdateDashboardData({ 'volume.dataMapping': data });
    this.logger.log('Successfully Mapping Volume Data.');
    return data;
  }
  async getOverviewProtocolMetrics(): Promise<ProtocolMetricsDto[]> {
    const info = await this.dashboardService.verifyDashboardData('protocol');
    if (info) return mappingProtocolData(info.protocol);
    await this.dashboardService.createOrUpdateDashboardData({ 'protocol.createdAt': new Date() });
    this.calculateOverviewProtocolMetrics();
    const dashboard = await this.dashboardService.findDashboardData();
    return mappingProtocolData(dashboard.protocol);
  }
  async calculateOverviewProtocolMetrics() {
    await this.calculateMarketCapAndBurn();
    await this.dashboardService.createOrUpdateDashboardData({ 'protocol.holders': OverviewData.protocolMetrics[0] });
    const dashboard = await this.dashboardService.findDashboardData();
    mappingProtocolData(dashboard.protocol);
    this.logger.log('Successfully generated Protocol Data.');
  }
  async calculateMarketCapAndBurn() {
    this.logger.log('Attemping to calculate MarketCap and Burn Data...');
    const dashboard = await this.dashboardService.findDashboardData();
    const { marketCapData, burnedData, mintedData } = getLastMarketCapAndBurnData(dashboard.protocol);
    const lastTimeMarketCapData = marketCapData[marketCapData.length - 1].time;
    const lastTimeBurnedData = burnedData[burnedData.length - 1].time;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const nowTime = now.getTime() / 1000;

    const stats = await this.statsService.findTvlStats();
    if (lastTimeMarketCapData === nowTime) {
      marketCapData[marketCapData.length - 1].amount = stats.marketCap;
    } else {
      marketCapData.push({
        time: nowTime,
        amount: stats.marketCap,
      });
    }

    if (lastTimeBurnedData === nowTime) {
      burnedData[burnedData.length - 1].amount = stats.burntAmount;
      mintedData[mintedData.length - 1].amount = stats.totalSupply;
    } else {
      burnedData.push({
        time: nowTime,
        amount: stats.burntAmount,
      });
      mintedData.push({
        time: nowTime,
        amount: stats.totalSupply,
      });
    }
    const protocolMarketCap: ProtocolMetricsDto = {
      description: ProtocolMetricsDescriptions.marketCap,
      amount: stats.marketCap,
      type: 'money',
      history: marketCapData,
    };
    const protocolBurned: ProtocolMetricsDto = {
      description: ProtocolMetricsDescriptions.burned,
      amount: burnedData[burnedData.length - 1].amount,
      type: 'number',
      history: burnedData,
    };
    const protocolMinted: ProtocolMetricsDto = {
      description: ProtocolMetricsDescriptions.minted,
      amount: mintedData[mintedData.length - 1].amount,
      type: 'number',
      history: mintedData,
    };
    await this.dashboardService.createOrUpdateDashboardData({ 'protocol.marketCap': protocolMarketCap });
    await this.dashboardService.createOrUpdateDashboardData({ 'protocol.burned': protocolBurned });
    await this.dashboardService.createOrUpdateDashboardData({ 'protocol.minted': protocolMinted });
  }
  async getOverviewBananaDistribution(): Promise<BananaDistribution> {
    const info = await this.dashboardService.verifyDashboardData('distribution');
    if (info) return info.distribution;
    await this.dashboardService.createOrUpdateDashboardData({ 'distribution.createdAt': new Date() });
    this.calculateOverviewBananaDistribution();
    const dashboard = await this.dashboardService.findDashboardData();
    delete dashboard.distribution.createdAt;
    return dashboard.distribution;
  }
  async calculateOverviewBananaDistribution() {
    this.logger.log('Attemping to calculate Digichain Distribution Data...');
    const dashboard = await this.dashboardService.findDashboardData();
    const { burnedData, mintedData } = getLastMarketCapAndBurnData(dashboard.protocol);
    const stats = await this.statsService.findTvlStats();
    const burnTotal = burnedData.length > 0 ? burnedData[burnedData.length - 1].amount : stats.burntAmount;
    const mintedTotal = mintedData.length > 0 ? mintedData[mintedData.length - 1].amount : stats.totalSupply;
    const bananaDistribution: BananaDistribution = {
      total: mintedTotal,
      distribution: [],
    };
    bananaDistribution.distribution.push({
      description: DistributionDescriptions.burn,
      amount: burnTotal,
    });
    const gnanaSupply = stats.gnanaCirculatingSupply;
    bananaDistribution.distribution.push({
      description: DistributionDescriptions.gdigi,
      amount: gnanaSupply,
    });
    const poolDistribution = await this.calculatePoolDistribution(
      bananaDistribution.distribution,
      dashboard.distribution.distribution,
    );
    const totalLiquidity = await this.calculateLiquidityDistribution(
      bananaDistribution.distribution,
      dashboard.distribution.distribution,
    );
    bananaDistribution.distribution.push({
      description: DistributionDescriptions.other,
      amount: mintedTotal - (burnTotal + gnanaSupply + poolDistribution + totalLiquidity),
    });
    bananaDistribution.createdAt = new Date();
    await this.dashboardService.createOrUpdateDashboardData({ distribution: bananaDistribution });
    this.logger.log('Successfully generated Digichain Distribution Data.');
  }

  async calculateLiquidityDistribution(
    distribution: DistributionDTo[],
    allDistributions: DistributionDTo[],
  ): Promise<number> {
    let totalLiquidity = 0;
    try {
      const infoLPBalances = await this.bitqueryService.getAddressGeneralInformation(
        'bsc',
        [this.config.get<string>('56.contracts.bananaBusd'), this.config.get<string>('56.contracts.bananaBnb')],
        [
          this.config.get<string>('56.contracts.digichain'),
          this.config.get<string>('56.contracts.bnb'),
          this.config.get<string>('56.contracts.busd'),
        ],
      );
      infoLPBalances.map((lp: any) =>
        lp.balances.map((balance: any) => {
          if (balance.currency.address.toLowerCase() === this.config.get<string>('56.contracts.digichain'))
            totalLiquidity += +balance.value;
        }),
      );
    } catch (e) {
      totalLiquidity = allDistributions.find(
        (distribution) => distribution.description === DistributionDescriptions.liquidity,
      )?.amount;
    }
    distribution.push({
      description: DistributionDescriptions.liquidity,
      amount: totalLiquidity,
    });

    return totalLiquidity;
  }
  async calculatePoolDistribution(
    distribution: DistributionDTo[],
    allDistributions: DistributionDTo[],
  ): Promise<number> {
    let supply = 0;
    try {
      const stats: GeneralStats = await this.statsService.findGeneralStats();
      const poolContracts = stats.incentivizedPools.filter(
        (pool) => pool.stakedTokenAddress.toLowerCase() === this.config.get<string>('56.contracts.digichain'),
      );
      const multicallContracts = poolContracts.map((contract) => {
        return {
          address: this.config.get<string>('56.contracts.digichain'),
          name: 'balanceOf',
          params: [contract.address],
        };
      });
      multicallContracts.push({
        address: this.config.get<string>('56.contracts.digichain'),
        name: 'balanceOf',
        params: [this.config.get<string>('56.contracts.masterDigi')],
      });
      const supplies = await multicall(LP_ABI, multicallContracts);
      supplies.map((s) => (supply += +s));
      supply = supply / 1e18;
    } catch (error) {
      supply = allDistributions.find(
        (distribution) => distribution.description === DistributionDescriptions.pools,
      )?.amount;
    }
    distribution.push({
      description: DistributionDescriptions.pools,
      amount: supply,
    });
    return supply;
  }
  async getOverviewTvl(): Promise<LockedValueDto> {
    const info = await this.dashboardService.verifyDashboardData('tvl');
    if (info) return info.tvl;
    await this.dashboardService.createOrUpdateDashboardData({ 'tvl.createdAt': new Date() });
    this.calculateOverviewTvl();
    const dashboard = await this.dashboardService.findDashboardData();
    delete dashboard.tvl.createdAt;
    return dashboard.tvl;
  }
  async calculateOverviewTvl(): Promise<LockedValueDto> {
    this.logger.log('Attemping to calculate TVL Data...');
    try {
      const chainIds = [56, 137];
      const tvl: LockedValueDto = {
        farms: 0,
        pools: 0,
        jungle: 0,
        lending: 0,
        maximizers: 0,
        other: 0,
      };
      let tvlStatsAmount = 0;
      let tvlNormal = 0;
      await Promise.all(
        chainIds.map(async (chainId: number) => {
          const stats =
            chainId === 56
              ? await this.statsService.findGeneralStats()
              : await this.statsNetworkService.findGeneralStats({ chainId });
          if (chainId === 56) {
            const { tvl: tvlStats, lendingTvl } = await this.statsService.findTvlStats();
            tvlStatsAmount = tvlStats;
            tvl.lending = lendingTvl;
            tvl.pools = stats.poolsTvl;
            tvl.jungle += calculateTVLIncentivizedPools(stats.incentivizedPools, 'jungle');
            tvl.maximizers = await this.calculateMaximizers(chainId);
          }
          stats.farms?.map((farm) => (tvl.farms += +farm.stakedTvl));
        }),
      );

      Object.keys(tvl).map((t) => (tvlNormal += tvl[t]));
      tvl.other = tvlStatsAmount - tvlNormal;
      tvl.createdAt = new Date();
      await this.dashboardService.createOrUpdateDashboardData({ tvl });
      this.logger.log('Successfully generated TVL Data.');
      return tvl;
    } catch (error) {
      this.logger.error('Something went wrong generated TVL Data. Get from database');
      const data = await this.dashboardService.findDashboardData();
      return data.tvl;
    }
  }
  async calculateMaximizers(chainId: number) {
    const vaultsList = await this.dashboardService.getVaultsList();
    const filteredVaults = vaultsList.filter(
      (vault) => vault.availableChains.includes(chainId) && (vault.type === 'MAX' || vault.pid === 22),
    );
    const vaultIds = [];
    const vaultCalls = filteredVaults.flatMap((vault) => {
      vaultIds.push(vault.id);
      return fetchVaultCalls(vault, chainId);
    });
    const vals = await multicallNetwork([...masterchefABI, ...ERC20_ABI], vaultCalls, chainId);
    const chunkSize = vaultCalls.length / filteredVaults.length;
    const chunkedVaults = chunk(vals, chunkSize);
    const filterTokens: Token[] = filteredVaults.map((vault) => {
      return {
        lpToken: vault.stakeToken.lpToken,
        address: vault.stakeToken.address[chainId],
        decimals: vault.stakeToken.decimals,
        symbol: vault.stakeToken.symbol,
        chainId,
      };
    });
    const prices = await this.priceService.getPricesByTokens(filterTokens, chainId);
    let value = 0;
    chunkedVaults.map((chunk, index) => {
      const vaultConfig: VaultConfig = filteredVaults?.find((vault) => vault.id === vaultIds[index]);
      const stakeTokenPriceUsd = prices[vaultConfig.stakeToken.address[chainId]?.toLowerCase()]?.usd;
      const userInfo = chunk[2];
      const strategyPairBalance = userInfo.amount.toString();
      const totalTokensStaked = getBalanceNumber(new BigNumber(strategyPairBalance));
      value += stakeTokenPriceUsd * totalTokensStaked;
    });
    return value;
  }
  async getMcapTvlRatio(): Promise<RatioHistoryDto[]> {
    const info = await this.dashboardService.verifyDashboardData('ratio');
    if (info) return info.ratio.history;
    await this.dashboardService.createOrUpdateDashboardData({ 'ratio.createdAt': new Date() });
    this.calculateMcapTvlRatio();
    const dashboard = await this.dashboardService.findDashboardData();
    return dashboard.ratio.history;
  }
  async calculateMcapTvlRatio() {
    const now = new Date();
    const dashboard = await this.dashboardService.findDashboardData();
    const ratio = dashboard.ratio;
    const lastTime =
      ratio.history && ratio.history.length > 0
        ? ratio.history[ratio.history.length - 1].timestamp
        : now.getTime() / 1000;
    if (now.getTime() / 1000 > lastTime + 86400) {
      const { tvl, marketCap } = await this.statsService.findTvlStats();
      ratio.history.push({
        timestamp: lastTime + 86400,
        ratio: marketCap / tvl,
      });
      await this.dashboardService.createOrUpdateDashboardData({
        ratio: { history: ratio.history, createdAt: new Date() },
      });
    }
  }
}
