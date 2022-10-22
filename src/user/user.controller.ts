import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import crypto from 'crypto';

@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  @Get('/sign/:wallet')
  async signMoonPay(@Param('wallet') wallet: string, @Query('url') originalUrl: string) {
    this.logger.debug(`Called GET /user/sign/${wallet}`);
    originalUrl = `${originalUrl}&walletAddress=${wallet}`;

    const signature = crypto
      .createHmac('sha256', process.env.MOONPAY_SIGN_KEY)
      .update(new URL(originalUrl).search)
      .digest('base64');

    const signedUrl = `${originalUrl}&signature=${encodeURIComponent(signature)}`;
    return signedUrl;
  }
}
