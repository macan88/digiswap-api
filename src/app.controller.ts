import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiExcludeEndpoint()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiExcludeEndpoint()
  @Get('bab-nft/:tokenId')
  getBabMeta(@Param('tokenId') tokenId: number) {
    return {
      name: `ApeSwap BAB Club #${tokenId}`,
      description: 'Welcome to the ApeSwap BAB Club',
      external_url: 'https://digiswap.finance/',
      image: 'https://ipfs.io/ipfs/QmfCoM3vEv4uAThyATKzbUAfFJ9Mn4uox5NQAT3RnXtqNB',
      animation_url: 'https://ipfs.io/ipfs/Qme2Qfn2hrvzM9pwGwm9gMakUSLshZ58WbpcE7ErvrEDaJ',
      tokenId,
    };
  }
}
