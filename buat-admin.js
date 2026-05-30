const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'absen_wajah'
});

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Kolom sesuai dengan struktur tabel: createdAt dan updatedAt
    const sql = `
      INSERT INTO users (id, nama, email, password, role, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    connection.query(sql, [
      'admin_001', 
      'Administrator', 
      'admin@absen.com', 
      hashedPassword, 
      'admin'
    ], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log('⚠️ Admin sudah ada di database!');
          console.log('📧 Email: admin@absen.com');
          console.log('🔑 Password: admin123');
          // Coba lihat data admin yang sudah ada
          connection.query('SELECT id, nama, email, role FROM users WHERE email = "admin@absen.com"', (err, rows) => {
            if (!err && rows.length > 0) {
              console.log('Data admin yang sudah ada:', rows[0]);
            }
            connection.end();
          });
        } else {
          console.error('❌ Error:', err.message);
          connection.end();
        }
      } else {
        console.log('✅ Admin berhasil dibuat!');
        console.log('📧 Email: admin@absen.com');
        console.log('🔑 Password: admin123');
        connection.end();
      }
    });
  } catch (error) {
    console.error('Error:', error);
    connection.end();
  }
}

createAdmin();