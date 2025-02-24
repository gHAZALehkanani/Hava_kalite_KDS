require('dotenv').config();
const express = require('express');
const path = require('path');
const connection = require('./db'); // db.js bağlantı dosyası
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use('/api', (req, res, next) => next()); 
app.use(express.static('public'));
app.use(express.json()); // JSON veri işleme için middleware

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/map', (req, res) => res.sendFile(path.join(__dirname, 'views/map.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));
app.get('/analysis', (req, res) => {res.sendFile(path.join(__dirname, 'views/analysis.html'));});
app.get('/PM10', (req, res) => {res.sendFile(path.join(__dirname, 'views/PM10.html'));});
app.get('/SO2', (req, res) => {res.sendFile(path.join(__dirname, 'views/SO2.html'));});
app.get('/NO2', (req, res) => {res.sendFile(path.join(__dirname, 'views/NO2.html'));});
app.get('/CO', (req, res) => {res.sendFile(path.join(__dirname, 'views/CO.html'));});

  
// API Routes
// Kullanıcı giriş doğrulama endpoint'i
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre gereklidir.' });
    }

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    connection.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Veritabanı hatası:', err);
            return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
        }

        if (results.length > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Geçersiz kullanıcı adı veya şifre.' });
        }
    });
});


// API Endpoint: İstasyonları getir
app.get('/api/stations', (req, res) => {
    const sql = 'SELECT id, name, address, latitude, longitude FROM stations';
    connection.query(sql, (err, results) => {
        if (err) {
            res.json({ success: false, message: 'Veri çekilemedi.', error: err });
        } else {
            res.json({ success: true, data: results });
        }
    });
});


// API: Kirletici Unsurlar (Aylık Ortalama)
app.get('/api/pollutants', (req, res) => {
    const year = req.query.year || new Date().getFullYear(); // Yıl sorgusu (varsayılan: mevcut yıl)
    const stationId = req.query.stationId; // İstasyon ID'si

    // stationId kontrolü
    if (!stationId) {
        return res.status(400).json({ message: 'stationId parametresi gereklidir.' });
    }

    // SQL Sorgusu: İlgili yıl ve istasyon için aylık ortalamaları hesaplar
    const query = `
        SELECT 
            MONTH(date) AS month,
            ROUND(AVG(co), 2) AS co,
            ROUND(AVG(no2), 2) AS no2,
            ROUND(AVG(pm10), 2) AS pm10,
            ROUND(AVG(so2), 2) AS so2
        FROM pollutants
        WHERE YEAR(date) = ? AND station_id = ?
        GROUP BY MONTH(date)
        ORDER BY MONTH(date);
    `;

    connection.query(query, [year, stationId], (err, results) => {
        if (err) {
            console.error('Veri sorgulama hatası:', err);
            res.status(500).send('Veri sorgulama hatası');
            return;
        }

        // Aylık indeksleri isimlendirmek için ay adları listesi
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const monthlyData = Array(12).fill(null).map((_, i) => ({
            month: monthNames[i],
            co: null,
            no2: null,
            pm10: null,
            so2: null,
        }));

        // Gelen sonuçları ay indeksine yerleştir
        results.forEach(row => {
            const monthIndex = row.month - 1; // Aylar 1-12 arası döner, dizi 0-indexlidir
            monthlyData[monthIndex] = {
                month: monthNames[monthIndex],
                co: row.co !== null ? row.co : null,
                no2: row.no2 !== null ? row.no2 : null,
                pm10: row.pm10 !== null ? row.pm10 : null,
                so2: row.so2 !== null ? row.so2 : null,
            };
        });

        res.json(monthlyData);
    });
});



// Hava Kalite İndeksi Hesaplama Fonksiyonu
function calculateAQI(co, no2, pm10, so2) {
    
    const thresholds = {
        co: { low: 0, high: 10000, I_low: 0, I_high: 50 },   // CO eşik değerleri (µg/m³)
        no2: { low: 0, high: 200, I_low: 0, I_high: 50 },    // NO2 eşik değerleri (µg/m³)
        pm10: { low: 0, high: 50, I_low: 0, I_high: 50 },    // PM10 eşik değerleri (µg/m³)
        so2: { low: 0, high: 300, I_low: 0, I_high: 50 },    // SO2 eşik değerleri (µg/m³)
    };
    
    // Kirletici AQI hesaplama formülü
    function aqiForPollutant(value, pollutant) {
        const { low, high, I_low, I_high } = thresholds[pollutant];
        
        if (value === null || value < low) return 0; // Eksik değer veya düşük ölçüm
        
        // Alt indeks hesaplama
        return ((value - low) / (high - low)) * (I_high - I_low) + I_low;
    }

    // Her kirletici için AQI hesapla
    const aqiValues = [
        aqiForPollutant(co, "co"),
        aqiForPollutant(no2, "no2"),
        aqiForPollutant(pm10, "pm10"),
        aqiForPollutant(so2, "so2"),
    ];

    return Math.round((Math.max(...aqiValues) * 0.5) * 10); // En yüksek AQI değeri nihai AQI'dir
}

// API: Hava Kalite İndeksi - İstasyon Bazlı
app.get('/api/air_quality_index', (req, res) => {
    const year = req.query.year || new Date().getFullYear(); // Yıl sorgusu (varsayılan: mevcut yıl)
    const stationId = req.query.stationId; // İstasyon ID'si

    // stationId kontrolü
    if (!stationId) {
        return res.status(400).json({ message: 'stationId parametresi gereklidir.' });
    }

    // SQL sorgusu: İlgili yıl ve istasyon için ortalama değerler
    const query = `
        SELECT 
            MONTH(date) AS month,
            AVG(co) AS avg_co, 
            AVG(no2) AS avg_no2, 
            AVG(pm10) AS avg_pm10, 
            AVG(so2) AS avg_so2
        FROM pollutants
        WHERE YEAR(date) = ? AND station_id = ?
        GROUP BY MONTH(date)
        ORDER BY MONTH(date);
    `;

    connection.query(query, [year, stationId], (err, results) => {
        if (err) {
            console.error('Hava kalite indeksi hesaplama hatası:', err);
            res.status(500).send('Hava kalite indeksi hesaplama hatası');
            return;
        }

        // Aylık AQI hesaplama
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const monthlyData = monthNames.map((name, index) => ({
            month: name,
            aqi: null
        }));

        // Gelen verilerden AQI hesaplama
        results.forEach(row => {
            const monthIndex = row.month - 1; // Ay indeksini ayarla
            const aqi = calculateAQI(row.avg_co, row.avg_no2, row.avg_pm10, row.avg_so2);

            monthlyData[monthIndex] = {
                month: monthNames[monthIndex],
                aqi: aqi
            };
        });

        res.json(monthlyData);
    });
});



// API: Yıl Listesi - İstasyon Bazlı
app.get('/api/years', (req, res) => {
    const stationId = req.query.stationId; // İstasyon ID'si

    // stationId kontrolü
    if (!stationId) {
        return res.status(400).json({ message: 'stationId parametresi gereklidir.' });
    }

    // SQL sorgusu: Belirli istasyon için DISTINCT yıl değerlerini getir
    const query = `
        SELECT DISTINCT YEAR(date) AS year
        FROM pollutants
        WHERE station_id = ?
        ORDER BY year;
    `;

    connection.query(query, [stationId], (err, results) => {
        if (err) {
            console.error('Yıl sorgulama hatası:', err);
            res.status(500).send('Yıl sorgulama hatası');
            return;
        }

        // Gelen verilerden yalnızca yıl değerlerini döndür
        res.json(results.map(row => row.year));
    });
});





// API Endpoint: Kirlilik Verilerini Getir
app.get('/pollution/:stationId/:year', (req, res) => {
    const stationId = req.params.stationId; // Parametre: İstasyon ID
    const year = req.params.year;           // Parametre: Yıl

    // İstasyon ID ve Yıl kontrolü
    if (!stationId || !year) {
        return res.status(400).json({ error: 'stationId ve year parametreleri gereklidir.' });
    }

    // SQL Sorgusu: Belirli istasyon ve yıla ait kirlilik verilerini getir
    const query = `SELECT * FROM pollution_sources WHERE station_id = ? AND YEAR(date) = ?`;

    connection.query(query, [stationId, year], (err, results) => {
        if (err) {
            console.error('Veritabanı sorgu hatası:', err);
            return res.status(500).json({ error: 'Veri çekme sırasında hata oluştu.' });
        }

        // Sonuçların kontrolü
        if (results.length > 0) {
            res.json(results[0]); // İlk sonucu JSON formatında döndür
        } else {
            res.status(404).json({ error: 'Belirtilen istasyon ve yıl için veri bulunamadı.' });
        }
    });
});

// API: Kirletici kaynağını getir - İstasyon ve Yıl Bazlı
app.get('/api/pollution-source', (req, res) => {
    const year = req.query.year;         // Sorgu parametresi: Yıl
    const pollutant = req.query.pollutant; // Sorgu parametresi: Kirletici türü (CO, NO2, PM10, SO2)
    const stationId = req.query.stationId; // Sorgu parametresi: İstasyon ID (zorunlu)

    // Parametre Kontrolleri
    if (!year || !pollutant || !stationId) {
        return res.status(400).json({ message: 'Yıl, kirletici ve stationId parametreleri gereklidir.' });
    }

    // Dinamik kolon seçimi için kirletici ismini kontrol et
    const allowedPollutants = ['co', 'no2', 'pm10', 'so2'];
    if (!allowedPollutants.includes(pollutant.toLowerCase())) {
        return res.status(400).json({ message: 'Geçersiz kirletici türü. Geçerli değerler: co, no2, pm10, so2' });
    }

    // Dinamik kolon ismi (kirletici türüne göre)
    const column = `${pollutant.toLowerCase()}_source`;

    // SQL Sorgusu: İstasyon ve yıla göre kirletici kaynaklarını getir
    const query = `
        SELECT DISTINCT ${column} AS source
        FROM pollution_sources
        WHERE station_id = ? AND YEAR(date) = ?;
    `;

    // Veritabanı sorgusu
    connection.query(query, [stationId, year], (err, results) => {
        if (err) {
            console.error('Veritabanı sorgulama hatası:', err);
            return res.status(500).json({ error: 'Veritabanı hatası oluştu.' });
        }

        // Sonuç kontrolü ve JSON döndürme
        if (results.length > 0) {
            res.json({ sources: results.map(row => row.source) });
        } else {
            res.json({ sources: [], message: 'Belirtilen istasyon ve yıl için kaynak bilgisi bulunamadı.' });
        }
    });
});


// API: Kirletici Unsurlar Veri - İstasyon Bazlı
app.get('/api/pollutants-data', (req, res) => {
    const year = req.query.year || new Date().getFullYear(); // Yıl parametresi (varsayılan mevcut yıl)
    const stationId = req.query.stationId; // İstasyon ID'si

    // Parametre kontrolü
    if (!stationId) {
        return res.status(400).json({ message: 'stationId parametresi gereklidir.' });
    }

    // SQL Sorgusu: Belirli yıl ve istasyon için kirletici unsurların aylık ortalamalarını getir
    const query = `
        SELECT 
            MONTH(date) AS month, 
            ROUND(AVG(co), 2) AS co, 
            ROUND(AVG(no2), 2) AS no2, 
            ROUND(AVG(pm10), 2) AS pm10, 
            ROUND(AVG(so2), 2) AS so2
        FROM pollutants
        WHERE YEAR(date) = ? AND station_id = ?
        GROUP BY MONTH(date)
        ORDER BY MONTH(date);
    `;

    // Veritabanı sorgusu
    connection.query(query, [year, stationId], (err, results) => {
        if (err) {
            console.error('Veri sorgulama hatası:', err);
            return res.status(500).send('Veri sorgulama hatası oluştu.');
        }

        // Verileri dizi haline getir
        const months = results.map(row => row.month);
        const co = results.map(row => parseFloat(row.co));
        const no2 = results.map(row => parseFloat(row.no2));
        const pm10 = results.map(row => parseFloat(row.pm10));
        const so2 = results.map(row => parseFloat(row.so2));

        // JSON formatında yanıt döndür
        res.json({ months, co, no2, pm10, so2 });
    });
});

// Sunucu başlatma
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

