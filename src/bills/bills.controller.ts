import { Controller, Get, Logger, Param } from '@nestjs/common';
import { BillsService } from './bills.service';

@Controller('bills')
export class BillsController {
  private readonly logger = new Logger(BillsController.name);
  constructor(private billsService: BillsService) {}

  @Get('/bsc/:billId')
  async getBillData(@Param('billId') billId: number) {
    this.logger.debug(`Called GET /bills/bsc/${billId}`);
    return await this.billsService.getBillMetadata(56, { tokenId: +billId });
  }

  @Get('/bsc/:contract/:billId')
  async getBillV2Data(@Param('billId') billId: number, @Param('contract') nftContractAddress: string) {
    this.logger.debug(`Called GET /bills/bsc/${billId}`);
    return await this.billsService.getBillMetadata(56, { tokenId: +billId, nftContractAddress });
  }

  @Get('/:chainId/:contract/:billId')
  async getMultiChainBillV2Data(
    @Param('billId') billId: number,
    @Param('contract') nftContractAddress: string,
    @Param('chainId') chainId: number,
  ) {
    this.logger.debug(`Called GET MULTICHAIN /bills/${chainId}/${billId}`);
    return await this.billsService.getBillMetadata(chainId, { tokenId: +billId, nftContractAddress });
  }

  @Get('/bsc/:billId/:transactionHash')
  async getBillDataWithTransactionHash(
    @Param('billId') billId: number,
    @Param('transactionHash') transactionHash: string,
  ) {
    this.logger.debug(`Called GET /bills/bsc/${billId}/${transactionHash}`);
    return await this.billsService.getBillMetadataWithHash({
      tokenId: +billId,
      transactionHash,
    });
  }
}
