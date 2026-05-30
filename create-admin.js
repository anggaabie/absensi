const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        nama: 'Administrator',
        email: 'admin@absen.com',
        password: hashedPassword,
        role: 'admin'
      }
    });
    
    console.log('✅ Admin berhasil dibuat!');
    console.log('📧 Email: admin@absen.com');
    console.log('🔑 Password: admin123');
    console.log('🆔 ID:', admin.id);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('⚠️ Admin sudah ada di database!');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
  
  await prisma.$disconnect();
}

main();