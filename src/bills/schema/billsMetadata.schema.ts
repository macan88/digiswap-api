import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Attribute, BillData } from '../interface/billData.interface';

export type BillsMetadataDocument = BillsMetadata & Document;

@Schema({
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret._v;
    },
  },
})
export class BillsMetadata {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  tokenId: number;

  @Prop({ required: true })
  image?: string;

  @Prop({ required: true })
  attributes: Attribute[];

  @Prop({ required: true, type: Types.Map })
  data: BillData;

  @Prop({ required: true })
  contractAddress: string;

  @Prop({ required: true })
  chainId: number;
}
const BillsMetadataSchema = SchemaFactory.createForClass(BillsMetadata);
BillsMetadataSchema.index({ tokenId: 1, contractAddress: -1 }, { unique: true });
export { BillsMetadataSchema };
