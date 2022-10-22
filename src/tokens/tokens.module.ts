import { CacheModule, Module, HttpModule } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { SubgraphService } from '../stats/subgraph.service';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenList, TokenListSchema } from './schema/tokenList.schema';
import { ChainConfigService } from 'src/config/chain.configuration.service';
import { PriceService } from 'src/stats/price.service';
import { TokenListHistoric, TokenListHistoricSchema } from './schema/tokenListHistoric.schema';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60,
    }),
    HttpModule,
    MongooseModule.forFeature([{ name: TokenList.name, schema: TokenListSchema }]),
    MongooseModule.forFeature([{ name: TokenListHistoric.name, schema: TokenListHistoricSchema }]),
  ],
  providers: [TokensService, SubgraphService, ChainConfigService],
  exports: [],
  controllers: [TokensController],
})
export class TokensModule {}
