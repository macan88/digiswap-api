import { CacheModule, HttpException, HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';

import { StatsService } from './stats.service';
import { SubgraphService } from './subgraph.service';
import { PriceService } from './price.service';
import { closeInMongodConnection, rootMongooseTestModule } from 'src//utils/testing';
import { GeneralStatsSchema } from './schema/generalStats.schema';

describe('StatsService', () => {
  let service: StatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.register({ ttl: 60 }),
        HttpModule,
        rootMongooseTestModule(),
        MongooseModule.forFeature([{ name: 'GeneralStats', schema: GeneralStatsSchema }]),
      ],
      providers: [StatsService, SubgraphService, PriceService],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get all stats', async () => {
    const objStats = {
      digichainPrice: expect.any(Number),
      burntAmount: expect.any(Number),
      totalSupply: expect.any(Number),
      circulatingSupply: expect.any(Number),
      marketCap: expect.any(Number),
      pools: expect.any(Array),
      farms: expect.any(Array),
      incentivizedPools: expect.any(Array),
    };
    const objPools = {
      address: expect.any(String),
      apr: expect.any(Number),
      decimals: expect.any(String),
      lpSymbol: expect.any(String),
      poolIndex: expect.any(Number),
      price: expect.any(Number),
      staked: expect.any(Number),
      stakedTvl: expect.any(Number),
      tvl: expect.any(Number),
    };
    const objFarms = {
      address: expect.any(String),
      name: expect.any(String),
      poolIndex: expect.any(Number),
      t0Address: expect.any(String),
      t0Symbol: expect.any(String),
      t0Decimals: expect.any(String),
      p0: expect.any(Number),
      q0: expect.any(Number),
      t1Address: expect.any(String),
      t1Symbol: expect.any(String),
      t1Decimals: expect.any(String),
      p1: expect.any(Number),
      q1: expect.any(Number),
      price: expect.any(Number),
      totalSupply: expect.any(Number),
      tvl: expect.any(Number),
      stakedTvl: expect.any(Number),
      apr: expect.any(Number),
      decimals: expect.any(Number),
    };
    const objIncentivized = {
      id: expect.any(Number),
      name: expect.any(String),
      address: expect.any(String),
      active: expect.any(Boolean),
      blocksRemaining: expect.any(Number),
      stakedTokenAddress: expect.any(String),
      totalSupply: expect.any(Number),
      stakedSupply: expect.any(Number),
      rewardDecimals: expect.any(String),
      stakedTokenDecimals: expect.any(String),
      tvl: expect.any(Number),
      stakedTvl: expect.any(Number),
      apr: expect.any(Number),
      rewardTokenPrice: expect.any(Number),
      rewardTokenSymbol: expect.any(String),
      price: expect.any(Number),
    };

    const stats = await service.calculateStats();
    expect(stats).toEqual(expect.objectContaining(objStats));
    if (stats.pools.length > 0) {
      expect(stats.pools[0]).toEqual(expect.objectContaining(objPools));
    }
    if (stats.farms.length > 0) {
      expect(stats.farms[0]).toEqual(expect.objectContaining(objFarms));
    }
    if (stats.incentivizedPools.length > 0) {
      expect(stats.incentivizedPools[0]).toEqual(expect.objectContaining(objIncentivized));
    }
  });

  it('should get stats for wallet', async () => {
    const objWallet = {
      tvl: expect.any(Number),
      digichainPrice: expect.any(Number),
      aggregateApr: expect.any(Number),
      aggregateAprPerDay: expect.any(Number),
      aggregateAprPerWeek: expect.any(Number),
      aggregateAprPerMonth: expect.any(Number),
      dollarsEarnedPerDay: expect.any(Number),
      dollarsEarnedPerWeek: expect.any(Number),
      dollarsEarnedPerMonth: expect.any(Number),
      dollarsEarnedPerYear: expect.any(Number),
      digichainsEarnedPerDay: expect.any(Number),
      digichainsEarnedPerWeek: expect.any(Number),
      digichainsEarnedPerMonth: expect.any(Number),
      digichainsEarnedPerYear: expect.any(Number),
      digichainsInWallet: expect.any(Number),
      pendingRewardUsd: expect.any(Number),
      pendingRewardDigichain: expect.any(Number),
      pools: expect.any(Array),
      farms: expect.any(Array),
      incentivizedPools: expect.any(Array),
    };
    const objGeneral = {
      address: expect.any(String),
      name: expect.any(String),
      stakedTvl: expect.any(Number),
      pendingReward: expect.any(Number),
      pendingRewardUsd: expect.any(Number),
      apr: expect.any(Number),
      dollarsEarnedPerDay: expect.any(Number),
      dollarsEarnedPerWeek: expect.any(Number),
      dollarsEarnedPerMonth: expect.any(Number),
      dollarsEarnedPerYear: expect.any(Number),
      tokensEarnedPerDay: expect.any(Number),
      tokensEarnedPerWeek: expect.any(Number),
      tokensEarnedPerMonth: expect.any(Number),
      tokensEarnedPerYear: expect.any(Number),
    };
    const wallet = '0xe5EdeA54596B385C3c8dFd5010C3Cf892d547Acb';
    const statsWallet = await service.getStatsForWallet(wallet);
    expect(statsWallet).toEqual(expect.objectContaining(objWallet));
    if (statsWallet.pools.length > 0) {
      expect(statsWallet.pools[0]).toEqual(expect.objectContaining(objGeneral));
    }
    if (statsWallet.farms.length > 0) {
      expect(statsWallet.farms[0]).toEqual(expect.objectContaining(objGeneral));
    }
    if (statsWallet.incentivizedPools.length > 0) {
      expect(statsWallet.incentivizedPools[0]).toEqual(expect.objectContaining(objGeneral));
    }
  });

  it('should show invalid wallet address error code', async () => {
    const messageError = 'Wallet Invalid';
    const wallet = '0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da';

    await expect(service.getStatsForWallet(wallet)).rejects.toThrow(new HttpException(messageError, 400));
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
});
