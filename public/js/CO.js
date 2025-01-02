document.addEventListener("DOMContentLoaded", async () => {
    const year = 2024;
    const pollutant = 'co';

    // URL'den stationId parametresini al
    const urlParams = new URLSearchParams(window.location.search);
    const selectedStationId = urlParams.get('stationId');

    if (!selectedStationId) {
        console.error("Station ID belirtilmedi!");
        alert("Station ID belirtilmedi! Lütfen doğru URL ile sayfaya erişin.");
        return;
    }

    async function fetchStationName() {
        try {
            const response = await fetch('/api/stations');
            const data = await response.json();
    
            if (data.success && data.data.length > 0) {
                const stationName = data.data.find(station => station.id === parseInt(selectedStationId))?.name || "Bilinmeyen İstasyon";
                document.getElementById('station-name').innerText = ` ${stationName}`;
            } else {
                document.getElementById('station-name').innerText = 'İstasyon bilgisi bulunamadı.';
            }
        } catch (error) {
            document.getElementById('station-name').innerText = 'İstasyon adı alınırken hata oluştu.';
            console.error('API Error:', error);
        }
    }

    const stationNameDiv = document.createElement("div");
    stationNameDiv.id = "station-name";
    stationNameDiv.textContent = "İstasyon Adı Yükleniyor...";
    document.body.insertBefore(stationNameDiv, document.body.firstChild);

    fetchStationName();

    // Hareketi başlat
    setTimeout(() => {
        stationNameDiv.classList.add("visible");
    }, 500); // 0.5 saniye gecikme

    const stationId = parseInt(selectedStationId, 10);

    const canvas = document.getElementById('coChart');
    if (!canvas) {
        console.error("Canvas öğesi bulunamadı!");
        return;
    }

    const ctx = canvas.getContext('2d');
    const targetInput = document.getElementById('targetInput'); // Yüzdelik değer girilecek
    const updateButton = document.getElementById('updateTarget');

    // Ay isimlerini tanımla
    const monthLabels = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    const fetchData = async () => {
        try {
            const response = await fetch(`/api/pollutants-data?year=${year}&stationId=${stationId}`);
            const pollutantData = await response.json();

            if (!pollutantData.co || pollutantData.co.every(value => value === null)) {
                console.error("CO verisi eksik veya bulunamadı!");
                alert("Seçilen istasyona ait CO verisi bulunamadı!");
                return { pollutantData: {}, source: ["Veri bulunamadı"] };
            }

            const responseSource = await fetch(`/api/pollution-source?year=${year}&pollutant=${pollutant}&stationId=${stationId}`);
            const sourceData = await responseSource.json();
            console.log("Source Data:", sourceData); // Kaynak verisini kontrol etmek için

            return { pollutantData, source: sourceData.sources };
        } catch (error) {
            console.error("Fetch Error:", error);
            return { pollutantData: {}, source: ["Veri alınamadı"] };
        }
    };

    const { pollutantData, source } = await fetchData();
    const adjustedSource = Array.isArray(source) ? source : ["Veri alınamadı"];

    if (!pollutantData.co || pollutantData.co.length === 0) {
        console.error("CO verisi eksik veya yüklenemedi!");
        return;
    }

    const threshold = 5000; // CO Sınır değeri sabit
    let targetPercentage = parseFloat(targetInput.value) || 50; // Varsayılan hedef yüzde olarak başlatılır (%50)
    let targetValue = (threshold * targetPercentage) / 100; // Hedef değeri hesapla

    // CO verilerini 10 ile çarp
    const adjustedCOValues = pollutantData.co.map(value => value !== null ? value * 10 : 0);

    const createChart = () => {
        const tooltipData = adjustedCOValues.map(value => 
            value > threshold ? adjustedSource.join(", ") : 'Normal Değer'
        );

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthLabels, // Yatay eksene ay isimlerini ekle
                datasets: [
                    { // CO Gerçek Değerler
                        label: 'CO (Gerçek Değerler x10)',
                        data: adjustedCOValues, // Çarpılmış değerler
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        pointBackgroundColor: adjustedCOValues.map(value => value > threshold ? 'red' : 'blue'),
                        pointRadius: 5
                    },
                    { // CO Sınır Değeri
                        label: `CO Sınır (${threshold} mg/m³)`,
                        data: new Array(monthLabels.length).fill(threshold),
                        borderColor: 'red',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0
                    },
                    { // CO Hedef Değeri
                        label: `CO Hedef (%${targetPercentage})`,
                        data: new Array(monthLabels.length).fill(targetValue),
                        borderColor: 'green',
                        borderDash: [2, 2],
                        borderWidth: 2,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'CO Değerleri: Sınır, Hedef ve Kirlilik Kaynağı'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.raw;
                                const sources = tooltipData[context.dataIndex].split(',').join('\n');
                                return `Değer: ${value} µg/m³\nKaynaklar:\n`;
                            },
                            afterLabel: function (context) {
                                const sources = tooltipData[context.dataIndex].split(',');
                                return sources.map((source) => `• ${source.trim()}`).join('\n');
                            }
                        },
                        titleFont: {
                            size: 16, // Başlık font boyutu
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 16, // İçerik font boyutu
                        },
                        footerFont: {
                            size: 12, // Footer font boyutu (isteğe bağlı)
                        },
                        padding: 10, // Tooltip iç boşluk
                        backgroundColor: '#008080', // Tooltip arkaplan rengi
                        borderColor: '#fff', // Tooltip kenarlık rengi
                        borderWidth: 1,
                        caretPadding: 10,
                        boxPadding: 5
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        min: 3000, // Minimum değer
                        max: 9000, // Maksimum değer
                        title: {
                            display: true,
                            text: 'mg/m³'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Aylar'
                        }
                    }
                }
            }
        });
    };

    let chart = createChart();

    // Hedef değerini yüzde olarak güncelle
    updateButton.addEventListener('click', () => {
        targetPercentage = parseFloat(targetInput.value) || 50; // Yeni yüzde değeri
        targetValue = threshold - (threshold * targetPercentage) / 100; // Yeni hedef değeri hesapla
        chart.destroy(); // Mevcut grafiği sil
        chart = createChart(); // Yeni grafik oluştur
    });

    const reductionInput = document.getElementById('reductionInput');
    const calculateButton = document.getElementById('calculateReduction');

    calculateButton.addEventListener('click', () => {
        const reductionPercentage = parseFloat(reductionInput.value) / 100;
        const reducedCO = pollutantData.co.map(value => value !== null ? value - (value * reductionPercentage) : 0);

        // Daha önce eklenen azaltılmış veri setini kaldır
        const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label.includes('CO Azaltılmış'));
        if (datasetIndex !== -1) {
            chart.data.datasets.splice(datasetIndex, 1); // Veri setini kaldır
        }

        // Yeni azaltılmış veri setini ekle
        chart.data.datasets.push({
            label: `CO Azaltılmış (%${reductionPercentage * 100})`,
            data: reducedCO,
            borderColor: 'blue',
            borderDash: [4, 4],
            borderWidth: 2,
            fill: false,
            pointRadius: 3,
            pointBackgroundColor: 'blue'
        });

        chart.update(); // Grafiği güncelle
    });
});
