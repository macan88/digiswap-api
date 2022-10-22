import { Injectable, HttpService, Inject, CACHE_MANAGER, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { GeneralStats, HomepageFeatures } from 'src/interfaces/stats/generalStats.dto';
import { Cache } from 'cache-manager';
import { PriceService } from './price.service';
import { LP_ABI } from './utils/abi/lpAbi';
import { ERC20_ABI } from './utils/abi/erc20Abi';
import { LENDING_ABI } from './utils/abi/lendingAbi';
import { getContract, getCurrentBlock } from 'src/utils/lib/web3';
import { getParameterCaseInsensitive, createLpPairName } from 'src/utils/helpers';
import { multicall, multicallNetwork } from 'src/utils/lib/multicall';
import {
  gBananaTreasury,
  masterDigiContractWeb,
  bananaAddress,
  goldenBananaAddress,
  masterDigiContractAddress,
  getBananaPriceWithPoolList,
  getPoolPrices,
  getWalletStatsForPools,
  getWalletStatsForFarms,
  getWalletStatsForIncentivizedPools,
  lendingAddress,
  unitrollerAddress,
  lendingMarkets,
} from './utils/stats.utils';
import { WalletStats } from 'src/interfaces/stats/walletStats.dto';
import { WalletInvalidHttpException } from './exceptions/wallet-invalid.execption';
import { Model } from 'mongoose';
import { GeneralStats as GeneralStatsDB, GeneralStatsDocument } from './schema/generalStats.schema';
import { SubgraphService } from './subgraph.service';
import { Cron } from '@nestjs/schedule';
import { BEP20_REWARD_DIGII_ABI } from './utils/abi/bep20RewardApeAbi';
import { GeneralStatsChain } from 'src/interfaces/stats/generalStatsChain.dto';
import { TvlStats, TvlStatsDocument } from './schema/tvlStats.schema';
import { ChainConfigService } from 'src/config/chain.configuration.service';
import { BitqueryService } from 'src/bitquery/bitquery.service';
import Multicall from '@dopex-io/web3-multicall';
import { calculateSupplyAndBorrowApys, calculateSupplyAndBorrowAsset } from './utils/lendingUtils';
import { LendingMarket } from 'src/interfaces/stats/lendingMarket.dto';
import { TreasuryBill } from 'src/interfaces/stats/treasuryBill.dto';
import { fetchPrices } from 'src/stats/utils/fetchPrices';
import { OLA_COMPOUND_ABI } from './utils/abi/olaCompoundAbi';
import { CUSTOM_BILL_ABI } from 'src/bills/abi/CustomBill.abi';
import { IncentivizedPoolList } from 'src/interfaces/stats/incentivizedPool.dto';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly chainId = parseInt(process.env.CHAIN_ID);
  private readonly POOL_LIST_URL = process.env.POOL_LIST_URL;
  private readonly BILL_LIST_URL = process.env.BILL_LIST_URL;
  private readonly STRAPI_URL = process.env.DIGISWAP_STRAPI_URL;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private httpService: HttpService,
    @InjectModel(GeneralStatsDB.name)
    private generalStatsModel: Model<GeneralStatsDocument>,
    @InjectModel(TvlStats.name)
    private tvlStatsModel: Model<TvlStatsDocument>,
    private subgraphService: SubgraphService,
    private priceService: PriceService,
    private configService: ChainConfigService,
    private bitqueryService: BitqueryService,
  ) {}

  createTvlStats(stats) {
    return this.tvlStatsModel.updateOne(
      {},
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

  findTvlStats() {
    return this.tvlStatsModel.findOne();
  }
  updateTvlCreatedAtStats() {
    return this.tvlStatsModel.updateOne(
      {},
      {
        $currentDate: {
          createdAt: true,
        },
      },
    );
  }
  createGeneralStats(stats) {
    return this.generalStatsModel.updateOne(
      {},
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

  findGeneralStats() {
    return this.generalStatsModel.findOne();
  }
  updateCreatedAtStats() {
    return this.generalStatsModel.updateOne(
      {},
      {
        $currentDate: {
          createdAt: true,
        },
      },
    );
  }
  cleanStats() {
    return this.generalStatsModel.deleteMany();
  }

  // Called if cache comes up expired and we're trying to check the database stats for /tvl or just /
  async verifyStats(model) {
    const now = Date.now();

    // Get stats for general or tvl, depending on the case in which you run this function
    const stats: any = model === 'general' ? await this.findGeneralStats() : await this.findTvlStats();

    // If there is no 'createdAt' in the response, we consider it broken and return null for calling function to reject.
    if (!stats?.createdAt) return null;

    // If the last DB creation was created greater than 5 mins ago, reject.
    const lastCreatedAt = new Date(stats.createdAt).getTime();
    const diff = now - lastCreatedAt;
    const time = 300000; // 5 minutes
    if (diff > time) return null;

    // If a response is returned and the response is less than 5 minutes prior,
    // use stats you got from one of the functions above.
    return stats;
  }

  @Cron('0 50 * * * *')
  async loadDefistation() {
    if (this.chainId !== 56) return; // Only run on mainet
    try {
      if (!process.env.DEFISTATION_PASSWORD) return;
      this.logger.log('Loading Defistation');
      const statData = await this.getDefistationStats();
      const data = { test: false, bnb: 0, ...statData };
      const result = await this.httpService
        .post('https://api.defistation.io/dataProvider/tvl', data, {
          auth: {
            username: process.env.DEFISTATION_USER,
            password: process.env.DEFISTATION_PASSWORD,
          },
        })
        .toPromise();
      return result.data;
    } catch (e) {
      this.logger.error('Something went wrong loading defistation');
      this.logger.error(e);
      if (e.response) {
        this.logger.error(e.response.data);
      }
    }
  }

  async getDefistation() {
    if (!process.env.DEFISTATION_PASSWORD) return;
    const { data } = await this.httpService
      .get('https://api.defistation.io/dataProvider/tvl', {
        auth: {
          username: process.env.DEFISTATION_USER,
          password: process.env.DEFISTATION_PASSWORD,
        },
      })
      .toPromise();
    return data;
  }

  async getDefistationStats(): Promise<any> {
    const [allStats, summary] = await Promise.all([this.getAllStats(), this.subgraphService.getDailySummary()]);
    const { tvl, pools, farms, incentivizedPools } = allStats;
    const { volume, pairs } = summary;
    const data = { pools, farms, incentivizedPools, pairs };
    return { tvl, volume: parseInt(volume), data };
  }

  async getFarmPrices(): Promise<any> {
    const farmPrices = {};
    const allStats = await this.getAllStats();
    const { farms } = allStats;

    farms.forEach((farm) => {
      farmPrices[farm.poolIndex] = farm.price;
    });

    return farmPrices;
  }

  async getHomepageFeatures(): Promise<HomepageFeatures> {
    const [farmDetails, poolDetails, lendingDetails, billDetails] = [[], [], [], []];
    try {
      const { data: features } = await this.httpService.get(`${this.STRAPI_URL}/home-v-2-features`).toPromise();

      const {
        farms: featuredFarms,
        pools: featuredPools,
        lending: featuredMarkets,
        bills: featuredBills,
      } = features[0];

      const allStats = await this.getAllStats();
      const { farms, incentivizedPools: pools, lendingData, bills } = allStats;

      // Filter through farms on strapi, assign applicable values from stats
      featuredFarms.forEach((element) => {
        const { name: farmName, address, poolIndex, apr } = farms.find(({ poolIndex }) => element === poolIndex);

        // Format string to make harambe happy
        const name = farmName.replace(/[\[\]]/g, '').slice(0, -3);
        farmDetails.push({
          id: poolIndex,
          apr,
          stakeToken: { name, address },
          rewardToken: {
            name: 'DIGICHAIN',
            address: '0x603c7f932ed1fc6575303d8fb018fdcbb0f39a95',
          },
          link: `https://digiswap.finance/digichain-farms?pid=${poolIndex}`,
        });
      });

      // Filter through pools on strapi endpoint, assign applicable values from stats
      featuredPools.forEach((element) => {
        const { id, apr, name, rewardTokenAddress, stakedTokenAddress, rewardTokenSymbol } = pools.find(
          ({ id }) => element === id,
        );

        poolDetails.push({
          id,
          apr,
          stakeToken: { name, address: stakedTokenAddress },
          rewardToken: { name: rewardTokenSymbol, address: rewardTokenAddress },
          link: `https://digiswap.finance/pools?id=${id}`,
        });
      });

      //Filter through featured lending markets on endpoint
      featuredMarkets.forEach((market) => {
        let apy;
        const { type, marketContractAddress, name, tokenAddress } = market;

        const marketData = lendingData.find(
          ({ marketAddress }) => marketContractAddress.toUpperCase() == marketAddress.toUpperCase(),
        );

        const supplyDistributionApyPercent = marketData.apys.supplyDistributionApyPercent ?? 0;
        const borrowDistributionApyPercent = marketData.apys.borrowDistributionApyPercent ?? 0;
        // TODO: Include distribution APYs
        if (type.toUpperCase() === 'SUPPLY') {
          apy = marketData.apys.supplyApyPercent + supplyDistributionApyPercent;
        } else if (type.toUpperCase() === 'BORROW') {
          apy = marketData.apys.borrowApyPercent + borrowDistributionApyPercent;
        } else {
          apy = 0;
        }

        lendingDetails.push({
          marketName: type + ' ' + name,
          marketAddress: marketContractAddress,
          apy,
          token: { name, address: tokenAddress },
          link: 'https://lending.digiswap.finance',
          supplyDistributionApyPercent,
          borrowDistributionApyPercent,
        });
      });

      // Filter through bills on strapi endpoint, assign applicable values from stats
      featuredBills.forEach((element) => {
        const bill = bills?.find(({ billAddress }) => element.toUpperCase() === billAddress.toUpperCase());

        billDetails.push(bill);
      });

      return { farmDetails, poolDetails, lendingDetails, billDetails };
    } catch (error) {
      this.logger.error(`Error when attempted to retrieve homepage features: ${error.message}`);
    }
  }

  async getAllLendingMarketData(): Promise<LendingMarket[]> {
    try {
      const { bananaPrice } = await this.findGeneralStats();

      const lendingData: LendingMarket[] = [];

      const allLendingMarkets = lendingMarkets();

      const olaCompoundLensContract = this.configService.getData<string>(`56.olaCompoundLens`);

      const callsMetadata = allLendingMarkets.map((markets) => ({
        address: olaCompoundLensContract,
        name: 'cTokenMetadata',
        params: [markets.contract],
      }));
      const callsUnderlying = allLendingMarkets.map((markets) => ({
        address: olaCompoundLensContract,
        name: 'cTokenUnderlyingPrice',
        params: [markets.contract],
      }));
      const allMetada = await multicall(OLA_COMPOUND_ABI, callsMetadata);
      const allUnderlying = await multicall(OLA_COMPOUND_ABI, callsUnderlying);
      for (let i = 0; i < allLendingMarkets.length; i++) {
        const market = allLendingMarkets[i];
        const { name, contract } = market;
        const {
          borrowRatePerBlock,
          underlyingDecimals,
          totalSupply,
          cTokenDecimals,
          exchangeRateCurrent,
          totalBorrows,
          reserveFactorMantissa,
          incentiveSupplySpeed,
          incentiveBorrowSpeed,
        } = allMetada[i][0];
        const { underlyingPrice } = allUnderlying[i][0];

        const apys = calculateSupplyAndBorrowApys(
          borrowRatePerBlock,
          underlyingPrice,
          underlyingDecimals,
          totalSupply,
          cTokenDecimals,
          exchangeRateCurrent,
          totalBorrows,
          reserveFactorMantissa,
          incentiveSupplySpeed,
          incentiveBorrowSpeed,
          bananaPrice,
        );
        const { supply, borrow, tokenPrice } = calculateSupplyAndBorrowAsset(
          underlyingPrice,
          underlyingDecimals,
          totalSupply,
          cTokenDecimals,
          exchangeRateCurrent,
          totalBorrows,
        );
        lendingData.push({
          name,
          marketAddress: contract,
          totalSupply: supply,
          totalBorrows: borrow,
          tokenPrice,
          apys,
        });
      }

      return lendingData;
    } catch (error) {
      this.logger.error(`Error when attempted to retrieve lending: ${error.message}`);
    }
  }

  // Gets all the data needed for Bills
  async getAllBillsData(): Promise<TreasuryBill[]> {
    try {
      const billsData: TreasuryBill[] = [];
      const allTokens = [];
      const { data: rawBills } = await this.httpService.get(this.BILL_LIST_URL).toPromise();

      // Filter out polygon bills
      const allBills = rawBills.filter((bill) => {
        return bill.contractAddress['56'] !== '';
      });

      // Formats all applicable LPs to be ready to be priced
      allBills.forEach((bill) => {
        allTokens.push({
          chainId: 56,
          lpToken: true,
          decimals: 18,
          address: bill.lpToken.address['56'].toLowerCase(),
        });

        allTokens.push({
          chainId: 56,
          lpToken: false,
          decimals: 18,
          address: bill.earnToken.address['56'].toLowerCase(),
        });
      });

      // Gets all LP and token prices
      const tokenPrices: {
        address: string;
        price: number;
        decimals: number;
      }[] = await fetchPrices(allTokens, 56, this.configService.getData<string>(`56.apePriceGetter`));
      const callsBill = allBills.map((bill) => ({
        address: bill.contractAddress['56'],
        name: 'trueBillPrice',
      }));
      const allCustomBill = await multicall(CUSTOM_BILL_ABI, callsBill);

      // Go through all bills in the list repo, get applicable data in TreasuryBill format
      for (let i = 0; i < allBills.length; i++) {
        const bill = allBills[i];
        const {
          billType: type,
          lpToken,
          earnToken: earnToken,
          contractAddress: contract,
          billNnftAddress: billNnftAddress,
          inactive,
        } = bill;

        const lpWithPrice = tokenPrices.find(
          (token) => token.address.toLowerCase() === lpToken.address['56'].toLowerCase(),
        );
        const earnTokenWithPrice = tokenPrices.find(
          (token) => token.address.toLowerCase() === earnToken.address['56'].toLowerCase(),
        );

        const trueBillPrice = allCustomBill[i][0];

        const discount =
          ((earnTokenWithPrice.price - lpWithPrice.price * (trueBillPrice / 10 ** 18)) / earnTokenWithPrice.price) *
          100;

        billsData.push({
          type,
          lpToken: lpToken.address['56'],
          lpTokenName: lpToken.symbol,
          earnToken: earnToken.address['56'],
          earnTokenName: earnToken.symbol,
          billAddress: contract['56'],
          discount,
          link: 'https://digiswap.finance/treasury-bills',
          billNftAddress: billNnftAddress['56'],
          inactive,
        });
      }
      return billsData;
    } catch (err) {
      this.logger.error(err.message);
    }
  }

  // Function called on /stats/tvl endpoint
  async getTvlStats(): Promise<GeneralStatsChain> {
    try {
      // FIRST CHECK: Cache
      // checks to see if there is a chancedValue at 'calculateTVLStats'. If there is one, console log a note & return it.
      const cachedValue = await this.cacheManager.get('calculateTVLStats');
      if (cachedValue) {
        this.logger.log('Pulling TVL stats from cache...');
        return cachedValue as GeneralStatsChain;
      }

      // SECOND CHECK: Database
      // In the case the cache is expired, call the verifyStats('tvl') function, which checks the database.
      // If valid, return that for stats.
      const databaseValue = await this.verifyStats('tvl');
      if (databaseValue) {
        this.logger.log('Pulling TVL stats from database entry...');
        return databaseValue;
      }

      // THIRD CHECK: Get new stats

      // If the cache and database checks fail, we do the following:
      // 1. Update createdAt time in the database for the tvlstats collection document
      // This is because if we get multiple requests
      await this.updateTvlCreatedAtStats();

      // 2. Start processessing an updated version of the tvlstats document
      // This function updates the cache and database.
      this.calculateTvlStats();

      // 3. Go ahead and query the database and return the most recent version we have.
      const tvl: any = await this.findTvlStats();
      return tvl;
    } catch (e) {
      this.logger.error('Something went wrong calculating stats.');
      console.log(e);
    }
  }

  // Function called to get updated TVL stats
  async calculateTvlStats() {
    try {
      this.logger.log('Attemping to generate new TVL Stats...');
      const [
        lendingTvl,
        polygonTvl,
        bscTvl,
        { burntAmount, totalSupply, circulatingSupply },
        prices,
        { circulatingSupply: gnanaCirculatingSupply },
        partnerCount,
      ] = await Promise.all([
        this.getLendingTvl(),
        this.subgraphService.getLiquidityPolygonData(),
        this.subgraphService.getVolumeData(),
        this.getBurnAndSupply(),
        this.priceService.getTokenPrices(),
        this.getGnanaSupply(),
        this.getPartnerCount(),
      ]);
      const priceUSD = prices[bananaAddress()].usd;
      const poolsTvlBsc = await this.getTvlBsc();
      const tvl: GeneralStatsChain = {
        tvl: polygonTvl.liquidity + bscTvl.liquidity + poolsTvlBsc + lendingTvl,
        totalLiquidity: polygonTvl.liquidity + bscTvl.liquidity,
        totalVolume: polygonTvl.totalVolume + bscTvl.totalVolume,
        bsc: bscTvl,
        polygon: polygonTvl,
        burntAmount,
        totalSupply,
        circulatingSupply,
        marketCap: circulatingSupply * priceUSD,
        gnanaCirculatingSupply,
        lendingTvl,
        partnerCount,
      };
      // Stored in cache at 'calculateTVLStats', with an expiration value of 2 minutes (120 seconds)
      await this.cacheManager.set('calculateTVLStats', tvl, { ttl: 120 });
      await this.createTvlStats(tvl);

      this.logger.log('Successfully generated new TVL stats.');
      return tvl;
    } catch (error) {
      this.logger.error(`Failed to generate new TVL stats, error: ${error.message}`);
    }
  }

  async getTvlBsc() {
    const infoStats = await this.findGeneralStats();
    if (!infoStats) return 0;
    return infoStats.poolsTvl;
  }
  async getAllStats(): Promise<GeneralStats> {
    try {
      const poolPrices: GeneralStats = await this.getCalculateStats();

      poolPrices.incentivizedPools.forEach((pool) => {
        delete pool.abi;
      });

      return poolPrices;
    } catch (e) {
      this.logger.error('Something went wrong calculating stats');
      console.log(e);
    }
  }

  async getStatsForWallet(wallet): Promise<WalletStats> {
    try {
      const bananaContract = getContract(ERC20_ABI, bananaAddress());

      let walletStats: WalletStats = {
        tvl: 0,
        bananaPrice: 0,
        aggregateApr: 0,
        aggregateAprPerDay: 0,
        aggregateAprPerWeek: 0,
        aggregateAprPerMonth: 0,
        dollarsEarnedPerDay: 0,
        dollarsEarnedPerWeek: 0,
        dollarsEarnedPerMonth: 0,
        dollarsEarnedPerYear: 0,
        bananasEarnedPerDay: 0,
        bananasEarnedPerWeek: 0,
        bananasEarnedPerMonth: 0,
        bananasEarnedPerYear: 0,
        bananasInWallet: 0,
        pendingRewardUsd: 0,
        pendingRewardBanana: 0,
      };

      const [poolPrices, bananasInWallet] = await Promise.all([
        this.getCalculateStats(),
        this.getTokenBalanceOfAddress(bananaContract, wallet),
      ]);

      walletStats.bananaPrice = poolPrices.bananaPrice;
      walletStats.bananasInWallet = bananasInWallet;

      walletStats = await this.calculateWalletStats(walletStats, poolPrices, wallet);

      return walletStats;
    } catch (error) {
      if (error.code == 'INVALID_ARGUMENT') throw new WalletInvalidHttpException();
      console.log(error);
      throw new Error(error.code);
    }
  }

  async getCalculateStats() {
    const cachedValue = await this.cacheManager.get('calculateStats');
    if (cachedValue) {
      this.logger.log('Hit calculateStats() cache');
      return cachedValue as GeneralStats;
    }

    const infoStats = await this.verifyStats('general');
    if (infoStats) return infoStats;

    await this.updateCreatedAtStats();
    this.calculateStats();
    const generalStats: any = await this.findGeneralStats();
    return generalStats;
  }

  async calculateStats() {
    this.logger.log(`Attempting to calculate general stats`);
    const masterDigiContract = masterDigiContractWeb();
    const lendingData = await this.getAllLendingMarketData();
    // here
    const bills = await this.getAllBillsData();
    const poolInfos = await this.calculatePoolInfo(masterDigiContract);

    const [{ totalAllocPoints, rewardsPerDay }, prices] = await Promise.all([
      this.getAllocPointAndRewards(masterDigiContract),
      this.priceService.getTokenPrices(),
    ]);

    // If Digichain price not returned from Subgraph, calculating using pools
    if (!prices[bananaAddress()]) {
      prices[bananaAddress()] = {
        usd: getBananaPriceWithPoolList(poolInfos, prices),
      };
    }

    // Set GoldenBanana Price = digichain price / 0.72
    prices[goldenBananaAddress()] = {
      usd: prices[bananaAddress()].usd / 0.72,
    };

    const priceUSD = prices[bananaAddress()].usd;

    const [tokens, { burntAmount, totalSupply, circulatingSupply }, { tvl, totalLiquidity, totalVolume }] =
      await Promise.all([this.getTokens(poolInfos), this.getBurnAndSupply(), this.getTvlStats()]);

    const poolPrices: GeneralStats = {
      bananaPrice: priceUSD,
      tvl,
      poolsTvl: 0,
      totalLiquidity,
      totalVolume,
      burntAmount,
      totalSupply,
      circulatingSupply,
      marketCap: circulatingSupply * priceUSD,
      pools: [],
      farms: [],
      incentivizedPools: [],
      lendingData,
      bills,
    };

    for (let i = 0; i < poolInfos.length; i++) {
      if (poolInfos[i].poolToken) {
        getPoolPrices(
          tokens,
          prices,
          poolInfos[i].poolToken,
          poolPrices,
          i,
          poolInfos[i].allocPoints,
          totalAllocPoints,
          rewardsPerDay,
          this.configService.getData<string>(`${56}.contracts.digichain`),
        );
      }
    }

    poolPrices.pools.forEach((pool) => {
      poolPrices.poolsTvl += pool.stakedTvl;
    });

    await Promise.all([this.mappingIncetivizedPools(poolPrices, prices)]);

    poolPrices.incentivizedPools.forEach((pool) => {
      if (!pool.t0Address) {
        poolPrices.poolsTvl += pool.stakedTvl;
      }
    });
    this.logger.log(`finish calculate stats`);
    await this.cacheManager.set('calculateStats', poolPrices, { ttl: 120 });
    await this.createGeneralStats(poolPrices);

    return poolPrices;
  }

  async calculatePoolInfo(masterDigiContract) {
    // Uses single multicall
    const farmInfo = await this.getAllFarmInfo(masterDigiContract);

    return await Promise.all([...Array(farmInfo.length).keys()].map(async (x) => this.getFarmInfo(farmInfo[x], x)));
  }

  async getAllocPointAndRewards(masterDigiContract) {
    const [totalAllocPoints, rewardsPerDay] = await Promise.all([
      masterDigiContract.methods.totalAllocPoint().call(),
      (((await masterDigiContract.methods.cakePerBlock().call()) / 1e18) * 86400) / 3,
    ]);

    return { totalAllocPoints, rewardsPerDay };
  }

  // Gets information from every farm pid in a single multicall
  async getAllFarmInfo(masterDigiContract): Promise<any> {
    const multi = new Multicall({
      chainId: 56,
      provider: 'https://bsc-dataseed1.defibit.io:443',
    });

    const pidCount = parseInt(await masterDigiContract.methods.poolLength().call(), 10);

    const allCalls = [...Array(pidCount).keys()].map((x) => masterDigiContract.methods.poolInfo(x));

    const farmInfo = await multi.aggregate([...allCalls]);

    const filteredFarmInfo = farmInfo.map((farm) => {
      return {
        lpToken: farm[0],
        allocPoint: farm[1],
        lastRewardBlock: farm[2],
      };
    });

    return filteredFarmInfo;
  }

  async getFarmInfo(poolInfo, poolIndex) {
    // Determine if Bep20 or Lp token
    const poolToken =
      poolIndex !== 0 &&
      poolIndex !== 75 &&
      poolIndex !== 112 &&
      poolIndex !== 162 &&
      poolIndex !== 190 &&
      poolIndex !== 206
        ? await this.getLpInfo(poolInfo.lpToken, masterDigiContractAddress())
        : await this.getTokenInfo(poolInfo.lpToken, masterDigiContractAddress());

    return {
      address: poolInfo.lpToken,
      allocPoints: poolInfo.allocPoint ?? 1,
      poolToken,
      poolIndex,
      lastRewardBlock: poolInfo.lastRewardBlock,
    };
  }

  async getLpInfo(tokenAddress, stakingAddress) {
    try {
      const [reserves, decimals, token0, token1, supply, balanceOf] = await multicall(LP_ABI, [
        {
          address: tokenAddress,
          name: 'getReserves',
        },
        {
          address: tokenAddress,
          name: 'decimals',
        },
        {
          address: tokenAddress,
          name: 'token0',
        },
        {
          address: tokenAddress,
          name: 'token1',
        },
        {
          address: tokenAddress,
          name: 'totalSupply',
        },
        {
          address: tokenAddress,
          name: 'balanceOf',
          params: [stakingAddress],
        },
      ]);

      const totalSupply = supply / 10 ** decimals[0];
      const staked = balanceOf / 10 ** decimals[0];

      const q0 = reserves._reserve0;
      const q1 = reserves._reserve1;
      return {
        address: tokenAddress,
        token0: token0[0],
        q0,
        token1: token1[0],
        q1,
        totalSupply,
        stakingAddress,
        staked,
        decimals: decimals[0],
        tokens: [token0[0], token1[0]],
      };
    } catch (error) {
      console.log('inusual ', tokenAddress);
      console.log(error);
    }
  }

  async getTokenInfo(tokenAddress, stakingAddress) {
    if (tokenAddress == '0x0000000000000000000000000000000000000000') {
      return {
        address: tokenAddress,
        name: 'Binance',
        symbol: 'BNB',
        totalSupply: 1e8,
        decimals: 18,
        staked: 0,
        tokens: [tokenAddress],
      };
    }

    // HOTFIX for Rocket token (Rocket contract currently incompatible with ERC20_ABI)
    if (tokenAddress == '0x3bA5aee47Bb7eAE40Eb3D06124a74Eb89Da8ffd2') {
      const contract = getContract(
        LP_ABI,
        '0x93fa1A6357De25031311f784342c33A26Cb1C87A', // ROCKET-BNB LP pair address
      );
      const reserves = await contract.methods.getReserves().call();
      const q0 = reserves._reserve0 / 10 ** 18;

      return {
        address: tokenAddress,
        name: 'Rocket',
        symbol: 'ROCKET',
        totalSupply: 1000000000,
        decimals: 18,
        staked: q0,
        tokens: [tokenAddress],
      };
    }

    const [name, symbol, totalSupply, decimals, staked] = await multicall(ERC20_ABI, [
      {
        address: tokenAddress,
        name: 'name',
      },
      {
        address: tokenAddress,
        name: 'symbol',
      },
      {
        address: tokenAddress,
        name: 'totalSupply',
      },
      {
        address: tokenAddress,
        name: 'decimals',
      },
      {
        address: tokenAddress,
        name: 'balanceOf',
        params: [stakingAddress],
      },
    ]);

    return {
      address: tokenAddress,
      name: name[0],
      symbol: symbol[0],
      totalSupply: totalSupply[0],
      decimals: decimals[0],
      staked: staked[0] / 10 ** decimals[0],
      tokens: [tokenAddress],
    };
  }

  async getBurnAndSupply(chainId = +process.env.CHAIN_ID) {
    const bananaAddress = this.configService.getData<string>(`${chainId}.contracts.digichain`);
    const [decimals, burned, supply] = await multicallNetwork(
      this.configService.getData<any>(`${chainId}.abi.erc20`),
      [
        {
          address: bananaAddress,
          name: 'decimals',
        },
        {
          address: bananaAddress,
          name: 'balanceOf',
          params: [this.configService.getData<string>(`${chainId}.contracts.burn`)],
        },
        {
          address: bananaAddress,
          name: 'totalSupply',
        },
      ],
      chainId,
    );
    const burntAmount = burned / 10 ** decimals;
    const totalSupply = supply / 10 ** decimals;
    const circulatingSupply = totalSupply - burntAmount;

    return {
      burntAmount,
      totalSupply,
      circulatingSupply,
    };
  }

  async getGnanaSupply() {
    const gnanaContract = getContract(ERC20_ABI, goldenBananaAddress());

    const decimals = await gnanaContract.methods.decimals().call();

    const [treasury, supply] = await Promise.all([
      gnanaContract.methods.balanceOf(gBananaTreasury()).call(),
      gnanaContract.methods.totalSupply().call(),
    ]);

    const treasuryAmount = treasury / 10 ** decimals;
    const totalSupply = supply / 10 ** decimals;
    const circulatingSupply = totalSupply - treasuryAmount;

    return {
      circulatingSupply,
    };
  }

  async getTokens(poolInfos) {
    const tokens = {};
    // eslint-disable-next-line prefer-spread
    const tokenAddresses = [].concat.apply(
      [],
      poolInfos.filter((x) => x.poolToken).map((x) => x.poolToken.tokens),
    );

    await Promise.all(
      tokenAddresses.map(async (address) => {
        tokens[address] = await this.getTokenInfo(address, masterDigiContractAddress());
      }),
    );

    return tokens;
  }

  async mappingIncetivizedPools(poolPrices, prices) {
    const currentBlockNumber = await getCurrentBlock();
    const pools = await this.getIncentivizedPools();
    poolPrices.incentivizedPools = await Promise.all(
      pools.map(async (pool) => this.getIncentivizedPoolInfo(pool, prices, currentBlockNumber)),
    );
    poolPrices.incentivizedPools = poolPrices.incentivizedPools.filter((x) => x); //filter null pools
  }

  async getIncentivizedPoolInfo(pool, prices, currentBlockNumber) {
    const poolContract = getContract(pool.abi, pool.address);

    const [startBlock, bonusEndBlock] = await multicall(pool.abi, [
      {
        address: pool.address,
        name: 'startBlock',
      },
      {
        address: pool.address,
        name: 'bonusEndBlock',
      },
    ]);

    const active = startBlock <= currentBlockNumber && bonusEndBlock >= currentBlockNumber;

    if (pool.stakeTokenIsLp) {
      const [reserves, stakedTokenDecimals, t0Address, t1Address] = await multicall(LP_ABI, [
        {
          address: pool.stakeToken,
          name: 'getReserves',
        },
        {
          address: pool.stakeToken,
          name: 'decimals',
        },
        {
          address: pool.stakeToken,
          name: 'token0',
        },
        {
          address: pool.stakeToken,
          name: 'token1',
        },
      ]);

      const rewardTokenContract = getContract(ERC20_ABI, pool.rewardToken);
      const rewardDecimals = await rewardTokenContract.methods.decimals().call();

      const [token0decimals, token1decimals, rewardTokenSymbol, t0Symbol, t1Symbol] = await multicall(ERC20_ABI, [
        {
          address: t0Address[0],
          name: 'decimals',
        },
        {
          address: t1Address[0],
          name: 'decimals',
        },
        {
          address: pool.rewardToken,
          name: 'symbol',
        },
        {
          address: t0Address[0],
          name: 'symbol',
        },
        {
          address: t1Address[0],
          name: 'symbol',
        },
      ]);

      let [totalSupply, stakedSupply] = await multicall(LP_ABI, [
        {
          address: pool.stakeToken,
          name: 'totalSupply',
        },
        {
          address: pool.stakeToken,
          name: 'balanceOf',
          params: [pool.address],
        },
      ]);

      totalSupply = totalSupply / 10 ** stakedTokenDecimals[0];
      stakedSupply = stakedSupply / 10 ** stakedTokenDecimals[0];
      const rewardsPerBlock = (await poolContract.methods.rewardPerBlock().call()) / 10 ** rewardDecimals;

      const q0 = reserves._reserve0 / 10 ** token0decimals[0];
      const q1 = reserves._reserve1 / 10 ** token1decimals[0];

      let p0 = getParameterCaseInsensitive(prices, t0Address[0])?.usd;
      let p1 = getParameterCaseInsensitive(prices, t1Address[0])?.usd;

      if (p0 == null && p1 == null) {
        return undefined;
      }
      if (p0 == null) {
        p0 = (q1 * p1) / q0;
        prices[t0Address[0]] = { usd: p0 };
      }
      if (p1 == null) {
        p1 = (q0 * p0) / q1;
        prices[t1Address[0]] = { usd: p1 };
      }

      const tvl = q0 * p0 + q1 * p1;
      const stakedTvl = (stakedSupply * tvl) / totalSupply;

      const rewardTokenPrice = getParameterCaseInsensitive(prices, pool.rewardToken)?.usd;
      const apr = active ? (rewardTokenPrice * ((rewardsPerBlock * 86400) / 3) * 365) / stakedTvl : 0;

      return {
        id: pool.sousId,
        name: createLpPairName(t0Symbol[0], t1Symbol[0]),
        address: pool.address,
        active,
        blocksRemaining: active ? bonusEndBlock - currentBlockNumber : 0,
        stakedTokenAddress: pool.stakeToken,
        t0Address: t0Address[0],
        t0Symbol: t0Symbol[0],
        p0,
        q0,
        t1Address: t1Address[0],
        t1Symbol: t1Symbol[0],
        p1,
        q1,
        totalSupply,
        stakedSupply,
        rewardDecimals,
        stakedTokenDecimals: stakedTokenDecimals[0],
        tvl,
        stakedTvl,
        apr,
        rewardTokenPrice,
        rewardTokenSymbol: rewardTokenSymbol[0],
        price: tvl / totalSupply,
        abi: pool.abi,
      };
    } else {
      let stakedTokenPrice = getParameterCaseInsensitive(prices, pool.stakeToken)?.usd;

      // If token is not trading on DEX, assign price = 0
      if (isNaN(stakedTokenPrice)) {
        stakedTokenPrice = 0;
      }

      let rewardTokenPrice = getParameterCaseInsensitive(prices, pool.rewardToken)?.usd;

      // If token is not trading on DEX, assign price = 0
      if (isNaN(rewardTokenPrice)) {
        rewardTokenPrice = 0;
      }

      const [name, stakedTokenDecimals, rewardDecimals, rewardTokenSymbol] = await multicall(ERC20_ABI, [
        {
          address: pool.stakeToken,
          name: 'symbol',
        },
        {
          address: pool.stakeToken,
          name: 'decimals',
        },
        {
          address: pool.rewardToken,
          name: 'decimals',
        },
        {
          address: pool.rewardToken,
          name: 'symbol',
        },
      ]);

      let [totalSupply, stakedSupply] = await multicall(ERC20_ABI, [
        {
          address: pool.stakeToken,
          name: 'totalSupply',
        },
        {
          address: pool.stakeToken,
          name: 'balanceOf',
          params: [pool.address],
        },
      ]);
      totalSupply = totalSupply / 10 ** stakedTokenDecimals[0];
      stakedSupply = stakedSupply / 10 ** stakedTokenDecimals[0];
      const rewardsPerBlock = (await poolContract.methods.rewardPerBlock().call()) / 10 ** rewardDecimals[0];
      const tvl = totalSupply * stakedTokenPrice;
      const stakedTvl = (stakedSupply * tvl) / totalSupply;

      let apr = 0;
      if (active && stakedTokenPrice != 0) {
        apr = (rewardTokenPrice * ((rewardsPerBlock * 86400) / 3) * 365) / stakedTvl;
      }

      return {
        id: pool.sousId,
        name: name[0],
        address: pool.address,
        active,
        blocksRemaining: active ? bonusEndBlock - currentBlockNumber : 0,
        rewardTokenAddress: pool.rewardToken,
        stakedTokenAddress: pool.stakeToken,
        totalSupply,
        stakedSupply,
        rewardDecimals: rewardDecimals[0],
        stakedTokenDecimals: stakedTokenDecimals[0],
        tvl,
        stakedTvl,
        apr,
        rewardTokenPrice,
        rewardTokenSymbol: rewardTokenSymbol[0],
        price: stakedTokenPrice,
        abi: pool.abi,
      };
    }
  }

  async getTokenBalanceOfAddress(tokenContract, address): Promise<any> {
    const decimals = await tokenContract.methods.decimals().call();
    return (await tokenContract.methods.balanceOf(address).call()) / 10 ** decimals;
  }

  async calculateWalletStats(walletStats: WalletStats, poolPrices, wallet) {
    const masterDigiContract = masterDigiContractWeb();
    let totalApr = 0;

    const [pools, farms, incentivezed] = await Promise.all([
      getWalletStatsForPools(wallet, poolPrices.pools, masterDigiContract),
      getWalletStatsForFarms(wallet, poolPrices.farms, masterDigiContract),
      getWalletStatsForIncentivizedPools(wallet, poolPrices.incentivizedPools),
    ]);
    walletStats.pools = pools;
    walletStats.farms = farms;
    walletStats.incentivizedPools = incentivezed;

    walletStats.pools.forEach((pool) => {
      walletStats.pendingRewardUsd += pool.pendingRewardUsd;
      walletStats.pendingRewardBanana += pool.pendingReward;
      walletStats.dollarsEarnedPerDay += pool.dollarsEarnedPerDay;
      walletStats.dollarsEarnedPerWeek += pool.dollarsEarnedPerWeek;
      walletStats.dollarsEarnedPerMonth += pool.dollarsEarnedPerMonth;
      walletStats.dollarsEarnedPerYear += pool.dollarsEarnedPerYear;
      walletStats.bananasEarnedPerDay += pool.tokensEarnedPerDay;
      walletStats.bananasEarnedPerWeek += pool.tokensEarnedPerWeek;
      walletStats.bananasEarnedPerMonth += pool.tokensEarnedPerMonth;
      walletStats.bananasEarnedPerYear += pool.tokensEarnedPerYear;
      walletStats.tvl += pool.stakedTvl;
      totalApr += pool.stakedTvl * pool.apr;
    });

    walletStats.farms.forEach((farm) => {
      walletStats.pendingRewardUsd += farm.pendingRewardUsd;
      walletStats.pendingRewardBanana += farm.pendingReward;
      walletStats.dollarsEarnedPerDay += farm.dollarsEarnedPerDay;
      walletStats.dollarsEarnedPerWeek += farm.dollarsEarnedPerWeek;
      walletStats.dollarsEarnedPerMonth += farm.dollarsEarnedPerMonth;
      walletStats.dollarsEarnedPerYear += farm.dollarsEarnedPerYear;
      walletStats.bananasEarnedPerDay += farm.tokensEarnedPerDay;
      walletStats.bananasEarnedPerWeek += farm.tokensEarnedPerWeek;
      walletStats.bananasEarnedPerMonth += farm.tokensEarnedPerMonth;
      walletStats.bananasEarnedPerYear += farm.tokensEarnedPerYear;
      walletStats.tvl += farm.stakedTvl;
      totalApr += farm.stakedTvl * farm.apr;
    });

    walletStats.incentivizedPools.forEach((incentivizedPool) => {
      walletStats.pendingRewardUsd += incentivizedPool.pendingRewardUsd;
      walletStats.dollarsEarnedPerDay += incentivizedPool.dollarsEarnedPerDay;
      walletStats.dollarsEarnedPerWeek += incentivizedPool.dollarsEarnedPerWeek;
      walletStats.dollarsEarnedPerMonth += incentivizedPool.dollarsEarnedPerMonth;
      walletStats.dollarsEarnedPerYear += incentivizedPool.dollarsEarnedPerYear;
      walletStats.tvl += incentivizedPool.stakedTvl;
      totalApr += incentivizedPool.stakedTvl * incentivizedPool.apr;
    });

    walletStats.aggregateApr = walletStats.tvl ? totalApr / walletStats.tvl : 0;
    walletStats.aggregateAprPerDay = walletStats.aggregateApr / 365;
    walletStats.aggregateAprPerWeek = (walletStats.aggregateApr * 7) / 365;
    walletStats.aggregateAprPerMonth = (walletStats.aggregateApr * 30) / 365;

    return walletStats;
  }

  async getIncentivizedPools(): Promise<IncentivizedPoolList[]> {
    const { data } = await this.httpService.get(this.POOL_LIST_URL).toPromise();
    const pools = data
      .map((pool) => ({
        sousId: pool.sousId,
        name: `${pool.stakingToken.symbol} -> ${pool.rewardToken.symbol}`,
        address: pool.contractAddress[this.chainId],
        stakeToken: pool.stakingToken.address[this.chainId],
        stakeTokenIsLp: pool.stakingToken.lpToken || pool.poolCategory.toLowerCase() === 'jungle',
        rewardToken: pool.rewardToken.address[this.chainId],
        rewardPerBlock: pool.tokenPerBlock,
        startBlock: pool.startBlock,
        bonusEndBlock: pool.bonusEndBlock,
        abi: this.getABI(pool.abi),
        category: pool.poolCategory.toLowerCase(),
      }))
      .filter(({ sousId }) => sousId !== 0);

    return pools;
  }

  getABI(value) {
    switch (value) {
      case 'BEP20_REWARD_DIGI_ABI':
        return BEP20_REWARD_DIGI_ABI;

      default:
        return BEP20_REWARD_DIGI_ABI;
    }
  }

  async getLendingTvl() {
    let tvl = 0;
    try {
      const contract = getContract(LENDING_ABI, lendingAddress());
      const { totalSupply } = await contract.methods.viewLendingNetwork(unitrollerAddress()).call();
      tvl = totalSupply / 10 ** 18;
    } catch (error) {
      console.log(error);
    }
    return tvl;
  }

  // Gets the count of partners based on the partner-counts strapi endpoint
  async getPartnerCount() {
    try {
      const { data } = await this.httpService.get(`${this.STRAPI_URL}/partner-counts`).toPromise();

      return data[0].count;
    } catch (error) {
      this.logger.error(error.message);
    }
  }
}
