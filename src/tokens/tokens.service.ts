import { Injectable, Logger, HttpService } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubgraphService } from '../stats/subgraph.service';
import { ChainConfigService } from 'src/config/chain.configuration.service';
import { TokenList, TokenListDocument } from './schema/tokenList.schema';
import { getWeb3 } from 'src/utils/lib/web3';
import { StrapiTokensObject, Token } from 'src/interfaces/tokens/token.dto';
import { getHiddenListToken } from 'src/utils/helpers';
import { sortBy } from 'lodash';
import { PriceService } from 'src/stats/price.service';
import Web3 from 'web3';
import { getBalanceNumber } from 'src/utils/math';
import BigNumber from 'bignumber.js';
import {
  TokenListHistoric,
  TokenListHistoricDocument,
  TokenListHistoricSchema,
} from './schema/tokenListHistoric.schema';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly TOKEN_LIST_URL = this.configService.getData<string>('tokenListUrl');
  private readonly POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;

  constructor(
    @InjectModel(TokenList.name)
    private tokenListModel: Model<TokenListDocument>,
    @InjectModel(TokenListHistoric.name)
    private tokenListHistoricModel: Model<TokenListHistoricDocument>,
    private subgraphService: SubgraphService,
    private httpService: HttpService,
    private configService: ChainConfigService,
  ) {}

  bscWeb3 = getWeb3(56);
  polygonWeb3 = getWeb3(137);
  telosWeb3 = getWeb3(40);

  /*
    FUNCTIONS CALLED BY THE CONTROLLER
  */

  // Called at /tokens
  async getAllTokens(): Promise<TokenList[]> {
    try {
      const tokenLists: TokenList[] = await this.findAllTokenLists();
      return tokenLists;
    } catch (error) {
      this.logger.error(error.message);
      return error.message;
    }
  }

  async getTokenListInfo(): Promise<any> {
    const { data } = await this.httpService
      .get('https://raw.githubusercontent.com/ApeSwapFinance/digiswap-token-lists/main/lists/digiswap.json')
      .toPromise();

    return data;
  }

  // Called at /tokens/:type
  async getTokensFromType(type: string): Promise<Token[]> {
    try {
      // Check 1: Latest Database entry within 2 mins
      const tokenList: TokenList = await this.findTokenList(type);
      const databaseValue = await this.verifyDatabaseTime(tokenList);
      if (databaseValue) {
        this.logger.log(`Pulled ${type} tokens from database entry...`);
        return databaseValue.tokens;
      }

      // Check 2: Update Created At & Get new data, while returning existing data
      await this.updateTokenListCreatedAt();
      this.refreshTokensLists();

      return tokenList.tokens;
    } catch (error) {
      this.logger.error(error.message);
      return error.message;
    }
  }

  async refreshTelos(): Promise<string> {
    const { data } = await this.httpService
      .get('https://digiswap-strapi.herokuapp.com/home-v-2-token-lists-by-chain-ids')
      .toPromise();

    const DateOne = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const DateTwo = new Date(Date.now() - 25 * 60 * 60 * 1000);

    //Now find the value from 24 hours ago. This isn't exact because we don't know how often it will be updated. It will find the oldest between 24 and 25 hour old
    let oldData = await this.tokenListHistoricModel
      .find({
        createdAt: {
          $gte: DateTwo,
          $lt: DateOne,
        },
      })
      .sort({ createdAt: -1 })
      .limit(1);

    //At first there won't be one 24 hours old, so if there isn't we'll take the oldest that is less than 25 hours old
    if (oldData.length === 0) {
      oldData = await this.tokenListHistoricModel
        .find({
          createdAt: {
            $gte: DateTwo,
          },
        })
        .sort({ createdAt: -1 })
        .limit(1);
    }

    //Temp until we have a working Telos graph

    const tData = await this.getTokenListInfo();

    const tokens = [];

    //Temp - Not ideal to do it this way, but the multicall in priceService was causing an error.
    const contract = new this.telosWeb3.eth.Contract(
      [
        {
          inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: '_decimals', type: 'uint256' },
          ],
          name: 'getPrice',
          outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      '0x29392efed565c13a0901aeb88e32bf58eeb8a067',
    );

    for (let i = 0; i < data[0].tokens['40'][0].tokens.length; i++) {
      let item = tData.tokens.find((x) => x.address.toLowerCase() == data[0].tokens['40'][0].tokens[i].toLowerCase());
      let oldItem =
        oldData.length === 0
          ? item
          : oldData[0].tokens.find(
              (x) => x.contractAddress.toLowerCase() == data[0].tokens['40'][0].tokens[i].toLowerCase(),
            );
      let price: BigNumber;

      await contract.methods.getPrice(data[0].tokens['40'][0].tokens[i], item.decimals).call(function (error, result) {
        price = result;
      });

      tokens.push({
        tokenTicker: item.symbol,
        tokenPrice: '0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73,0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b'.includes(
          data[0].tokens['40'][0].tokens[i],
        )
          ? 1
          : getBalanceNumber(price, item.decimals),
        percentChange: '0xefaeee334f0fd1712f9a8cc375f427d9cdd40d73,0x818ec0a7fe18ff94269904fced6ae3dae6d6dc0b'.includes(
          data[0].tokens['40'][0].tokens[i],
        )
          ? 0
          : (oldItem.tokenPrice - getBalanceNumber(price, item.decimals)) / oldItem.tokenPrice,
        contractAddress: data[0].tokens['40'][0].tokens[i],
        logoUrl: item.logoURI,
        list: true,
        liquidity: 0,
      });
    }

    await this.createTokenList({
      title: 'telos',
      tokens: tokens,
    });

    let historicTelos = {
      title: 'telos',
      tokens: tokens,
      createdAt: new Date(Date.now()),
    };

    await this.tokenListHistoricModel.insertMany(historicTelos);

    return 'Telos Refreshed';
  }

  // Called at /tokens/request
  async refreshTokensLists(): Promise<string> {
    this.logger.log('Attempting to refresh token lists...');
    try {
      const { data } = await this.httpService
        .get('https://digiswap-strapi.herokuapp.com/home-v-2-token-lists-by-chain-ids')
        .toPromise();

      await this.processTokensFromSubgraphData(56, data[0].tokens['56']);
      await this.processTokensFromSubgraphData(137, data[0].tokens['137']);

      await this.refreshTelos();

      return 'Tokens succesfully refreshed ❤️🐵';
    } catch (error) {
      this.logger.error(error.message);
      return error.message;
    }
  }

  async getTokensTrending(): Promise<Token[]> {
    const tokens = await this.getTokensFromType('all-56');
    const hiddenTokens = getHiddenListToken();
    const filter = tokens.filter((token) => !hiddenTokens.includes(token.contractAddress.toLowerCase()) && token.list);
    sortBy(filter, ['liquidity', 'percentChange']);
    const last = filter.slice(0, 12);
    last.sort((a, b) => {
      if (a.percentChange > b.percentChange) return -1;
      if (a.percentChange < b.percentChange) return 1;
      return 0;
    });
    return last;
  }

  /* 
    MAIN FUNCTION TO PROCESS TOKEN DATA
  */

  async processTokensFromSubgraphData(chainId: number, tokenListConfig: StrapiTokensObject[]): Promise<Token[]> {
    // 1. Get raw token data from subgraph, both now & 24 hours ago
    const { currentTokenData, previousTokenData } = await this.getRawTokenDataFromSubgraph(chainId);

    // 2. Filter raw token data into data for the database
    const filteredTokenData = await this.prepDataForDatabase(currentTokenData, previousTokenData);

    const type = `all-${chainId}`;

    await this.tokenListModel.updateMany({ title: type }, { $set: { 'tokens.$[].list': false } }, { multi: true });
    await this.createTokenList({
      title: type,
      tokens: filteredTokenData,
    });

    const tokenStorageResponse: TokenList = await await this.findTokenList(type);

    // 4. Iterate through the token lists on strapi to map to subgraph data & store findings in the database
    tokenListConfig.forEach(async (tokenList) => {
      const applicableTokens = [];
      const { type, tokens } = tokenList;

      // Go through each token on strapi & find its match on subgraph data pull
      for (let i = 0; i < tokens.length; i++) {
        applicableTokens.push(
          filteredTokenData.find(({ contractAddress }) => tokens[i].toLowerCase() === contractAddress.toLowerCase()),
        );

        await this.createTokenList({
          title: type,
          tokens: applicableTokens,
        });
      }
    });

    this.logger.log(`Refresh for chain ${chainId} complete. Data stored in database`);
    return tokenStorageResponse.tokens;
  }

  /*
    SUBGRAPH FUNCTIONALITY
  */
  async getRawTokenDataFromSubgraph(chainId: number): Promise<any> {
    let yesterdayBlock: number;

    if (chainId === 56) {
      yesterdayBlock = (await this.bscWeb3.eth.getBlockNumber()) - 28800;
    } else if (chainId === 137) {
      const previousTimestamp = Math.floor(Date.now() / 1000) - 86400;

      const {
        data: { result },
      } = await this.httpService
        .get(
          `https://api.polygonscan.com/api?module=block&action=getblocknobytime&timestamp=${previousTimestamp}&closest=before&apikey=${this.POLYGONSCAN_API_KEY}`,
        )
        .toPromise();

      yesterdayBlock = result;
    } else {
      throw 'Invalid chain Id';
    }

    const currentTokenData = await this.subgraphService.getTopTokensData(chainId, 'now');
    const previousTokenData = await this.subgraphService.getTopTokensData(chainId, yesterdayBlock.toString());

    return {
      currentTokenData: currentTokenData.tokens,
      previousTokenData: previousTokenData.tokens,
    };
  }

  /*
    FILTER & UTILS FUNCTIONALITY
  */
  async prepDataForDatabase(currentTokenData: any, previousTokenData: any): Promise<any> {
    const preppedTokens: Token[] = [];

    // Get most recent list of tokens from single source of truth, github token list (env var)
    const {
      data: { tokens },
    } = await this.httpService.get(this.TOKEN_LIST_URL).toPromise();
    // Loop through current tokens to find and calculate matching tokens from previous datadate
    for (let i = 0; i < currentTokenData.length; i++) {
      const { id, symbol, tokenDayData } = currentTokenData[i];
      const previousToken = previousTokenData.find(({ id: prevId }) => prevId.toLowerCase() === id.toLowerCase());

      // Skip the iteration if no matching token found
      if (!previousToken || !tokenDayData[0]) {
        continue;
      }

      // Get price & % change
      const currentPrice = parseFloat(tokenDayData[0].priceUSD);
      const previousPrice = parseFloat(previousToken.tokenDayData[0].priceUSD);
      const liquidity = parseFloat(tokenDayData[0].totalLiquidityUSD);
      const percentageChange = (currentPrice - previousPrice) / previousPrice;

      // Get logo URL
      const logoUrl = await this.getTokenLogoUrl(id, tokens);
      // Push token info properly filtered to the array
      preppedTokens.push({
        tokenTicker: symbol,
        tokenPrice: currentPrice,
        percentChange: percentageChange,
        contractAddress: id,
        logoUrl,
        list: logoUrl !== null && logoUrl !== undefined,
        liquidity,
      });
    }

    return preppedTokens;
  }

  getTokenLogoUrl = async (tokenAddress: string, tokenListings: any) => {
    return tokenListings.find((token) => tokenAddress.toUpperCase() === token.address.toUpperCase())?.logoURI;
  };

  async verifyDatabaseTime(data: any, cacheDelay = 120000) {
    const now = Date.now();

    if (!data?.createdAt) return null;

    // If the last DB creation was created greater than 2 mins ago, reject.
    const lastCreatedAt = new Date(data.createdAt).getTime();
    if (now - lastCreatedAt > cacheDelay) return null;

    return data;
  }

  /* 
    DATABASE FUNCTIONALITY
  */
  createTokenList(tokenList: any) {
    return this.tokenListModel.updateOne(
      { title: tokenList.title },
      {
        $set: tokenList,
        $currentDate: {
          createdAt: true,
        },
      },
      {
        upsert: true,
        timestamps: true,
      },
    );
  }

  findTokenList(type: string) {
    return this.tokenListModel.findOne({ title: type });
  }

  findAllTokenLists() {
    return this.tokenListModel.find();
  }

  updateTokenListCreatedAt() {
    return this.tokenListModel.updateMany(
      {},
      {
        $currentDate: {
          createdAt: true,
        },
      },
    );
  }
}
