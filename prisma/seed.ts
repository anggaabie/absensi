import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@absen.com' }
  });
  
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.create({
      data: {
        nama: 'Administrator',
        email: 'admin@absen.com',
        password: hashedPassword,
        role: 'admin'
      }
    });
    
    console.log('✅ Admin user created:');
    console.log('   Email: admin@absen.com');
    console.log('   Password: admin123');
  } else {
    console.log('⚠️ Admin already exists, skipping...');
  }
  
  console.log('🎉 Seeding finished!');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });