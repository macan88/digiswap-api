import { RealIP } from 'nestjs-real-ip';
import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CheckService } from './check.service';

@ApiTags('check')
@Controller('check')
export class CheckController {
  private readonly logger = new Logger(CheckController.name);
  constructor(private checkService: CheckService) {}

  @ApiOkResponse({
    type: String,
  })
  @Get()
  async checkUserRegion(@RealIP() ip: string): Promise<{ isRestrictedRegion: boolean; countryCode: string }> {
    this.logger.log('Called GET /check');
    return await this.checkService.checkUserRegion(ip);
  }
}
