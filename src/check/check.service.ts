import { Injectable, Logger, HttpService } from '@nestjs/common';

@Injectable()
export class CheckService {
  private readonly logger = new Logger(CheckService.name);

  constructor(private httpService: HttpService) {}

  async checkUserRegion(ip: string): Promise<{ isRestrictedRegion: boolean; countryCode: string }> {
    const RESTRICTED_REGIONS = ['BY', 'CI', 'CU', 'CD', 'IR', 'IQ', 'LR', 'KP', 'SD', 'SY', 'ZW'];
    try {
      const { data: ipApi } = await this.httpService.get(`http://ip-api.com/json/${ip}`).toPromise();
      const countryCode = ipApi.countryCode;
      return {
        isRestrictedRegion: RESTRICTED_REGIONS.includes(countryCode),
        countryCode,
      };
    } catch (error) {
      this.logger.error(error.message);
      return error.message;
    }
  }
}
