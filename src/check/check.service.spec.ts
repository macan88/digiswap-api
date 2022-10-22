import { HttpModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckService } from './check.service';

describe('CheckService', () => {
  let service: CheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [CheckService],
    }).compile();

    service = module.get<CheckService>(CheckService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be returned permitted country code', async () => {
    const userRegion = await service.checkUserRegion('185.153.177.159');
    expect(userRegion).toMatchObject({
      countryCode: 'MX',
      isRestrictedRegion: false,
    });
  });

  it('should be returned restricted country code', async () => {
    const userRegion = await service.checkUserRegion('175.45.176.1');
    expect(userRegion).toMatchObject({
      countryCode: 'KP',
      isRestrictedRegion: true,
    });
  });
});
