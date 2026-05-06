import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtUserPayload) {
    const count = await this.notifications.unreadCount(user.userId);
    return { count };
  }

  @Get()
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query('limit') limitStr?: string,
  ) {
    const n = limitStr ? parseInt(limitStr, 10) : 30;
    const limit = Number.isFinite(n) ? n : 30;
    return this.notifications.listForUser(user.userId, limit);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtUserPayload) {
    return this.notifications.markAllRead(user.userId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(user.userId, id);
  }
}
