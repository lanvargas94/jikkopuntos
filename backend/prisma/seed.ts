import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BENEFIT_REWARD_TIERS } from '../src/common/constants/benefit-reward-tiers';

const prisma = new PrismaClient();

async function main() {
  await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: { code: 'ADMIN' },
  });
  await prisma.role.upsert({
    where: { code: 'COLLABORATOR' },
    update: {},
    create: { code: 'COLLABORATOR' },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'ADMIN' },
  });

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@jikkosoft.local' },
    // Vuelve a fijar el hash si ya existía el usuario (útil tras volúmenes Docker vacíos o pruebas).
    update: { passwordHash },
    create: {
      email: 'admin@jikkosoft.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Jikko',
      idNumber: 'ADM-0001',
      idIssueDate: new Date('2020-01-01T00:00:00.000Z'),
      mustChangePassword: false,
      isActive: true,
      roleId: adminRole.id,
      jikkoAccount: { create: { balance: 0 } },
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  const tierCount = await prisma.benefitRewardTier.count();
  if (tierCount === 0) {
    let order = 0;
    for (const t of BENEFIT_REWARD_TIERS) {
      await prisma.benefitRewardTier.create({
        data: {
          label: t.label,
          jp: t.jp,
          sortOrder: order++,
          isPublished: true,
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
