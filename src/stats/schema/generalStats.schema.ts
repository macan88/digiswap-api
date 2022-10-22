import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FarmStatsDto } from 'src/interfaces/stats/farm.dto';
import { LendingMarket } from 'src/interfaces/stats/lendingMarket.dto';

export type GeneralStatsDocument = GeneralStats & Document;

@Schema()
export class GeneralStats {
  @Prop({ required: true })
  digichainPrice: number;

  @Prop({ required: true })
  burntAmount: number;

  @Prop({ required: true })
  totalSupply: number;

  @Prop({ required: true })
  circulatingSupply: number;

  @Prop({ required: true })
  marketCap: number;

  @Prop({ required: true })
  tvl: number;

  @Prop({ required: true })
  poolsTvl: number;

  @Prop()
  tvlInBnb: number;

  @Prop({ required: true })
  totalLiquidity: number;

  @Prop({ required: true })
  totalVolume: number;

  @Prop({ required: true })
  pools: [];

  @Prop({ required: true })
  farms: FarmStatsDto[];

  @Prop({ required: true })
  incentivizedPools: [];

  @Prop({ required: false })
  lendingData: LendingMarket[];

  @Prop({ required: false })
  bills: [];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const GeneralStatsSchema = SchemaFactory.createForClass(GeneralStats);
