import { HttpService, Injectable, Logger } from '@nestjs/common';
import { UltimateTextToImage, getCanvasImage, registerFont, IImage, IFontWeight } from 'ultimate-text-to-image';
import path from 'path';
import svg2img from 'svg2img';
import { groupBy, mapValues } from 'lodash';
import { writeFile, readFile, readdir } from 'fs/promises';
import moment from 'moment';
import { BillMetadata } from './interface/billData.interface';
import { pinFileToIPFS } from './pinata.helper';
import sleep from 'sleep-promise';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BillsImagesService {
  logger = new Logger(BillsImagesService.name);

  supportedTokenImages = [];

  constructor(private httpService: HttpService, private config: ConfigService) {
    registerFont(path.join(__dirname, './fonts/Cash-Currency.ttf'), {
      family: 'cashFont',
    });
    readdir(path.join(__dirname, `./images/tokens`)).then((tokens) => {
      this.supportedTokenImages = tokens.map((token) => token.replace('.png', ''));
    });
  }

  toSvg(url: string, width: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      svg2img(url, { width, height: width }, async function (error, buffer) {
        if (error) return reject(error);
        await writeFile(path.join(__dirname, 'test.png'), buffer);
        return resolve(buffer);
      });
    });
  }

  async createAndUploadBillImage(billMetadata: BillMetadata, chainId: number, attempt = 0) {
    try {
      this.logger.log(`Generating bill ${billMetadata.name}`);
      const buffer = await this.createBillImageWithMetadata(billMetadata, chainId);
      const pin = await pinFileToIPFS(process.env.PINATA_KEY, process.env.PINATA_SECRET, billMetadata.name, buffer);
      return `https://digiswap.mypinata.cloud/ipfs/${pin.data.IpfsHash}`;
    } catch (e) {
      this.logger.error('Something went wrong creating and uploading the image');
      this.logger.error(e);
      if (attempt < 5) {
        this.logger.log(`Retrying: ${attempt}`);
        await sleep(100 * attempt);
        return this.createAndUploadBillImage(billMetadata, chainId, attempt + 1);
      }
      throw e;
    }
  }

  async createBillImageWithMetadata(billMetadata: BillMetadata, chainId: number) {
    const baseLayers = this.getLayers(billMetadata, chainId);

    const layers = await this.createLayers(baseLayers);

    const type = await this.textToCanvasImage(
      `${billMetadata.data.type.toUpperCase()} BILL`,
      30,
      'cashFont',
      '#695B5B',
    );

    const vesting = await this.textToCanvasImage(
      `${billMetadata.data.vestingPeriodSeconds / 86400} DAYS`,
      30,
      'cashFont',
      '#695B5B',
    );

    const totalPayout = await this.textToCanvasImage(`TOTAL PAYOUT`, 18, 'cashFont', '#695B5B');

    let precision = 5;
    if (billMetadata.data.payout >= 100000) precision = 0;
    else if (billMetadata.data.payout >= 10000) precision = 1;
    else if (billMetadata.data.payout >= 1000) precision = 2;
    else if (billMetadata.data.payout >= 100) precision = 3;
    else if (billMetadata.data.payout >= 10) precision = 4;

    const amount = await this.textToCanvasImage(
      `${billMetadata.data.payout.toFixed(precision)} ${billMetadata.data.payoutTokenData.symbol}`,
      26,
      'cashFont',
      '#695B5B',
    );

    const margin = (billMetadata.data.payoutTokenData.symbol.length - 6) * 16;

    const maturation = await this.textToCanvasImage(
      moment(billMetadata.data.expires * 1000)
        .format('Do of MMM, YYYY')
        .toString()
        .toUpperCase(),
      18,
      'cashFont',
      '#695B5B',
    );

    const canvas = await getCanvasImage({ buffer: layers });

    const textToImage = new UltimateTextToImage('', {
      width: 1920,
      height: 1080,
      images: [
        { canvasImage: canvas, layer: -1, repeat: 'fit' },
        {
          canvasImage: type,
          layer: 1,
          x: 1449,
          y: 323,
        },
        {
          canvasImage: vesting,
          layer: 1,
          x: 1519,
          y: 368,
        },
        {
          canvasImage: totalPayout,
          layer: 1,
          x: 1494,
          y: 853,
        },
        {
          canvasImage: amount,
          layer: 1,
          x: 1454 - margin,
          y: 880,
        },
        {
          canvasImage: maturation,
          layer: 1,
          x: 1494,
          y: 918,
        },
      ],
    })
      .render()
      // .toFile(path.join(__dirname, `test-gen/image-${Math.random()}.png`));
      .toStream();
    return textToImage;
  }

  getLayers(billMetadata: BillMetadata, chainId) {
    let billBorder = 'bnw';
    if (billMetadata.data.dollarValue >= 50 && billMetadata.data.dollarValue < 250) {
      billBorder = 'bronze';
    } else if (billMetadata.data.dollarValue >= 250 && billMetadata.data.dollarValue < 1000) {
      billBorder = 'silver';
    } else if (billMetadata.data.dollarValue >= 1000 && billMetadata.data.dollarValue < 10000) {
      billBorder = 'gold';
    } else if (billMetadata.data.dollarValue >= 10000 && billMetadata.data.dollarValue < 100000) {
      billBorder = 'diamond';
    } else if (billMetadata.data.dollarValue >= 100000) {
      billBorder = 'rainbow';
    }
    let baseLayers;

    const layerAttributes = mapValues(groupBy(billMetadata.attributes, 'trait_type'), (arr) =>
      arr[0].value.replace(/ /g, '_').toLowerCase(),
    );

    if (
      billMetadata.tokenId <= 450 &&
      chainId === 56 &&
      billMetadata.contractAddress === this.config.get<string>(`${chainId}.contracts.billNft`)
    )
      baseLayers = [
        './v1/location.png',
        './v1/innovation.png',
        `./v1/legend-${billBorder}.png`,
        './v1/moment.png',
        './v1/rectangles.png',
        './v1/stamp.png',
        './v1/trend.png',
        `./tokens/${billMetadata.data.token0.symbol}.png`,
        `./tokens/${billMetadata.data.token1.symbol}.png`,
      ];
    else {
      if (billBorder === 'bnw') {
        baseLayers = [
          `./bnw/bnw_jungle.png`,
          `./bnw/bnw_obie_playing_flute.png`,
          `./bnw/bnw_obie.png`,
          `./bnw/bnw_jean_claude_dancing.png`,
          `./bnw/bnw_rectangles.png`,
          `./bnw/bnw_v2.png`,
          `./bnw/bnw_ribbon.png`,
          `./bnw/bnw_bananas.png`,
        ];
        baseLayers.push(
          `./bnw/${billMetadata.data.token0.symbol}${
            (billMetadata.data.token0.symbol.toLowerCase() == 'wtlos' ||
              billMetadata.data.token1.symbol.toLowerCase() === 'wtlos') &&
            'usdt,usdc'.includes(billMetadata.data.token0.symbol.toLowerCase())
              ? '_LEFT'
              : ''
          }.png`,
        );
        baseLayers.push(
          `./bnw/${billMetadata.data.token1.symbol}${
            (billMetadata.data.token0.symbol.toLowerCase() == 'wtlos' ||
              billMetadata.data.token1.symbol.toLowerCase() === 'wtlos') &&
            'usdt,usdc'.includes(billMetadata.data.token1.symbol.toLowerCase())
              ? '_LEFT'
              : ''
          }.png`,
        );
      } else
        baseLayers = [
          `./v2/${layerAttributes['The Location']}.png`,
          `./v2/${layerAttributes['The Innovation']}.png`,
          `./v2/${layerAttributes['The Legend']}_${billBorder}.png`,
          `./v2/${layerAttributes['The Moment']}.png`,
          `./v2/rectangles.png`,
          `./v2/v2.png`,
          `./v2/ribbon.png`,
          `./v2/${layerAttributes['The Trend']}.png`,
          `./tokens/${billMetadata.data.token0.symbol}${
            (billMetadata.data.token0.symbol.toLowerCase() == 'wtlos' ||
              billMetadata.data.token1.symbol.toLowerCase() === 'wtlos') &&
            'usdt,usdc'.includes(billMetadata.data.token0.symbol.toLowerCase())
              ? '_LEFT'
              : ''
          }.png`,
          `./tokens/${billMetadata.data.token1.symbol}${
            (billMetadata.data.token0.symbol.toLowerCase() == 'wtlos' ||
              billMetadata.data.token1.symbol.toLowerCase() === 'wtlos') &&
            'usdt,usdc'.includes(billMetadata.data.token1.symbol.toLowerCase())
              ? '_LEFT'
              : ''
          }.png`,
        ];
    }

    return baseLayers;
  }

  async createLayers(layers) {
    const layerBuffers = await Promise.all(
      layers.map((layer) => {
        return readFile(path.join(__dirname, `./images/${layer}`));
      }),
    );

    const imageCanvas = await Promise.all(
      layerBuffers.map((buffer: Buffer) => {
        return getCanvasImage({ buffer });
      }),
    );

    const images: IImage[] = imageCanvas.map((canvasImage) => {
      return { canvasImage, layer: 0, repeat: 'fit' };
    });

    const textToImage = new UltimateTextToImage('', {
      width: 1920,
      height: 1080,
      images,
    })
      .render()
      .toBuffer();
    return textToImage;
  }

  textToCanvasImage(
    text: string,
    fontSize: number,
    fontFamily = 'sans-serif',
    fontColor = '#7E7579',
    fontWeight: IFontWeight = '400',
  ) {
    const buffer = new UltimateTextToImage(text, {
      fontSize,
      fontFamily,
      fontColor,
      fontWeight,
    })
      .render()
      .toBuffer();
    return getCanvasImage({ buffer });
  }
}
