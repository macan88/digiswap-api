import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FarmStatsDto } from 'src/interfaces/stats/farm.dto';
import { LendingMarket } from 'src/interfaces/stats/lendingMarket.dto';

export type GeneralStatsNetworkDocument = GeneralStatsNetwork & Document;

@Schema()
export class GeneralStatsNetwork {
  @Prop()
  chainId: number;

  @Prop()
  bananaPrice: number;

  @Prop()
  burntAmount: number;

  @Prop()
  totalSupply: number;

  @Prop()
  circulatingSupply: number;

  @Prop()
  marketCap: number;

  @Prop({ required: true })
  poolsTvl: number;

  @Prop()
  pools: [];

  @Prop()
  farms: FarmStatsDto[];

  @Prop()
  incentivizedPools: [];

  @Prop({ required: false })
  lendingData: LendingMarket[];

  @Prop({ required: false })
  bills: [];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const GeneralStatsNetworkSchema = SchemaFactory.createForClass(GeneralStatsNetwork);
