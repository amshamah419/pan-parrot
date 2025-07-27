import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// In-memory password store (in production, use proper password hashing)
export const userCredentials: Record<string, string> = {};

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'ashamah@paloaltonetworks.com' },
    update: {},
    create: {
      email: 'ashamah@paloaltonetworks.com',
      name: 'Andrew Shamah',
      role: Role.ADMIN,
      active: true,
    },
  });

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@paloaltonetworks.com' },
    update: {},
    create: {
      email: 'test@paloaltonetworks.com',
      name: 'Test User',
      role: Role.USER,
      active: true,
    },
  });

  // Set up credentials
  userCredentials['ashamah@paloaltonetworks.com'] = 'admin2024!';
  userCredentials['test@paloaltonetworks.com'] = 'test123';

  console.log('✅ Database seeded successfully');
  console.log(`👤 Admin user: ${adminUser.email} (ID: ${adminUser.id})`);
  console.log(`👤 Test user: ${testUser.email} (ID: ${testUser.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
