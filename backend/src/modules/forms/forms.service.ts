import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import {
  JIKKO_FORM_REWARD_POLICY,
  evaluateFormRewardAmount,
} from '../../common/constants/jikkopoint-reward-policy';
import { FORM_STATUS } from '../../common/constants/form-status';
import { SECURITY_AUDIT_ACTION } from '../../common/security/security-audit.constants';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JikkoPointsService } from '../jikkopoints/jikkopoints.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFormDefinitionDto } from './dto/create-form-definition.dto';
import { ListFormsQueryDto } from './dto/list-forms-query.dto';
import { ReplaceFormQuestionsDto } from './dto/replace-form-questions.dto';
import { SubmitFormResponseDto } from './dto/submit-form-response.dto';
import { UpdateFormDefinitionDto } from './dto/update-form-definition.dto';
import {
  assertQuestionsStructurallyValid,
  type QuestionWithOptions,
  validateAnswersAgainstQuestions,
} from './form-questions.validator';
import { parseFormSchemaJson, validateAnswersAgainstSchema } from './form-schema.validator';

function pickStableId(proposed: string | undefined, gen: () => string): string {
  const p = proposed?.trim();
  if (p && /^[a-z0-9_-]{8,64}$/i.test(p)) {
    return p;
  }
  return gen();
}

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jikkopoints: JikkoPointsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private includeQuestions() {
    return {
      questions: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          options: { orderBy: { sortOrder: 'asc' as const } },
        },
      },
    };
  }

  private mapDbQuestionsToPayload(
    questions: Array<{
      id: string;
      type: string;
      label: string;
      helpText: string | null;
      required: boolean;
      options: Array<{ id: string; label: string; value: string }>;
    }>,
  ): QuestionWithOptions[] {
    return questions.map((q) => ({
      id: q.id,
      type: q.type,
      label: q.label,
      helpText: q.helpText,
      required: q.required,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        value: o.value,
      })),
    }));
  }

  /** Resuelve formulario por token o slug (puede estar PUBLICADO o CERRADO). */
  private async findByPublicLookupKey(raw: string) {
    const key = raw.trim();
    if (!key) {
      return null;
    }
    const lower = key.toLowerCase();
    return this.prisma.formDefinition.findFirst({
      where: {
        OR: [{ shareToken: key }, { publicSlug: lower }],
      },
      include: this.includeQuestions(),
    });
  }

  /** Formulario público que aún acepta respuestas. */
  private async findPublishedAcceptingResponses(raw: string) {
    const form = await this.findByPublicLookupKey(raw);
    if (!form) {
      throw new NotFoundException('Formulario no disponible o enlace inválido');
    }
    if (form.status === FORM_STATUS.DRAFT) {
      throw new NotFoundException('Formulario no disponible o enlace inválido');
    }
    if (form.status === FORM_STATUS.CLOSED) {
      throw new GoneException(
        'Este formulario está cerrado y ya no acepta respuestas.',
      );
    }
    return form;
  }

  private assertPublishable(form: {
    questions: QuestionWithOptions[];
    schemaJson: string | null;
  }) {
    if (form.questions.length > 0) {
      assertQuestionsStructurallyValid(form.questions);
      return;
    }
    if (form.schemaJson) {
      parseFormSchemaJson(form.schemaJson);
      return;
    }
    throw new BadRequestException(
      'No se puede publicar: agrega al menos una pregunta o completa el formulario',
    );
  }

  async createDefinition(actor: JwtUserPayload, dto: CreateFormDefinitionDto) {
    const points = dto.pointsReward ?? 0;
    const created = await this.prisma.formDefinition.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        status: FORM_STATUS.DRAFT,
        pointsReward: points,
        schemaJson: null,
        createdById: actor.userId,
      },
    });
    await this.audit.logSecurityEvent({
      userId: actor.userId,
      actorUserId: actor.userId,
      action: SECURITY_AUDIT_ACTION.FORM_DEFINITION_CREATED,
      metadata: { formId: created.id, title: created.title },
    });
    return created;
  }

  async replaceQuestions(id: string, dto: ReplaceFormQuestionsDto) {
    const existing = await this.prisma.formDefinition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Formulario no encontrado');
    }
    if (existing.status !== FORM_STATUS.DRAFT) {
      throw new BadRequestException(
        'Solo se puede editar la estructura en borrador',
      );
    }

    const mappedForAssert: QuestionWithOptions[] = dto.questions.map((q, qi) => {
      const qid = pickStableId(q.id, () => randomUUID());
      if (q.type === 'TEXT_OPEN') {
        return {
          id: qid,
          type: q.type,
          label: q.label.trim(),
          helpText: q.helpText?.trim() ?? null,
          required: q.required,
          options: [],
        };
      }
      const opts = q.options ?? [];
      return {
        id: qid,
        type: q.type,
        label: q.label.trim(),
        helpText: q.helpText?.trim() ?? null,
        required: q.required,
        options: opts.map((o, oi) => {
          const oid = pickStableId(o.id, () => randomUUID());
          const value = (o.value?.trim() || oid) as string;
          return {
            id: oid,
            label: o.label.trim(),
            value,
          };
        }),
      };
    });

    if (mappedForAssert.length > 0) {
      assertQuestionsStructurallyValid(mappedForAssert);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.formQuestion.deleteMany({ where: { formId: id } });
      for (let i = 0; i < dto.questions.length; i++) {
        const q = dto.questions[i]!;
        const qid = mappedForAssert[i]!.id;
        const sortOrder = q.sortOrder ?? i;
        if (q.type === 'TEXT_OPEN') {
          await tx.formQuestion.create({
            data: {
              id: qid,
              formId: id,
              sortOrder,
              type: q.type,
              label: q.label.trim(),
              helpText: q.helpText?.trim() ?? null,
              required: q.required,
            },
          });
          continue;
        }
        const opts = q.options ?? [];
        await tx.formQuestion.create({
          data: {
            id: qid,
            formId: id,
            sortOrder,
            type: q.type,
            label: q.label.trim(),
            helpText: q.helpText?.trim() ?? null,
            required: q.required,
            options: {
              create: opts.map((o, j) => {
                const oid = mappedForAssert[i]!.options[j]!.id;
                const value = mappedForAssert[i]!.options[j]!.value;
                return {
                  id: oid,
                  sortOrder: o.sortOrder ?? j,
                  label: o.label.trim(),
                  value,
                };
              }),
            },
          },
        });
      }
      await tx.formDefinition.update({
        where: { id },
        data: { schemaJson: null },
      });
    });

    return this.getDefinitionForAdmin(id);
  }

  async listDefinitionsForAdmin(query?: ListFormsQueryDto) {
    const raw = query?.status ?? 'ALL';
    const where =
      raw !== 'ALL' &&
      (raw === FORM_STATUS.DRAFT ||
        raw === FORM_STATUS.PUBLISHED ||
        raw === FORM_STATUS.CLOSED)
        ? { status: raw }
        : {};
    return this.prisma.formDefinition.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: { select: { responses: true, questions: true } },
      },
    });
  }

  async getDefinitionForAdmin(id: string) {
    const form = await this.prisma.formDefinition.findUnique({
      where: { id },
      include: {
        ...this.includeQuestions(),
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        _count: { select: { responses: true, questions: true } },
      },
    });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    return form;
  }

  /** Misma forma que el enlace público, útil para vista previa en admin. */
  async previewDefinitionForAdmin(id: string) {
    const form = await this.prisma.formDefinition.findUnique({
      where: { id },
      include: this.includeQuestions(),
    });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    if (form.questions.length > 0) {
      const questions = this.mapDbQuestionsToPayload(form.questions);
      return {
        id: form.id,
        title: form.title,
        description: form.description,
        pointsReward: form.pointsReward,
        status: form.status,
        questions,
        schema: null as null,
      };
    }
    if (form.schemaJson) {
      const schema = parseFormSchemaJson(form.schemaJson);
      return {
        id: form.id,
        title: form.title,
        description: form.description,
        pointsReward: form.pointsReward,
        status: form.status,
        questions: null as null,
        schema,
      };
    }
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      pointsReward: form.pointsReward,
      status: form.status,
      questions: [] as QuestionWithOptions[],
      schema: null as null,
    };
  }

  async updateDefinition(id: string, dto: UpdateFormDefinitionDto) {
    const existing = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Formulario no encontrado');
    }
    if (existing.status !== FORM_STATUS.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden editar formularios en borrador',
      );
    }
    const data: {
      title?: string;
      description?: string | null;
      pointsReward?: number;
      publicSlug?: string | null;
      allowMultipleResponses?: boolean;
    } = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }
    if (dto.pointsReward !== undefined) {
      data.pointsReward = dto.pointsReward;
    }
    if (dto.publicSlug !== undefined) {
      const normalized =
        dto.publicSlug === null || dto.publicSlug === ''
          ? null
          : dto.publicSlug.trim().toLowerCase();
      if (normalized) {
        const taken = await this.prisma.formDefinition.findFirst({
          where: { publicSlug: normalized, NOT: { id } },
        });
        if (taken) {
          throw new ConflictException('Ya existe un formulario con ese slug público');
        }
      }
      data.publicSlug = normalized;
    }
    if (dto.allowMultipleResponses !== undefined) {
      data.allowMultipleResponses = dto.allowMultipleResponses;
    }
    if (Object.keys(data).length === 0) {
      return existing;
    }
    return this.prisma.formDefinition.update({ where: { id }, data });
  }

  async publish(id: string, actorUserId: string) {
    const form = await this.prisma.formDefinition.findUnique({
      where: { id },
      include: this.includeQuestions(),
    });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    const payloadQuestions = this.mapDbQuestionsToPayload(form.questions);
    this.assertPublishable({
      questions: payloadQuestions,
      schemaJson: form.schemaJson,
    });

    if (form.status === FORM_STATUS.PUBLISHED && form.shareToken) {
      if (!form.publishedAt) {
        await this.prisma.formDefinition.update({
          where: { id },
          data: { publishedAt: new Date() },
        });
      }
      const pathKey = form.publicSlug ?? form.shareToken;
      return {
        shareToken: form.shareToken,
        publicSlug: form.publicSlug,
        relativePath: `/forms/${pathKey}`,
      };
    }
    if (form.status !== FORM_STATUS.DRAFT) {
      throw new BadRequestException('Estado de formulario no válido para publicar');
    }
    const shareToken = randomBytes(18).toString('hex');
    const now = new Date();
    const updated = await this.prisma.formDefinition.update({
      where: { id },
      data: {
        status: FORM_STATUS.PUBLISHED,
        shareToken,
        publishedAt: now,
        closedAt: null,
      },
    });
    await this.audit.logSecurityEvent({
      userId: actorUserId,
      actorUserId,
      action: SECURITY_AUDIT_ACTION.FORM_PUBLISHED,
      metadata: {
        formId: id,
        title: form.title,
        publicSlug: form.publicSlug,
      },
    });
    const pathKey = form.publicSlug ?? updated.shareToken!;
    const relativePath = `/forms/${pathKey}`;
    void this.notifications
      .onFormPublished({
        formId: id,
        formTitle: form.title,
        relativePath,
      })
      .catch(() => undefined);
    return {
      shareToken: updated.shareToken!,
      publicSlug: form.publicSlug,
      relativePath,
    };
  }

  async listPublished() {
    return this.prisma.formDefinition.findMany({
      where: { status: FORM_STATUS.PUBLISHED },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        pointsReward: true,
        shareToken: true,
        publicSlug: true,
        updatedAt: true,
      },
    });
  }

  async getPublishedByShareToken(tokenOrSlug: string) {
    const form = await this.findByPublicLookupKey(tokenOrSlug);
    if (!form) {
      throw new NotFoundException('Formulario no disponible o enlace inválido');
    }
    if (form.status === FORM_STATUS.DRAFT) {
      throw new NotFoundException('Formulario no disponible o enlace inválido');
    }
    if (form.status === FORM_STATUS.CLOSED) {
      throw new GoneException(
        'Este formulario está cerrado y ya no acepta respuestas.',
      );
    }
    const meta = {
      id: form.id,
      title: form.title,
      description: form.description,
      pointsReward: form.pointsReward,
      allowMultipleResponses: form.allowMultipleResponses,
      updatedAt: form.updatedAt.toISOString(),
    };
    if (form.questions.length > 0) {
      const questions = this.mapDbQuestionsToPayload(form.questions);
      return {
        ...meta,
        questions,
        schema: null as null,
      };
    }
    if (!form.schemaJson) {
      throw new NotFoundException('Formulario incompleto');
    }
    const schema = parseFormSchemaJson(form.schemaJson);
    return {
      ...meta,
      questions: null as null,
      schema,
    };
  }

  async getMySubmissionStatus(lookupKey: string, user: JwtUserPayload) {
    const form = await this.findByPublicLookupKey(lookupKey);
    if (!form) {
      throw new NotFoundException('Formulario no disponible o enlace inválido');
    }
    if (form.status === FORM_STATUS.DRAFT) {
      throw new NotFoundException('Formulario no disponible o enlace inválido');
    }
    const count = await this.prisma.formResponse.count({
      where: { formId: form.id, userId: user.userId },
    });
    const open = form.status === FORM_STATUS.PUBLISHED;
    return {
      hasSubmitted: count > 0,
      submissionCount: count,
      allowMultipleResponses: form.allowMultipleResponses,
      canSubmit:
        open && (form.allowMultipleResponses || count === 0),
      formClosed: !open,
    };
  }

  async listResponses(formId: string) {
    const form = await this.prisma.formDefinition.findUnique({ where: { id: formId } });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    return this.prisma.formResponse.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async submitByShareToken(
    lookupKey: string,
    user: JwtUserPayload,
    dto: SubmitFormResponseDto,
  ) {
    const form = await this.findPublishedAcceptingResponses(lookupKey);

    if (form.questions.length > 0) {
      const qPayload = this.mapDbQuestionsToPayload(form.questions);
      validateAnswersAgainstQuestions(qPayload, dto.answers);
    } else if (form.schemaJson) {
      const schema = parseFormSchemaJson(form.schemaJson);
      validateAnswersAgainstSchema(schema, dto.answers);
    } else {
      throw new BadRequestException('Formulario sin definición de preguntas');
    }

    if (!form.allowMultipleResponses) {
      const existing = await this.prisma.formResponse.findFirst({
        where: { formId: form.id, userId: user.userId },
      });
      if (existing) {
        throw new ConflictException('Ya enviaste una respuesta para este formulario');
      }
    }

    const answersJson = JSON.stringify(dto.answers);
    const pointsConfigured = form.pointsReward;
    const formTitle = form.title;

    const result = await this.prisma.$transaction(async (tx) => {
      const priorCount = await tx.formResponse.count({
        where: { formId: form.id, userId: user.userId },
      });

      const grantPoints = evaluateFormRewardAmount(
        JIKKO_FORM_REWARD_POLICY.FIRST_SUBMISSION_ONLY,
        pointsConfigured,
        priorCount,
      );

      const response = await tx.formResponse.create({
        data: {
          formId: form.id,
          userId: user.userId,
          answersJson,
        },
      });

      await this.audit.logSecurityEventTx(tx, {
        userId: user.userId,
        actorUserId: user.userId,
        action: SECURITY_AUDIT_ACTION.FORM_RESPONSE_SUBMITTED,
        metadata: {
          formId: form.id,
          formResponseId: response.id,
          formTitle: form.title,
          jikkopuntosGranted: grantPoints,
        },
      });

      if (grantPoints > 0) {
        await this.jikkopoints.applyFormRewardInTransaction(tx, {
          userId: user.userId,
          formId: form.id,
          points: grantPoints,
          formTitle: form.title,
          formResponseId: response.id,
        });
        await this.audit.logSecurityEventTx(tx, {
          userId: user.userId,
          actorUserId: user.userId,
          action: SECURITY_AUDIT_ACTION.JIKKOPOINTS_FORM_REWARD_CREDITED,
          metadata: {
            formId: form.id,
            formResponseId: response.id,
            amount: grantPoints,
            formTitle: form.title,
            rewardPolicy: JIKKO_FORM_REWARD_POLICY.FIRST_SUBMISSION_ONLY,
          },
        });
      }

      return { responseId: response.id, jikkopuntosGranted: grantPoints };
    });

    if (result.jikkopuntosGranted > 0) {
      const min = parseInt(process.env.JP_BALANCE_NOTIFY_MIN ?? '100', 10);
      const beneficiary = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { email: true },
      });
      if (beneficiary) {
        void this.notifications
          .onJpCredit({
            userId: user.userId,
            email: beneficiary.email,
            amount: result.jikkopuntosGranted,
            reasonLine: `Recompensa por formulario «${formTitle}».`,
            minAmount: Number.isFinite(min) ? min : 100,
          })
          .catch(() => undefined);
      }
    }

    return result;
  }

  async closeForm(id: string, actorUserId: string) {
    const form = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    if (form.status !== FORM_STATUS.PUBLISHED) {
      throw new BadRequestException(
        'Solo se pueden cerrar formularios en estado publicado',
      );
    }
    const updated = await this.prisma.formDefinition.update({
      where: { id },
      data: {
        status: FORM_STATUS.CLOSED,
        closedAt: new Date(),
      },
    });
    await this.audit.logSecurityEvent({
      userId: actorUserId,
      actorUserId,
      action: SECURITY_AUDIT_ACTION.FORM_CLOSED,
      metadata: { formId: id, title: form.title },
    });
    return updated;
  }

  async unpublishForm(id: string, actorUserId: string) {
    const form = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }
    if (
      form.status !== FORM_STATUS.PUBLISHED &&
      form.status !== FORM_STATUS.CLOSED
    ) {
      throw new BadRequestException(
        'Solo se puede despublicar un formulario publicado o cerrado',
      );
    }
    const prev = form.status;
    const updated = await this.prisma.formDefinition.update({
      where: { id },
      data: {
        status: FORM_STATUS.DRAFT,
        shareToken: null,
        publicSlug: null,
        closedAt: null,
      },
    });
    await this.audit.logSecurityEvent({
      userId: actorUserId,
      actorUserId,
      action: SECURITY_AUDIT_ACTION.FORM_UNPUBLISHED,
      metadata: { formId: id, title: form.title, previousStatus: prev },
    });
    return updated;
  }

  async duplicateDefinition(actor: JwtUserPayload, id: string) {
    const source = await this.prisma.formDefinition.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!source) {
      throw new NotFoundException('Formulario no encontrado');
    }

    const title = `${source.title.trim()} (copia)`;
    const useQuestions = source.questions.length > 0;

    const created = await this.prisma.$transaction(async (tx) => {
      const copy = await tx.formDefinition.create({
        data: {
          title,
          description: source.description,
          status: FORM_STATUS.DRAFT,
          pointsReward: source.pointsReward,
          allowMultipleResponses: source.allowMultipleResponses,
          schemaJson: useQuestions ? null : source.schemaJson,
          createdById: actor.userId,
        },
      });

      for (const q of source.questions) {
        await tx.formQuestion.create({
          data: {
            formId: copy.id,
            sortOrder: q.sortOrder,
            type: q.type,
            label: q.label,
            helpText: q.helpText,
            required: q.required,
            settingsJson: q.settingsJson,
            options:
              q.options.length > 0
                ? {
                    create: q.options.map((o) => ({
                      sortOrder: o.sortOrder,
                      label: o.label,
                      value: o.value,
                    })),
                  }
                : undefined,
          },
        });
      }

      return copy;
    });

    await this.audit.logSecurityEvent({
      userId: actor.userId,
      actorUserId: actor.userId,
      action: SECURITY_AUDIT_ACTION.FORM_DUPLICATED,
      metadata: {
        sourceFormId: id,
        newFormId: created.id,
        newTitle: title,
      },
    });

    return this.getDefinitionForAdmin(created.id);
  }

  private buildExportColumns(form: {
    questions: Array<{
      id: string;
      type: string;
      label: string;
      helpText: string | null;
      required: boolean;
      options: Array<{ id: string; label: string; value: string }>;
    }>;
    schemaJson: string | null;
  }):
    | Array<{
        id: string;
        label: string;
        type: string;
        options?: Array<{ value: string; label: string }>;
      }>
    | Array<{ id: string; label: string; type: string }> {
    if (form.questions.length > 0) {
      const q = this.mapDbQuestionsToPayload(form.questions);
      return q.map((x) => ({
        id: x.id,
        label: x.label,
        type: x.type,
        options: x.options.map((o) => ({ value: o.value, label: o.label })),
      }));
    }
    if (form.schemaJson) {
      const schema = parseFormSchemaJson(form.schemaJson);
      return schema.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
      }));
    }
    return [];
  }

  /** Base estable para CSV/Excel y dashboards (sin archivo binario aún). */
  async exportResponsesStructured(formId: string) {
    const form = await this.getDefinitionForAdmin(formId);
    const responses = await this.prisma.formResponse.findMany({
      where: { formId },
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    const columns = this.buildExportColumns(form);
    const rows = responses.map((r) => {
      let answers: Record<string, unknown>;
      try {
        answers = JSON.parse(r.answersJson) as Record<string, unknown>;
      } catch {
        answers = { _raw: r.answersJson };
      }
      return {
        responseId: r.id,
        submittedAt: r.submittedAt.toISOString(),
        user: {
          id: r.user.id,
          email: r.user.email,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
        },
        answers,
      };
    });
    return {
      exportVersion: 1,
      format: 'jikko.formResponses' as const,
      exportedAt: new Date().toISOString(),
      form: {
        id: form.id,
        title: form.title,
        status: form.status,
        publishedAt: form.publishedAt?.toISOString() ?? null,
        closedAt: form.closedAt?.toISOString() ?? null,
      },
      columns,
      rows,
    };
  }
}
