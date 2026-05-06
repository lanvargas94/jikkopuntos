import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLE_CODES } from '../../common/constants/roles';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { ListCollaboratorsQueryDto } from './dto/list-collaborators-query.dto';
import { UpdateCollaboratorAdminDto } from './dto/update-collaborator-admin.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('collaborators')
  listCollaborators(@Query() query: ListCollaboratorsQueryDto) {
    return this.users.listCollaborators(query);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('collaborators/:id')
  getCollaborator(@Param('id') id: string) {
    return this.users.getCollaboratorAdmin(id);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('collaborators')
  createCollaborator(
    @CurrentUser() admin: JwtUserPayload,
    @Body() dto: CreateCollaboratorDto,
  ) {
    return this.users.createCollaborator(dto, admin.userId);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('collaborators/:id')
  updateCollaborator(
    @CurrentUser() admin: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCollaboratorAdminDto,
  ) {
    return this.users.updateCollaboratorAdmin(admin.userId, id, dto);
  }

  @Get('me')
  getMe(@CurrentUser() user: JwtUserPayload) {
    return this.users.getMe(user.userId);
  }
}
