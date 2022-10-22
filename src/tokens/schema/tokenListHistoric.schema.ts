import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Token } from '../../interfaces/tokens/token.dto';

export type TokenListHistoricDocument = TokenListHistoric & Document;

@Schema()
export class TokenListHistoric {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  tokens: Token[];

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const TokenListHistoricSchema = SchemaFactory.createForClass(TokenListHistoric);
