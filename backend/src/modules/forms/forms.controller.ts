import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE_CODES } from '../../common/constants/roles';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { CreateFormDefinitionDto } from './dto/create-form-definition.dto';
import { ListFormsQueryDto } from './dto/list-forms-query.dto';
import { ReplaceFormQuestionsDto } from './dto/replace-form-questions.dto';
import { SubmitFormResponseDto } from './dto/submit-form-response.dto';
import { UpdateFormDefinitionDto } from './dto/update-form-definition.dto';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  // --- Administración ---

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('definitions')
  createDefinition(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateFormDefinitionDto,
  ) {
    return this.forms.createDefinition(user, dto);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('definitions')
  listDefinitions(@Query() query: ListFormsQueryDto) {
    return this.forms.listDefinitionsForAdmin(query);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('definitions/:id')
  getDefinition(@Param('id') id: string) {
    return this.forms.getDefinitionForAdmin(id);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('definitions/:id/preview')
  previewDefinition(@Param('id') id: string) {
    return this.forms.previewDefinitionForAdmin(id);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Put('definitions/:id/questions')
  replaceQuestions(
    @Param('id') id: string,
    @Body() dto: ReplaceFormQuestionsDto,
  ) {
    return this.forms.replaceQuestions(id, dto);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('definitions/:id')
  updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateFormDefinitionDto,
  ) {
    return this.forms.updateDefinition(id, dto);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('definitions/:id/publish')
  publish(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.forms.publish(id, user.userId);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('definitions/:id/responses/export')
  exportResponses(@Param('id') id: string) {
    return this.forms.exportResponsesStructured(id);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('definitions/:id/responses')
  listResponses(@Param('id') id: string) {
    return this.forms.listResponses(id);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('definitions/:id/close')
  closeForm(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.forms.closeForm(id, user.userId);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('definitions/:id/unpublish')
  unpublishForm(
    @Param('id') id: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.forms.unpublishForm(id, user.userId);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('definitions/:id/duplicate')
  duplicateDefinition(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ) {
    return this.forms.duplicateDefinition(user, id);
  }

  // --- Colaboradores ---

  @Get('published')
  listPublished() {
    return this.forms.listPublished();
  }

  @Public()
  @Get('share/:token')
  getByShareToken(@Param('token') tokenOrSlug: string) {
    return this.forms.getPublishedByShareToken(tokenOrSlug);
  }

  @Get('share/:token/me')
  getMySubmissionStatus(
    @Param('token') tokenOrSlug: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.forms.getMySubmissionStatus(tokenOrSlug, user);
  }

  @Post('share/:token/submit')
  submit(
    @Param('token') token: string,
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: SubmitFormResponseDto,
  ) {
    return this.forms.submitByShareToken(token, user, dto);
  }
}
