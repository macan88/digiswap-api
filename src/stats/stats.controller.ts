import {
  CacheInterceptor,
  Controller,
  Get,
  Logger,
  Param,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ChainIdDto,
  GeneralStats,
  GeneralStatsNetworkDto,
  ApeLpApr,
  HomepageFeatures,
} from 'src/interfaces/stats/generalStats.dto';
import { GeneralStatsChain } from 'src/interfaces/stats/generalStatsChain.dto';
import { SentryInterceptor } from 'src/interceptor/sentry.interceptor';
import { StatsService } from './stats.service';
import { StatsNetworkService } from './stats.network.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('stats')
@Controller('stats')
@UseInterceptors(CacheInterceptor, SentryInterceptor)
export class StatsController {
  private readonly logger = new Logger(StatsController.name);
  constructor(private statsService: StatsService, private statsNetworkService: StatsNetworkService) {}

  @ApiOkResponse({
    type: GeneralStats,
  })
  @Get()
  async getAllStats(): Promise<GeneralStats> {
    this.logger.debug('Called GET /stats');
    return await this.statsService.getAllStats();
  }

  @ApiOkResponse({
    type: GeneralStatsChain,
  })
  @Get('/tvl')
  async getTvlStats(): Promise<GeneralStatsChain> {
    this.logger.debug('Called GET /tvl');
    return await this.statsService.getTvlStats();
  }

  @ApiOkResponse({
    type: GeneralStats,
  })
  @Get('/overall')
  async getOverallStats(): Promise<GeneralStats> {
    this.logger.debug('Called GET /stats/overall');
    return this.statsService.getDefistationStats();
  }

  @Get('/supply')
  async getSupply(): Promise<number> {
    this.logger.debug('Called GET /stats/supply');
    const { circulatingSupply } = await this.statsService.getBurnAndSupply();
    return circulatingSupply;
  }

  @Get('/total-supply')
  async getTotalSupply(): Promise<number> {
    this.logger.debug('Called GET /stats/total-supply');
    const { totalSupply } = await this.statsService.getBurnAndSupply();
    return totalSupply;
  }

  @Get('/farmPrices')
  async getFarmPrices(): Promise<any> {
    this.logger.debug('Called GET /stats/farmPrices');
    return await this.statsService.getFarmPrices();
  }

  @Throttle(700, 60)
  @Get('/network/lpAprs/:chainId')
  async getLpAprs(@Param() chainIdDto: ChainIdDto): Promise<ApeLpApr> {
    this.logger.debug('Called GET /stats/network/lpAprs/:chainId');
    return await this.statsNetworkService.getLpAprs(+chainIdDto.chainId);
  }

  @Get('/features')
  async getHomepageFeatures(): Promise<HomepageFeatures> {
    this.logger.debug('Called GET /stats/features');
    return await this.statsService.getHomepageFeatures();
  }

  @Get('network/:chainId')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getStatsNetwork(@Param() chainIdDto: ChainIdDto): Promise<GeneralStatsNetworkDto> {
    this.logger.debug(`Called GET /stats/network/${chainIdDto.chainId}`);
    return await this.statsNetworkService.getCalculateStatsNetwork(+chainIdDto.chainId);
  }

  @ApiExcludeEndpoint()
  @Get('/get')
  async get(): Promise<any> {
    this.logger.debug('Called GET /stats/get');
    return this.statsService.getDefistation();
  }
}
