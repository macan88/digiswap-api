import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import { Model } from 'mongoose';
import sleep from 'sleep-promise';
import { createLpPairName } from 'src/utils/helpers';
import { Web3Service } from 'src/web3/web3.service';
import { BillNft_abi } from './abi/BillNft.abi';
import { CUSTOM_BILL_ABI } from './abi/CustomBill.abi';
import { BillsImagesService } from './bills.images.service';
import { BillData, BillTerms } from './interface/billData.interface';
import { generateAttributes, generateV1Attributes } from './random.layers';
import { BillsMetadata, BillsMetadataDocument } from './schema/billsMetadata.schema';
import { getLpInfo } from './token.helper';

@Injectable()
export class BillsService {
  logger = new Logger(BillsService.name);

  terms: { [key: string]: BillTerms } = {};

  // Used to check if other create transaction is running on state
  billCreations = {};

  constructor(
    private web3: Web3Service,
    private config: ConfigService,
    private image: BillsImagesService,
    @InjectModel(BillsMetadata.name)
    public billMetadataModel: Model<BillsMetadataDocument>,
  ) {
    this.listenToEvents(this.config.get<string>(`40.contracts.billNftV2`));
    this.listenToEvents(this.config.get<string>(`137.contracts.billNftV2`));
    this.listenToEvents(this.config.get<string>(`56.contracts.billNft`));
    this.listenToEvents(this.config.get<string>(`56.contracts.billNftV2`));
  }

  async getBillDataFromTransaction(transactionHash: string, chainId: number = 56) {
    const logTopics = {
      40: '0xe58e2397580448f038c428fd00f6fa73f939e2bc4f98fb93a9c4d85182b62d6c',
      56: '0xe58e2397580448f038c428fd00f6fa73f939e2bc4f98fb93a9c4d85182b62d6c',
      137: '0xe58e2397580448f038c428fd00f6fa73f939e2bc4f98fb93a9c4d85182b62d6c',
      //137: '0xbe028bbca27c3dbd0acb0d6d8caa7626e69d9dbbe76643953c503b65b67d7b4f',
    };

    const transaction = await this.web3.getTransaction(chainId, transactionHash);

    const log = transaction.logs.find((log) => log.topics[0] === logTopics[chainId]);

    const billContract = log.address;

    // Decode event log
    const iface = new utils.Interface(CUSTOM_BILL_ABI);

    const event = {
      data: log.data,
      topics: log.topics,
    };

    const eventLog = iface.parseLog(event);

    const { terms, payoutToken, principalToken, billNftAddress } = await this.getBillTerms(billContract, chainId);

    const lpData = await getLpInfo(
      principalToken,
      payoutToken,
      this.config.get<string>(`${chainId}.apePriceGetter`),
      transaction.blockNumber,
      chainId,
    );

    const bananaAddress = this.config.get<string>(`${chainId}.contracts.digichain`);

    const deposit = new BigNumber(eventLog.args.deposit.toString()).div(new BigNumber(10).pow(18)).toNumber();

    const billData: BillData = {
      billContract,
      billNftAddress,
      payout: new BigNumber(eventLog.args.payout.toString())
        .div(new BigNumber(10).pow(lpData.payoutToken.decimals))
        .toNumber(),
      deposit,
      createTransactionHash: transactionHash,
      billNftId: eventLog.args.billId.toNumber(),
      expires: eventLog.args.expires.toNumber(),
      vestingPeriodSeconds: parseInt(terms.vestingTerm),
      payoutToken: payoutToken,
      principalToken: principalToken,
      type: payoutToken.toLowerCase() === bananaAddress.toLowerCase() ? 'Digichain' : 'Jungle',
      pairName: createLpPairName(lpData.token0.symbol, lpData.token1.symbol),
      payoutTokenData: lpData.payoutToken,
      token0: lpData.token0,
      token1: lpData.token1,
      dollarValue: lpData.lpPrice * deposit,
    };

    return { transaction, eventLog, billData };
  }

  async getBillTerms(contractAddress: string, chainId = 56): Promise<BillTerms> {
    if (!this.terms[contractAddress])
      this.terms[contractAddress] = await this.getBillTermsFromContract(contractAddress, chainId);
    return this.terms[contractAddress];
  }

  async getBillTermsFromContract(contractAddress: string, chainId = 56): Promise<BillTerms> {
    const contract = this.web3.getContract(chainId, CUSTOM_BILL_ABI, contractAddress);
    // TODO: multicall this?
    const [terms, payoutToken, principalToken, billNftAddress] = await Promise.all([
      contract.methods.terms().call(),
      contract.methods.payoutToken().call(),
      contract.methods.principalToken().call(),
      contract.methods.billNft().call(),
    ]);

    return { terms, payoutToken, principalToken, billNftAddress };
  }

  async getBillDataWithNftId(
    chainId = 56,
    { tokenId, nftContractAddress = this.config.get<string>(`${chainId}.contracts.billNftV2`), attempt = 0 },
  ) {
    try {
      this.logger.log('POLY 1');
      const event = await this.fetchTokenIdMintEvent(chainId, { tokenId, nftContractAddress });
      this.logger.log('POLY 2');
      this.logger.log(event[0].transactionHash + ' - ' + chainId);
      const { billData } = await this.getBillDataFromTransaction(event[0].transactionHash, chainId);
      this.logger.log('POLY 3');

      return billData;
    } catch (e) {
      this.logger.error(`Something went wrong getting bill data with NFT`);
      this.logger.error(e);
      if (attempt < 5) {
        this.logger.log(`Retrying - Attempt: ${attempt}`);
        await sleep(100 * attempt);
        return this.getBillDataWithNftId(chainId, { tokenId, attempt: attempt + 1 });
      }
      throw e;
    }
  }

  async getBillMetadata(
    chainId = 56,
    { tokenId, nftContractAddress = this.config.get<string>(`${chainId}.contracts.billNft`) },
  ) {
    let billMetadata = await this.billMetadataModel.findOne(
      { tokenId, contractAddress: nftContractAddress.toLowerCase(), chainId },
      '-_id',
    );
    try {
      if (!billMetadata) {
        this.logger.log(`Loading bill ${tokenId}`);
        const billData = await this.getBillDataWithNftId(chainId, { tokenId, nftContractAddress });
        if (!this.billCreations[billData.createTransactionHash]) {
          this.billCreations[billData.createTransactionHash] = this.createNewBill(billData, chainId);
        }
        billMetadata = await this.billCreations[billData.createTransactionHash].catch((e) => {
          this.logger.log(e);
          delete this.billCreations[billData.createTransactionHash];
          throw new InternalServerErrorException();
        });
        delete this.billCreations[billData.createTransactionHash];
      }

      return billMetadata;
    } catch (error) {
      return {
        billNftId: tokenId,
        tokenId: tokenId,
        image: 'https://digiswap.finance/images/hidden-bill.png',
        processing: true,
      };
    }
  }

  async getBillMetadataWithHash({ transactionHash, tokenId, attempt = 0 }, chainId = 56) {
    let billMetadata = await this.billMetadataModel.findOne({ tokenId, chainId }, '-_id');
    if (!billMetadata) {
      try {
        this.logger.log(`Loading bill ${tokenId}`);
        if (!this.billCreations[transactionHash]) {
          const { billData } = await this.getBillDataFromTransaction(transactionHash, chainId);
          billMetadata = await this.createNewBill(billData, chainId);
        } else billMetadata = await this.billCreations[transactionHash];
      } catch (e) {
        this.logger.error(`Something went wrong creating bill data with transation hash`);
        this.logger.error(e);
        if (attempt < 5) {
          this.logger.log(`Retrying - Attempt: ${attempt}`);
          await sleep(100 * attempt);
          return this.getBillMetadataWithHash({
            transactionHash,
            tokenId,
            attempt: attempt + 1,
          });
        }
        throw e;
      }
    }
    return billMetadata;
  }

  async fetchTokenIdMintEvent(
    chainId = 56,
    { tokenId, nftContractAddress = this.config.get<string>(`${chainId}.contracts.billNft`) },
  ) {
    const contract = this.web3.getEthersContract(chainId, BillNft_abi, nftContractAddress);

    const filters = contract.filters.Transfer('0x0000000000000000000000000000000000000000', null, tokenId);
    filters.fromBlock = 16543530;
    const events = await this.web3.getArchiveRpcClient(chainId).getLogs(filters);

    return events;
  }

  async listenToEvents(billNftContractAddress: string, chainId = 56) {
    this.logger.log('Listening to bill mint events');
    const contract = this.web3.getEthersContract(chainId, BillNft_abi, billNftContractAddress);
    const filter = contract.filters.Transfer('0x0000000000000000000000000000000000000000');
    this.web3.getRpcClient(chainId).on(filter, async (event) => {
      this.logger.log('BillNft mint event triggered');
      if (!this.billCreations[event.transactionHash]) {
        const { billData } = await this.getBillDataFromTransaction(event.transactionHash, chainId);
        this.billCreations[event.transactionHash] = this.createNewBill(billData, chainId);
        await this.billCreations[event.transactionHash].catch();
        delete this.billCreations[event.transactionHash];
      }
    });
  }

  async createNewBill(billData: BillData, chainId = 56) {
    const attributes =
      billData.billNftId <= 450 &&
      chainId === 56 &&
      billData.billNftAddress == this.config.get<string>(`${chainId}.contracts.billNft`)
        ? generateV1Attributes(billData)
        : generateAttributes(billData);

    const newBillMetadata: BillsMetadata = {
      name: `Treasury Bill #${billData.billNftId}`,
      description: `Treasury Bill #${billData.billNftId}`,
      attributes,
      data: billData,
      tokenId: billData.billNftId,
      contractAddress: billData.billNftAddress.toLowerCase(),
      chainId: chainId,
    };

    newBillMetadata.image = await this.image.createAndUploadBillImage(newBillMetadata, chainId);
    return this.billMetadataModel.create(newBillMetadata);
  }

  // TODO: evaluate need for this function ~ consider removal
  async getBillDataFromContractWithNftId({ tokenId }, chainId = 137) {
    const billNftContract = this.web3.getContract(
      chainId,
      BillNft_abi,
      this.config.get<string>(`${chainId}.contracts.billNft`),
    );
    const billAddress = await billNftContract.methods.billAddresses(tokenId).call(chainId);
    const { terms, payoutToken, principalToken, billNftAddress } = await this.getBillTerms(billAddress);
    const billContract = this.web3.getContract(chainId, CUSTOM_BILL_ABI, billAddress);
    const billInfo = await billContract.methods.billInfo(tokenId).call(chainId);

    const lpData = await getLpInfo(
      principalToken,
      payoutToken,
      this.config.get<string>(`${chainId}.apePriceGetter`),
      undefined,
    );
    const bananaAddress = this.config.get<string>(`${chainId}.contracts.digichain`);

    const billData: BillData = {
      billContract,
      billNftAddress,
      payout: new BigNumber(billInfo.payout.toString()).div(new BigNumber(10).pow(18)).toNumber(),
      /*deposit: new BigNumber(eventLog.args.deposit.toString())
        .div(new BigNumber(10).pow(18))
        .toNumber(), */
      billNftId: tokenId,
      expires: billInfo.vesting + billInfo.lastBlockTimestamp,
      vestingPeriodSeconds: parseInt(terms.vestingTerm),
      payoutToken: payoutToken,
      principalToken: principalToken,
      type: payoutToken.toLowerCase() === bananaAddress.toLowerCase() ? 'Digichain' : 'Jungle',
      pairName: createLpPairName(lpData.token0.symbol, lpData.token1.symbol),
      payoutTokenData: lpData.payoutToken,
      token0: lpData.token0,
      token1: lpData.token1,
    };
    return billData;
  }
}
