import { Module, HttpModule } from '@nestjs/common';
import { CheckController } from './check.controller';
import { CheckService } from './check.service';

@Module({
  imports: [HttpModule],
  providers: [CheckService],
  exports: [],
  controllers: [CheckController],
})
export class CheckModule {}
