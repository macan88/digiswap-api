import { CacheModule, HttpModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BillsMetadata, BillsMetadataSchema } from 'src/bills/schema/billsMetadata.schema';
import { BitqueryModule } from 'src/bitquery/bitquery.module';
import { ChainConfigService } from 'src/config/chain.configuration.service';
import { StatsModule } from 'src/stats/stats.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardHistoryHelperService } from './dashboardHistoryHelper.service';
import { DashboardOverviewService } from './dashboardOverview.service';
import { Dashboard, DashboardSchema } from './schemas/dashboard.schema';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300,
    }),
    ConfigModule.forRoot({
      envFilePath: ['.development.env', '.env'],
      isGlobal: true,
    }),
    BitqueryModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Dashboard.name, schema: DashboardSchema },
      { name: BillsMetadata.name, schema: BillsMetadataSchema },
    ]),
    StatsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, ChainConfigService, DashboardOverviewService, DashboardHistoryHelperService],
  exports: [DashboardService],
})
export class DashboardModule {}
