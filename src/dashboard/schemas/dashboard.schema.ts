import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  AllHistoryTreasuryDto,
  AllHistoryTvlDto,
  DigichainDistribution,
  HistoryDto,
  LockedValueDto,
  OverviewDto,
  ProtocolDto,
  RatioDto,
  TreasuryDto,
  VolumeDto,
} from '../dto/dashboardData.dto';

export type DashboardDocument = Dashboard & Document;
@Schema({
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret._v;
      delete ret.createdAt;
    },
  },
})
@Schema()
export class Dashboard {
  @Prop()
  treasury: TreasuryDto;

  @Prop()
  overview: OverviewDto;

  @Prop()
  tvl: LockedValueDto;

  @Prop()
  volume: VolumeDto;

  @Prop()
  protocol: ProtocolDto;

  @Prop()
  distribution: DigichainDistribution;

  @Prop()
  historyTreasury: HistoryDto;

  @Prop()
  history: AllHistoryTreasuryDto;

  @Prop()
  tvlHistory: AllHistoryTvlDto;

  @Prop()
  ratio: RatioDto;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const DashboardSchema = SchemaFactory.createForClass(Dashboard);
