import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  StreamableFile,
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
import { AdminRedeemRestDto } from './dto/admin-redeem-rest.dto';
import { CreateBenefitTierDto } from './dto/create-benefit-tier.dto';
import { CollaboratorByIdNumberQueryDto } from './dto/collaborator-by-id-number-query.dto';
import { CollaboratorMovementsQueryDto } from './dto/collaborator-movements-query.dto';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { RedeemBenefitDto } from './dto/redeem-benefit.dto';
import { UpdateBenefitTierDto } from './dto/update-benefit-tier.dto';
import {
  benefitAttachmentRelativePath,
  benefitRedeemMulterStorage,
  redeemAttachmentRelativePath,
  redeemRestMulterStorage,
} from './jikkopoints-upload.util';
import { JikkoPointsService } from './jikkopoints.service';

@Controller('jikkopoints')
export class JikkoPointsController {
  constructor(private readonly jikkopoints: JikkoPointsService) {}

  /** Saldo derivado del ledger (+ estado del cache). */
  @Get('me/balance')
  getMyBalance(@CurrentUser() user: JwtUserPayload) {
    return this.jikkopoints.getBalanceForUser(user.userId);
  }

  /** Historial paginado (append-only). */
  @Get('me/movements')
  getMyMovements(
    @CurrentUser() user: JwtUserPayload,
    @Query() query: MovementsQueryDto,
  ) {
    return this.jikkopoints.getMovementsForUser(user.userId, {
      offset: query.offset,
      limit: query.limit,
    });
  }

  /** Atajo: saldo + primer página de movimientos. */
  @Get('me')
  getMine(@CurrentUser() user: JwtUserPayload) {
    return this.jikkopoints.getMySummary(user.userId);
  }

  /** Catálogo de recompensas por JP y umbral mínimo para habilitar canjes. */
  @Get('me/benefit-rewards')
  getBenefitRewards() {
    return this.jikkopoints.getBenefitRewardTiers();
  }

  /** Admin: catálogo completo de beneficios (borradores y publicados). */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/benefit-tiers')
  getAdminBenefitTiers() {
    return this.jikkopoints.listBenefitTiersForAdmin();
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Post('admin/benefit-tiers')
  postAdminBenefitTier(@Body() body: CreateBenefitTierDto) {
    return this.jikkopoints.createBenefitTier({
      label: body.label,
      jp: body.jp,
      isPublished: body.isPublished ?? true,
    });
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('admin/benefit-tiers/:id')
  patchAdminBenefitTier(
    @Param('id') id: string,
    @Body() body: UpdateBenefitTierDto,
  ) {
    return this.jikkopoints.updateBenefitTier(id, body);
  }

  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Delete('admin/benefit-tiers/:id')
  async deleteAdminBenefitTier(@Param('id') id: string) {
    await this.jikkopoints.deleteBenefitTier(id);
    return { ok: true };
  }

  /** Colaborador: canje de beneficio (PDF autorización jefe obligatorio). */
  @Post('me/redeem-benefit')
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: benefitRedeemMulterStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
        if (!ok) {
          cb(new Error('Solo se permiten archivos PDF.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  postRedeemBenefit(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: RedeemBenefitDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const rel = benefitAttachmentRelativePath(file.filename);
    return this.jikkopoints.redeemCollaboratorBenefit({
      userId: user.userId,
      roleCode: user.roleCode,
      tierId: body.tierId,
      justification: body.justification,
      attachmentRelativePath: rel,
    });
  }

  /** Admin: top colaboradores por saldo neto (JP). */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/leaderboard')
  getAdminLeaderboard(@Query('limit') limitStr?: string) {
    const n = limitStr ? parseInt(limitStr, 10) : 10;
    const limit = Number.isFinite(n) ? n : 10;
    return this.jikkopoints.getAdminLeaderboard(limit);
  }

  /** Admin: descarga Excel con todos los colaboradores y saldo neto a la fecha. */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/report.xlsx')
  async getAdminReportXlsx(): Promise<StreamableFile> {
    const buffer = await this.jikkopoints.buildAdminExcelReport();
    const day = new Date().toISOString().slice(0, 10);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="jikkopuntos-colaboradores-${day}.xlsx"`,
    });
  }

  /** Admin: opciones de canje por descanso (coste en JP). */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/redeem-rest-options')
  getAdminRedeemRestOptions() {
    return this.jikkopoints.getAdminRedeemRestOptions();
  }

  /** Admin: buscar colaborador por número de documento (rol colaborador). */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/collaborator-by-id-number')
  getAdminCollaboratorByIdNumber(@Query() query: CollaboratorByIdNumberQueryDto) {
    return this.jikkopoints.findCollaboratorByIdNumberForAdmin(query.idNumber);
  }

  /** Admin: historial paginado de movimientos de un colaborador (por número de documento). */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @Get('admin/collaborator-movements')
  getAdminCollaboratorMovements(@Query() query: CollaboratorMovementsQueryDto) {
    return this.jikkopoints.getCollaboratorMovementsForAdmin(query.idNumber, {
      offset: query.offset ?? 0,
      limit: query.limit ?? 25,
    });
  }

  /** Admin: registrar canje de descanso (solicitud pendiente; justificación y archivo obligatorios). */
  @Roles(ROLE_CODES.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FileInterceptor('attachment', {
      storage: redeemRestMulterStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
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
  @Post('admin/redeem-rest')
  async postAdminRedeemRest(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: AdminRedeemRestDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const rel = redeemAttachmentRelativePath(file.filename);
    return this.jikkopoints.adminRedeemRest({
      adminUserId: user.userId,
      targetUserId: body.targetUserId,
      kind: body.kind,
      justification: body.justification,
      attachmentRelativePath: rel,
    });
  }
}
