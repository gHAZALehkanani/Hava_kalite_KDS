const mysql = require('mysql2');

// Veritabanı bağlantısını oluştur
const connection = mysql.createConnection({
    host: 'localhost',      // MySQL sunucusu
    user: 'root',           // Veritabanı kullanıcı adı
    password: '', // Veritabanı şifresi
    database: 'kds' // Veritabanı adı
});

// Bağlantıyı test et
connection.connect((err) => {
    if (err) {
        console.error('Veritabanına bağlanılamadı:', err.message);
        return;
    }
    console.log('Veritabanına başarıyla bağlandı.');
});

module.exports = connection;



