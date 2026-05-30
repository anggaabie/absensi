const mysql = require('mysql2');

const conn = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'absen_wajah'
});

conn.query('SHOW TABLES', (err, res) => {
  if (err) console.error(err);
  else console.table(res);
  conn.end();
});