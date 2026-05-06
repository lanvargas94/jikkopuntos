import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { JikkoPointsController } from './jikkopoints.controller';
import { JikkoPointsService } from './jikkopoints.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [JikkoPointsController],
  providers: [JikkoPointsService],
  exports: [JikkoPointsService],
})
export class JikkoPointsModule {}
