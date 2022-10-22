import { CacheInterceptor, Controller, Get, Logger, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewService } from './dashboardOverview.service';
import {
  TreasuryDto,
  HistoryTreasury,
  TokenTreasuryDto,
  LockedValueDto,
  TradeVolumeDto,
  ProtocolMetricsDto,
  DigichainDistribution,
  RatioHistoryDto,
} from './dto/dashboardData.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);
  constructor(private dashboardService: DashboardService, private dashboardOverviewService: DashboardOverviewService) {}

  @Get('/treasury')
  async getTreasuryData(): Promise<TreasuryDto> {
    this.logger.debug(`Called GET /dashboard/treasury`);
    return await this.dashboardService.getTreasuryData();
  }

  @Get('/treasury/history')
  async getHistory(): Promise<HistoryTreasury[]> {
    this.logger.debug(`Called GET /treasury/history`);
    return await this.dashboardService.getHistory();
  }

  @Get('/treasury/asset-overview')
  async getAssetOverview(): Promise<TokenTreasuryDto[]> {
    this.logger.debug(`Called GET /treasury/asset-overview`);
    return await this.dashboardService.getAssetOverview();
  }

  @Get('/overview/tvl')
  async getOverviewTvl(): Promise<LockedValueDto> {
    this.logger.debug(`Called GET /dashboard/overview/tvl`);
    return await this.dashboardOverviewService.getOverviewTvl();
  }

  @Get('/overview/volume')
  async getOverviewVolume(): Promise<TradeVolumeDto[]> {
    this.logger.debug(`Called GET /dashboard/overview/volume`);
    return await this.dashboardOverviewService.getOverviewVolume();
  }

  @Get('/overview/protocol-metrics')
  async getOverviewProtocolMetrics(): Promise<ProtocolMetricsDto[]> {
    this.logger.debug(`Called GET /dashboard/overview/protocol-metrics`);
    return await this.dashboardOverviewService.getOverviewProtocolMetrics();
  }

  @Get('/overview/digichain-distribution')
  async getOverviewDigichainDistribution(): Promise<DigichainDistribution> {
    this.logger.debug(`Called GET /dashboard/overview/digichain-distribution`);
    return await this.dashboardOverviewService.getOverviewDigichainDistribution();
  }

  @Get('/overview/mcap-tvl-ratio')
  async getMcapTvlRatio(): Promise<RatioHistoryDto[]> {
    this.logger.debug(`Called GET /dashboard/overview/mcap-tvl-ratio`);
    return await this.dashboardOverviewService.getMcapTvlRatio();
  }
}
