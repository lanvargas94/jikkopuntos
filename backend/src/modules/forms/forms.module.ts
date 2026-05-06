import { Module } from '@nestjs/common';
import { JikkoPointsModule } from '../jikkopoints/jikkopoints.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  imports: [JikkoPointsModule, NotificationsModule],
  controllers: [FormsController],
  providers: [FormsService],
})
export class FormsModule {}
