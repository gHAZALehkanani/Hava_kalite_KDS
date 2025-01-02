document.addEventListener("DOMContentLoaded", () => {

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


    // Harita butonuna tıklandığında yönlendirme
    const mapButton = document.getElementById("mapButton");
    mapButton.addEventListener("click", () => {
        window.location.href = "/map"; // Harita sayfasına yönlendirme
    });

    // Kaynak analizi butonuna tıklandığında yönlendirme
    const analysisButton = document.getElementById("analysisButton");
    analysisButton.addEventListener("click", () => {
        window.location.href = `/analysis?stationId=${selectedStationId}`; // Kaynak analizi sayfasına yönlendirme
    });

    // Kirletici buton yönlendirmeleri
    const pollutantButtons = {
        PM10B: "/PM10",
        COB: "/CO",
        NO2B: "/NO2",
        SO2B: "/SO2",
    };

    Object.keys(pollutantButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        button.addEventListener("click", () => {
            window.location.href = `${pollutantButtons[buttonId]}?stationId=${selectedStationId}`;
        });
    });





    

    // ********************** dashboard ****************
    const currentYear = new Date().getFullYear();
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    let pollutantsChart, airQualityIndexChart;
    let selectedPollutant = 'co'; // Varsayılan olarak CO seçili

    // URL'den stationId parametresini al
    const urlParams = new URLSearchParams(window.location.search);
    const selectedStationId = urlParams.get('stationId');

    if (!selectedStationId) {
        alert("Lütfen önce haritadan bir istasyon seçin.");
        return;
    }

    // Yıl seçicilerini doldur
    function populateYearSelector(selectorId, startYear) {
        const selectElement = document.getElementById(selectorId);
        for (let year = startYear; year <= currentYear; year++) {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            selectElement.appendChild(option);
        }
        selectElement.value = currentYear -1; // Varsayılan olarak mevcut yılı seç
    }

    populateYearSelector("yearSelect1", 2020); // Hava Kirletici Unsurlar
    populateYearSelector("yearSelect2", 2020); // Hava Kalite İndeksi

    // API'den veri çekme fonksiyonu
    async function fetchData(endpoint) {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Veri çekme hatası: ${response.statusText}`);
        }
        return await response.json();
    }

    // Hava Kirletici Unsurlar Grafiği
    function updatePollutantsChart(year) {
        fetchData(`/api/pollutants?year=${year}&stationId=${selectedStationId}`).then(pollutantsData => {
            
            const dataMap = {
                co: new Array(12).fill(null),
                no2: new Array(12).fill(null),
                pm10: new Array(12).fill(null),
                so2: new Array(12).fill(null),
            };

            pollutantsData.forEach(item => {
                const monthIndex = months.indexOf(item.month);
                if (monthIndex !== -1) {
                    dataMap.co[monthIndex] = item.co;
                    dataMap.no2[monthIndex] = item.no2;
                    dataMap.pm10[monthIndex] = item.pm10;
                    dataMap.so2[monthIndex] = item.so2;
                }
            });

            const chartData = dataMap[selectedPollutant]; // Seçilen kirletici unsuru göster

            if (pollutantsChart) {
                pollutantsChart.data.datasets[0].data = chartData;
                pollutantsChart.data.datasets[0].label = selectedPollutant.toUpperCase();
                pollutantsChart.update();
            } else {
                pollutantsChart = new Chart(document.getElementById('pollutantsChart'), {
                    type: 'line',
                    data: {
                        labels: months,
                        datasets: [
                            {
                                label: selectedPollutant.toUpperCase(),
                                data: chartData,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: 'Hava Kirletici Unsurlar' },
                        },
                        scales: {
                            x: {
                                ticks: { autoSkip: false },
                            },
                        },
                    },
                });
            }
        });
    }

    // Hava Kalite İndeksi Grafiği
    function updateAirQualityIndexChart(selectedYear) {
        const currentYearDataPromise = fetchData(`/api/air_quality_index?year=${currentYear-1}&stationId=${selectedStationId}`);
        const selectedYearDataPromise = fetchData(`/api/air_quality_index?year=${selectedYear}&stationId=${selectedStationId}`);

        Promise.all([currentYearDataPromise, selectedYearDataPromise]).then(([currentYearData, selectedYearData]) => {
            const currentYearValues = new Array(12).fill(null);
            const selectedYearValues = new Array(12).fill(null);

            currentYearData.forEach(item => {
                const monthIndex = months.indexOf(item.month);
                if (monthIndex !== -1) {
                    currentYearValues[monthIndex] = item.aqi;
                }
            });

            selectedYearData.forEach(item => {
                const monthIndex = months.indexOf(item.month);
                if (monthIndex !== -1) {
                    selectedYearValues[monthIndex] = item.aqi;
                }
            });

            if (airQualityIndexChart) {
                airQualityIndexChart.data.datasets[0].data = currentYearValues;
                airQualityIndexChart.data.datasets[1].data = selectedYearValues;
                airQualityIndexChart.update();
            } else {
                airQualityIndexChart = new Chart(document.getElementById('airQualityIndexChart'), {
                    type: 'line',
                    data: {
                        labels: months,
                        datasets: [
                            {
                                label: `Mevcut Yıl Hava Kalite İndeksi`,
                                data: currentYearValues,
                                borderColor: 'rgba(75, 192, 192, 1)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                borderWidth: 2,
                                fill: true,
                            },
                            {
                                label: `Seçilen Yıl Hava Kalite İndeksi`,
                                data: selectedYearValues,
                                borderColor: 'rgba(255, 99, 132, 1)',
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderWidth: 2,
                                fill: true,
                            },
                        ],
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: 'Hava Kalite İndeksi (Mevcut Yıl ve Seçilen Yıl)' },
                        },
                        scales: {
                            x: {
                                ticks: { autoSkip: false },
                            },
                        },
                    },
                });
            }
        });
    }

    // Hava kirletici unsurlar için butonlar
    const pollutants = ['co', 'no2', 'pm10', 'so2'];
    const buttonsContainer = document.getElementById('pollutantButtons');
    pollutants.forEach(pollutant => {
        const button = document.createElement('button');
        button.textContent = pollutant.toUpperCase();
        button.dataset.pollutant = pollutant;
        button.classList.add('pollutant-button');
        button.addEventListener('click', () => {
            selectedPollutant = pollutant;
            updatePollutantsChart(document.getElementById('yearSelect1').value);
        });
        buttonsContainer.appendChild(button);
    });

    // Yıl değişikliği dinleyicileri
    document.getElementById("yearSelect1").addEventListener("change", (event) => {
        updatePollutantsChart(event.target.value);
    });

    document.getElementById("yearSelect2").addEventListener("change", (event) => {
        updateAirQualityIndexChart(event.target.value);
    });

    // İlk yüklemede grafikler
    updatePollutantsChart(currentYear);
    updateAirQualityIndexChart(currentYear);
});
