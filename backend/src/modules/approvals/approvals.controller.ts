import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLE_CODES } from '../../common/constants/roles';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { AdminApprovalsQueryDto } from './dto/admin-approvals-query.dto';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { CreateMedicalLeaveBodyDto } from './dto/create-medical-leave-body.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';
import {
  medicalLeaveAttachmentRelativePath,
  medicalLeaveMulterStorage,
} from './approvals-upload.util';
import { ApprovalsService } from './approvals.service';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get('me')
  listMine(@CurrentUser() user: JwtUserPayload) {
    return this.approvals.listMine(user.userId);
  }

  @Post('me/leave')
  createLeave(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: CreateLeaveDto,
  ) {
    return this.approvals.createLeaveRequest(user.userId, user.roleCode, body);
  }

  @Post('me/medical-leave')
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: medicalLeaveMulterStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const okMime =
          file.mimetype === 'application/pdf' ||
          file.mimetype === 'image/jpeg' ||
          file.mimetype === 'image/png';
        const okName = /\.(pdf|jpe?g|png)$/i.test(file.originalname);
        if (!okMime && !okName) {
          cb(new Error('Solo se permiten archivos PDF o imagen (JPG, PNG).'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  createMedicalLeave(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: CreateMedicalLeaveBodyDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const rel = medicalLeaveAttachmentRelativePath(file.filename);
    return this.approvals.createMedicalLeaveRequest(user.userId, user.roleCode, {
      startDate: body.startDate,
      endDate: body.endDate,
      clinicalSummary: body.clinicalSummary,
      justification: body.justification,
      attachmentRelativePath: rel,
    });
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin')
  listAdmin(@Query() query: AdminApprovalsQueryDto) {
    return this.approvals.listAdmin(query.status, query.category);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('admin/:id/approve')
  approve(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ) {
    return this.approvals.approveRequest(id, user.userId);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('admin/:id/reject')
  reject(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() body: ReviewApprovalDto,
  ) {
    return this.approvals.rejectRequest(id, user.userId, body.reviewNote);
  }
}
