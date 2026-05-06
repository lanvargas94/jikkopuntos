import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SECURITY_AUDIT_ACTION } from '../../common/security/security-audit.constants';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { roleDisplayName } from '../../common/constants/role-labels';
import { ORGANIZATIONAL_DEPARTMENT_LABEL } from '../../common/constants/organizational-department';
import { ROLE_CODES } from '../../common/constants/roles';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileSheetDto } from './dto/update-profile-sheet.dto';

const EDITABLE_KEYS = [
  'firstName',
  'lastName',
  'personalEmail',
  'phoneMobile',
  'phoneAlt',
  'address',
  'city',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyRelationship',
  'eps',
  'arl',
  'professionalSummary',
  'educationBackground',
  'previousWorkExperience',
  'skills',
  'linkedInUrl',
  'profilePhotoUrl',
] as const;

const READ_ONLY_KEYS = [
  'corporateEmail',
  'idNumber',
  'idIssueDate',
  'role',
  'jobTitle',
  'area',
  'organizationalDepartment',
  'employmentStatus',
] as const;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async ensureProfileRow(userId: string) {
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async getCollaboratorSheet(userId: string) {
    await this.ensureProfileRow(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, profile: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const p = user.profile!;

    return {
      currentRole: {
        code: user.role.code,
        displayName: roleDisplayName(user.role.code),
        highlighted: true,
      },
      corporate: {
        corporateEmail: user.email,
        idNumber: user.idNumber,
        idIssueDate: user.idIssueDate.toISOString(),
      },
      employment: {
        jobTitle: p.jobTitle,
        area: p.area,
        organizationalDepartment: p.organizationalDepartment,
        organizationalDepartmentLabel: p.organizationalDepartment
          ? ORGANIZATIONAL_DEPARTMENT_LABEL[p.organizationalDepartment] ??
            p.organizationalDepartment
          : null,
        employmentStatus: user.isActive ? 'ACTIVE' : 'INACTIVE',
      },
      personal: {
        firstName: user.firstName,
        lastName: user.lastName,
        personalEmail: p.personalEmail,
        phoneMobile: p.phoneMobile,
        phoneAlt: p.phoneAlt,
        address: p.address,
        city: p.city,
        emergencyContactName: p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
        emergencyRelationship: p.emergencyRelationship,
        eps: p.eps,
        arl: p.arl,
      },
      career: {
        professionalSummary: p.professionalSummary,
        educationBackground: p.educationBackground,
        previousWorkExperience: p.previousWorkExperience,
        skills: p.skills,
        linkedInUrl: p.linkedInUrl,
        profilePhotoUrl: p.profilePhotoUrl,
      },
      profileUpdatedAt: p.updatedAt.toISOString(),
      fieldPolicy: {
        readOnly: [...READ_ONLY_KEYS],
        editable: [...EDITABLE_KEYS],
      },
      _meta: {
        futureSections: [
          'attachments',
          'certifications',
          'internalJobHistory',
          'documents',
        ],
      },
    };
  }

  async updateSheet(actor: JwtUserPayload, dto: UpdateProfileSheetDto) {
    await this.ensureProfileRow(actor.userId);
    const user = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      include: { role: true, profile: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const p = user.profile!;

    /** Administradores solo actualizan datos personales y contacto en el portal. */
    if (user.role.code === ROLE_CODES.ADMIN) {
      dto.professionalSummary = undefined;
      dto.educationBackground = undefined;
      dto.previousWorkExperience = undefined;
      dto.skills = undefined;
      dto.linkedInUrl = undefined;
      dto.profilePhotoUrl = undefined;
    }

    const userPatch: { firstName?: string; lastName?: string } = {};
    const profilePatch: Record<string, string | null> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (dto.firstName !== undefined && dto.firstName !== user.firstName) {
      userPatch.firstName = dto.firstName;
      changes.firstName = { from: user.firstName, to: dto.firstName };
    }
    if (dto.lastName !== undefined && dto.lastName !== user.lastName) {
      userPatch.lastName = dto.lastName;
      changes.lastName = { from: user.lastName, to: dto.lastName };
    }

    const profileFields = [
      'personalEmail',
      'phoneMobile',
      'phoneAlt',
      'address',
      'city',
      'emergencyContactName',
      'emergencyContactPhone',
      'emergencyRelationship',
      'eps',
      'arl',
      'professionalSummary',
      'educationBackground',
      'previousWorkExperience',
      'skills',
      'linkedInUrl',
      'profilePhotoUrl',
    ] as const;

    if (
      dto.personalEmail !== undefined &&
      dto.personalEmail &&
      dto.personalEmail !== p.personalEmail
    ) {
      const taken = await this.prisma.userProfile.findFirst({
        where: {
          personalEmail: dto.personalEmail,
          NOT: { userId: actor.userId },
        },
      });
      if (taken) {
        throw new ConflictException(
          'Ese correo personal ya está registrado en otro perfil',
        );
      }
    }

    for (const key of profileFields) {
      if (dto[key] === undefined) {
        continue;
      }
      const before = p[key as keyof typeof p] as string | null;
      const after = dto[key] ?? null;
      if (before === after) {
        continue;
      }
      profilePatch[key] = after;
      changes[key] = { from: before, to: after };
    }

    const hasUser = Object.keys(userPatch).length > 0;
    const hasProfile = Object.keys(profilePatch).length > 0;
    const hasChanges = Object.keys(changes).length > 0;

    if (!hasUser && !hasProfile) {
      return this.getCollaboratorSheet(actor.userId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (hasUser) {
        await tx.user.update({
          where: { id: actor.userId },
          data: userPatch,
        });
      }
      if (hasProfile) {
        await tx.userProfile.update({
          where: { userId: actor.userId },
          data: profilePatch,
        });
      }
      if (hasChanges) {
        await tx.profileChangeLog.create({
          data: {
            userId: actor.userId,
            actorUserId: actor.userId,
            changes: JSON.stringify(changes),
          },
        });
      }
    });

    if (hasChanges) {
      await this.audit.logSecurityEvent({
        userId: actor.userId,
        actorUserId: actor.userId,
        action: SECURITY_AUDIT_ACTION.COLLABORATOR_PROFILE_SHEET_UPDATED,
        metadata: {
          fieldsChanged: Object.keys(changes),
          changeCount: Object.keys(changes).length,
        },
      });
    }

    return this.getCollaboratorSheet(actor.userId);
  }
}
