let chartInstance = null; // Global değişkenle grafiği takip edin

// Harita butonuna tıklandığında yönlendirme
document.getElementById("mapButton").addEventListener("click", () => {
    window.location.href = "/map";
});

// Dashboard butonuna tıklandığında yönlendirme
document.getElementById("dashboardButton").addEventListener("click", () => {
    window.location.href = "/dashboard";
});

// URL'den stationId parametresini al
const urlParams = new URLSearchParams(window.location.search);
const selectedStationId = urlParams.get('stationId');

if (!selectedStationId) {
    console.error("Station ID belirtilmedi!");
    alert("Station ID belirtilmedi! Lütfen doğru URL ile sayfaya erişin.");
    throw new Error("Station ID is missing");
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

const loadYears = async () => {
    const response = await fetch(`/api/years?stationId=${stationId}`);
    const years = await response.json();
    console.log("Years API response:", years);

    if (Array.isArray(years)) {
        const yearSelect = document.getElementById('year');
        yearSelect.innerHTML = ''; // Mevcut seçenekleri temizle

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });

        fetchData(); // İlk yılın verilerini yükle
    } else {
        console.error("Invalid API response:", years);
    }
};

const fetchData = async () => {
    const year = document.getElementById("year").value;

    if (!stationId) {
        console.error("Station ID is missing. Cannot fetch data.");
        return;
    }

    try {
        const response = await fetch(`/api/pollutants?year=${year}&stationId=${stationId}`);
        const data = await response.json();
        console.log("Pollutants API verisi:", data);

        if (!Array.isArray(data)) {
            console.error("Invalid data format:", data);
            return;
        }

        // Toplam kirlilik seviyelerini hesapla
        const totalCO = data.reduce((sum, item) => sum + parseFloat(item.co || 0), 0);
        const totalNO2 = data.reduce((sum, item) => sum + parseFloat(item.no2 || 0), 0);
        const totalPM10 = data.reduce((sum, item) => sum + parseFloat(item.pm10 || 0), 0);
        const totalSO2 = data.reduce((sum, item) => sum + parseFloat(item.so2 || 0), 0);

        // Logaritmik oranlar (log(0) hatasını önlemek için +1)
        const logCO = Math.log10(totalCO + 1);
        const logNO2 = Math.log10(totalNO2 + 1);
        const logPM10 = Math.log10(totalPM10 + 1);
        const logSO2 = Math.log10(totalSO2 + 1);

        const totalLog = logCO + logNO2 + logPM10 + logSO2;

        // Yüzdeleri hesapla
        const percentCO = (logCO / totalLog) * 100;
        const percentNO2 = (logNO2 / totalLog) * 100;
        const percentPM10 = (logPM10 / totalLog) * 100;
        const percentSO2 = (logSO2 / totalLog) * 100;

        renderChart([percentCO, percentNO2, percentPM10, percentSO2]);
    } catch (error) {
        console.error("Error fetching pollutants data:", error);
        alert("Veri alınırken bir hata oluştu.");
    }
};

const renderChart = (data) => {
    const ctx = document.getElementById('pollutantsChart').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy(); // Önceki grafiği yok et
    }

    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['CO', 'NO2', 'PM10', 'SO2'],
            datasets: [{
                data: data,
                backgroundColor: ['#ff6384', '#36a2eb', '#ffcd56', '#4bc0c0'],
                hoverBackgroundColor: ['#ff3366', '#1f78d1', '#ffc233', '#359b9b'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#333'
                    }
                },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: {
                        size: 14,
                        weight: 'bold',
                        color: '#fff'
                    },
                    bodyFont: {
                        size: 12,
                        color: '#fff'
                    },
                    bodySpacing: 6,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: '#fff',
                    cornerRadius: 6,
                }
            },
            onClick: async (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;

                    if (chartInstance && chartInstance.data.labels) {
                        const pollutant = chartInstance.data.labels[index];
                        console.log("Tıklanan Kirletici:", pollutant);

                        if (pollutant) {
                            const year = document.getElementById("year").value;

                            try {
                                const response = await fetch(`/api/pollution-source?year=${year}&pollutant=${pollutant}&stationId=${stationId}`);
                                const source = await response.json();

                                // Kaynakları ekrana yazdır
                                const sourceElement = document.getElementById(`source${pollutant}`);
                                sourceElement.innerText = source.sources && source.sources.length > 0
                                    ? `${pollutant}: ${source.sources.join(', ')}`
                                    : `${pollutant}: Kaynak bulunamadı`;
                            } catch (error) {
                                console.error('Kaynak bilgisi alınırken hata:', error);
                                alert('Kaynak bilgisi alınırken hata oluştu!');
                            }
                        }
                    }
                }
            }
        }
    });
};

window.onload = loadYears;
