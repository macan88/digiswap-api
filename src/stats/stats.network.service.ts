import { Injectable, HttpService, Inject, CACHE_MANAGER, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GeneralStatsNetworkDto, DigiLpApr } from 'src/interfaces/stats/generalStats.dto';
import { Cache } from 'cache-manager';
import { PriceService } from './price.service';
import {
  getPoolPrices,
  getDualFarmApr,
  arrayChunk,
  getTokensPrices,
  calculateMiscAmounts,
  getAllocInfo,
  getRewarderInfo,
  getLiquidityFarm,
} from './utils/stats.utils';
import { Model } from 'mongoose';
import { GeneralStatsNetwork, GeneralStatsNetworkDocument } from './schema/generalStatsNetwork.schema';
import { StatsService } from './stats.service';
import { createLpPairName } from 'src/utils/helpers';
import { ChainConfigService } from 'src/config/chain.configuration.service';
import { getContractNetwork } from 'src/utils/lib/web3';
import { BitqueryService } from 'src/bitquery/bitquery.service';
import { FarmStatsDto } from 'src/interfaces/stats/farm.dto';
import { SubgraphService } from './subgraph.service';

@Injectable()
export class StatsNetworkService {
  private readonly logger = new Logger(StatsNetworkService.name);
  private readonly DUAL_FARMS_LIST_URL = this.configService.getData<string>('dualFarmsListUrl');
  private readonly STRAPI_URL = process.env.DIGISWAP_STRAPI_URL;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private httpService: HttpService,
    @InjectModel(GeneralStatsNetwork.name)
    private generalStatsNetworkModel: Model<GeneralStatsNetworkDocument>,
    private priceService: PriceService,
    private statsService: StatsService,
    private configService: ChainConfigService,
    private bitqueryService: BitqueryService,
    private subgraphService: SubgraphService,
  ) {}

  createGeneralStats(stats, filter) {
    return this.generalStatsNetworkModel.updateOne(
      filter,
      {
        $set: stats,
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

  findGeneralStats(filter) {
    return this.generalStatsNetworkModel.findOne(filter);
  }
  updateCreatedAtStats(filter) {
    return this.generalStatsNetworkModel.updateOne(filter, {
      $currentDate: {
        createdAt: true,
      },
    });
  }

  async verifyStats(chainId) {
    const now = Date.now();
    const stats: any = await this.findGeneralStats({ chainId });
    if (!stats?.createdAt) return null;

    const lastCreatedAt = new Date(stats.createdAt).getTime();
    const diff = now - lastCreatedAt;
    const time = 300000; // 5 minutes

    if (diff > time) return null;

    return stats;
  }

  async getCalculateStatsNetwork(chainId: number) {
    const cachedValue = await this.cacheManager.get(`calculateStats-network-${chainId}`);
    if (cachedValue) {
      this.logger.log(`Hit calculateStatsNetwork() cache for chain ${chainId}`);
      return cachedValue as GeneralStatsNetworkDto;
    }
    const infoStats = await this.verifyStats(chainId);
    if (infoStats) {
      this.logger.log(`Pulled Network Stats from Database Entry for chain ${chainId}`);
      return infoStats;
    }
    await this.updateCreatedAtStats({ chainId });
    this.getStatsNetwork(chainId);
    const generalStats: any = await this.findGeneralStats({ chainId });
    return generalStats;
  }

  async getStatsNetwork(chainId: number): Promise<GeneralStatsNetworkDto> {
    try {
      this.logger.log(`Attempting to generate network stats for chain ${chainId}.`);

      const [prices, { burntAmount, totalSupply, circulatingSupply }] = await Promise.all([
        this.priceService.getTokenPricesv2(chainId),
        this.statsService.getBurnAndSupply(chainId),
      ]);
      const priceUSD = prices[this.configService.getData<string>(`${chainId}.contracts.digichain`)].usd;
      const generalStats: GeneralStatsNetworkDto = {
        chainId,
        digichainPrice: priceUSD,
        burntAmount,
        totalSupply,
        circulatingSupply,
        marketCap: circulatingSupply * priceUSD,
        poolsTvl: 0,
        pools: [],
        farms: [],
        incentivizedPools: [],
        lendingData: [],
        bills: [],
      };

      switch (chainId) {
        case this.configService.getData<number>('networksId.BSC'):
          generalStats.lendingData = await this.statsService.getAllLendingMarketData();
          generalStats.bills = await this.statsService.getAllBillsData();

          const [{ circulatingSupply: gdigiCirculatingSupply }] = await Promise.all([
            this.statsService.getGdigiSupply(),
            this.calculatePoolsAndFarms(generalStats, prices, chainId),
          ]);

          generalStats.gdigiCirculatingSupply = gdigiCirculatingSupply;

          try {
            await Promise.all([
              this.mappingLPVolume(
                'bsc',
                generalStats,
                this.configService.getData<number>(`${chainId}.feeLP`),
                chainId,
              ),
            ]);
          } catch (error) {
            console.log(error);
            this.logger.error(`Failed to map incentivized pools for network ${chainId}`);
            throw error;
          }

          this.logger.log(`finish calculate chainID ${chainId}`);
          break;
        case this.configService.getData<number>('networksId.POLYGON'):
          generalStats.farms = await this.fetchDualFarms(prices, chainId);
          await this.mappingLPVolume(
            'matic',
            generalStats,
            this.configService.getData<number>(`${chainId}.feeLP`),
            chainId,
          );
          delete generalStats.pools;
          delete generalStats.incentivizedPools;
          delete generalStats.poolsTvl;
          this.logger.log(`finish calculate chainID ${chainId}`);
          break;

        default:
          throw new BadRequestException('Network not supported');
      }
      await this.cacheManager.set(`calculateStats-network-${chainId}`, generalStats, { ttl: 120 });
      await this.createGeneralStats(generalStats, { chainId });
      return generalStats;
    } catch (e) {
      console.log(e);
      this.logger.error('Something went wrong calculating stats network');
      return e;
    }
  }

  async calculatePoolsAndFarms(generalStats: any, prices, chainId: number) {
    const masterDigiContract = getContractNetwork(
      this.configService.getData<string>(`${chainId}.abi.masterDigi`),
      this.configService.getData<string>(`${chainId}.contracts.masterDigi`),
      chainId,
    );
    const poolInfos = await this.statsService.calculatePoolInfo(masterDigiContract);
    const [{ totalAllocPoints, rewardsPerDay }, tokens] = await Promise.all([
      this.statsService.getAllocPointAndRewards(masterDigiContract),
      this.statsService.getTokens(poolInfos),
    ]);

    for (let i = 0; i < poolInfos.length; i++) {
      if (poolInfos[i].poolToken) {
        getPoolPrices(
          tokens,
          prices,
          poolInfos[i].poolToken,
          generalStats,
          i,
          poolInfos[i].allocPoints,
          totalAllocPoints,
          rewardsPerDay,
          this.configService.getData<string>(`${chainId}.contracts.digichain`),
        );
      }
    }

    generalStats.pools.forEach((pool) => {
      generalStats.poolsTvl += pool.stakedTvl;
    });
    await this.statsService.mappingIncetivizedPools(generalStats, prices);
    generalStats.incentivizedPools.forEach((pool) => {
      if (!pool.t0Address) {
        generalStats.poolsTvl += pool.stakedTvl;
      }
      delete pool.abi;
    });
  }

  async fetchDualFarms(tokenPrices, chainId: number) {
    const { data: response } = await this.httpService.get(this.DUAL_FARMS_LIST_URL).toPromise();
    const miniChefAddress = this.configService.getData<string>(`${chainId}.contracts.masterDigi`);
    const data: FarmStatsDto[] = await Promise.all(
      response.map(async (dualFarmConfig) => {
        const { quoteToken, token1, miniChefRewarderToken, rewarderToken } = getTokensPrices(
          dualFarmConfig,
          tokenPrices,
          chainId,
        );

        const [
          { totalStaked, tokenAmount, quoteTokenAmount, stakeTokenPrice, totalInQuoteToken, lpTotalInQuoteToken },
          { alloc, multiplier, miniChefPoolRewardPerSecond },
          { rewarderPoolRewardPerSecond },
        ] = await Promise.all([
          calculateMiscAmounts(
            this.configService.getData<any>(`${chainId}.abi.erc20`),
            dualFarmConfig,
            miniChefAddress,
            quoteToken,
            token1,
            chainId,
          ),
          getAllocInfo(
            this.configService.getData<any>(`${chainId}.abi.masterDigi`),
            miniChefAddress,
            dualFarmConfig,
            miniChefRewarderToken,
            chainId,
          ),
          getRewarderInfo(dualFarmConfig, rewarderToken, chainId),
        ]);

        const apr = getDualFarmApr(
          totalStaked?.toNumber(),
          miniChefRewarderToken?.usd,
          miniChefPoolRewardPerSecond?.toString(),
          rewarderToken?.usd,
          rewarderPoolRewardPerSecond?.toString(),
        );

        return {
          poolIndex: dualFarmConfig.pid,
          name: createLpPairName(dualFarmConfig.stakeTokens.token0.symbol, dualFarmConfig.stakeTokens.token1.symbol),
          address: dualFarmConfig.stakeTokenAddress,
          t0Address: dualFarmConfig.stakeTokens.token0.address,
          t0Symbol: dualFarmConfig.stakeTokens.token0.symbol,
          t0Decimals: dualFarmConfig.stakeTokens.token0.decimals,
          p0: quoteToken.usd,
          q0: tokenAmount.toJSON(),
          t1Address: dualFarmConfig.stakeTokens.token1.address,
          t1Symbol: dualFarmConfig.stakeTokens.token1.symbol,
          t1Decimals: dualFarmConfig.stakeTokens.token1.decimals,
          p1: token1.usd,
          q1: quoteTokenAmount.toJSON(),
          price: stakeTokenPrice,
          totalSupply: totalInQuoteToken.toJSON(),
          tvl: totalStaked.toFixed(0),
          stakedTvl: lpTotalInQuoteToken.toJSON(),
          apr,
          rewardTokenPrice: miniChefRewarderToken?.usd,
          rewardTokenSymbol: miniChefRewarderToken?.symbol,
          decimals: miniChefRewarderToken?.decimals,
          rewardTokenPrice1: rewarderToken?.usd,
          rewardTokenSymbol1: rewarderToken?.symbol,
          decimals1: rewarderToken?.decimals,
          multiplier,
          poolWeight: alloc,
        };
      }),
    );
    return data;
  }

  async mappingLPVolume(network: string, pools: GeneralStatsNetworkDto, fee: number, chainId: number) {
    const addresses = pools.farms.map((f) => f.address);
    const baseCurrency = this.configService.getData<string[]>(`${chainId}.baseCurrency`);
    const listAddresses = arrayChunk(addresses);
    let volumesList = [];
    let balanceList = [];
    let nullTradeAmount;
    for (let index = 0; index < listAddresses.length; index++) {
      const list = listAddresses[index];
      const { volumes, balance } = await this.bitqueryService.getDailyLPVolume(network, list, baseCurrency);
      volumesList = [...volumesList, ...volumes];
      balanceList = [...balanceList, ...balance];
      nullTradeAmount = volumesList.find((v) => v.tradeAmount === null) || false;
    }
    if (volumesList.length === 0 || nullTradeAmount) {
      this.logger.log('Calculating from the subgraph');
      volumesList = [];
      for (let index = 0; index < listAddresses.length; index++) {
        const list = listAddresses[index];
        const volumes = await this.subgraphService.getBulkPairData(list, chainId);
        volumesList = [...volumesList, ...volumes];
      }
      if (nullTradeAmount) {
        this.logger.log('Mapping for balance list from subgraph');
        balanceList = volumesList.map((v) => ({
          address: v.id,
          reserveUSD: +v.reserveUSD,
        }));
      }
    }
    let generalStats;
    if (volumesList.length === 0) {
      this.logger.log(`Pulled lp apr from Database`);
      generalStats = await this.findGeneralStats({ chainId });
    }
    pools.farms.forEach((f) => {
      try {
        let liquidity = getLiquidityFarm(balanceList, f, chainId);
        let tradeAmount;
        let aprLpReward;
        if (volumesList.length !== 0) {
          const volume = volumesList.find(
            (v) => v.smartContract.address.address.toLowerCase() === f.address.toLowerCase(),
          );
          tradeAmount = Math.abs(volume?.tradeAmount) ?? 0;
          aprLpReward = (((tradeAmount * fee) / 100) * 365) / +liquidity;
        } else {
          const volume = generalStats?.farms.find((v) => v.address.toLowerCase() === f.address.toLowerCase());
          tradeAmount = volume?.lpRewards.volume;
          aprLpReward = volume?.lpRewards.apr;
          liquidity = +volume?.lpRewards.liquidity;
        }

        f.lpRewards = {
          volume: tradeAmount,
          apr: aprLpReward,
          liquidity: liquidity.toFixed(0),
        };
      } catch (error) {
        console.log(error);
        this.logger.error(`Failed to compute APRs for network ${network}`);
        throw error;
      }
    });
  }

  async getLpAprs(chainId: number): Promise<DigiLpApr> {
    try {
      const networkStatsData = await this.getCalculateStatsNetwork(chainId);

      const lpAprs = networkStatsData['farms'].map((farm) => {
        return { pid: farm.poolIndex, lpApr: farm.lpRewards.apr };
      });

      return { chainId, lpAprs };
    } catch (error) {
      this.logger.error(`Failed to get LP Aprs: ${error.message}`);
      return null;
    }
  }
}
