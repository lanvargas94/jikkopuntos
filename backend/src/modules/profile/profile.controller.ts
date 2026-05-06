import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { UpdateProfileSheetDto } from './dto/update-profile-sheet.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('me')
  getMine(@CurrentUser() user: JwtUserPayload) {
    return this.profile.getCollaboratorSheet(user.userId);
  }

  @Patch('me')
  updateMine(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: UpdateProfileSheetDto,
  ) {
    return this.profile.updateSheet(user, dto);
  }
}
