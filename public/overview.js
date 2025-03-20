// Function to get data points within current map bounds
function getPointsInView() {
  const bounds = map.getBounds();
  return data.filter((point) => {
    return bounds.contains(L.latLng(point.latitude_y, point.longitude_x));
  });
}

let aiTimeout = null;
let lastAIUpdate = 0;

async function getWeatherData(lat, lon) {
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature,precipitation,rain,snowfall`
        );
        const data = await response.json();
        return data.current;
    } catch (error) {
        console.error('Weather API error:', error);
        return null;
    }
}

async function getAIRecommendations(analysisData, weatherData) {
    try {
        const response = await fetch('/recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ analysisData, weatherData })
        });

        if (!response.ok) {
            throw new Error('Failed to get AI recommendations');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let recommendations = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                while (true) {
                    const lineEnd = buffer.indexOf('\n');
                    if (lineEnd === -1) break;

                    const line = buffer.slice(0, lineEnd).trim();
                    buffer = buffer.slice(lineEnd + 1);

                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0].delta.content;
                            if (content) {
                                recommendations.push(content);
                                updateRecommendationsDisplay(recommendations.join(''));
                            }
                        } catch (e) {
                            // Ignore invalid JSON
                        }
                    }
                }
            }
        } finally {
            reader.cancel();
        }

        return recommendations.join('').split('\n').filter(r => r.trim());
    } catch (error) {
        console.error('AI API error:', error);
        return null;
    }
}

function updateRecommendationsDisplay(recommendations) {
    const recommendationsDiv = document.getElementById('aiRecommendations');
    if (recommendationsDiv) {
        recommendationsDiv.innerHTML = recommendations.split('\n')
            .filter(r => r.trim())
            .map(rec => `<li class="text-gray-600">• ${rec}</li>`)
            .join('');
    }
}

async function updateAreaAnalysis() {
    const visiblePoints = getPointsInView();
    const bounds = map.getBounds();
    const center = bounds.getCenter();
    
    // Calculate statistics
    const stats = {
        total: visiblePoints.length,
        high: visiblePoints.filter((p) => p.Severity === "High").length,
        medium: visiblePoints.filter((p) => p.Severity === "Medium").length,
        low: visiblePoints.filter((p) => p.Severity === "Low").length,
    };

    stats.highPercent = ((stats.high / stats.total) * 100).toFixed(1);
    stats.mediumPercent = ((stats.medium / stats.total) * 100).toFixed(1);
    stats.lowPercent = ((stats.low / stats.total) * 100).toFixed(1);

    // Process distress types
    const distressAnalysis = visiblePoints.reduce((acc, point) => {
        if (!acc[point.Distress_Type]) {
            acc[point.Distress_Type] = {
                total: 0,
                high: 0,
                medium: 0,
                low: 0,
            };
        }
        acc[point.Distress_Type].total++;
        acc[point.Distress_Type][point.Severity.toLowerCase()]++;
        return acc;
    }, {});

    // Calculate critical areas
    const criticalAreas = Object.entries(distressAnalysis)
        .map(([type, data]) => ({
            type,
            severity_score: (data.high * 3 + data.medium * 2 + data.low) / data.total,
            total: data.total,
            high_percentage: ((data.high / data.total) * 100).toFixed(1),
        }))
        .sort((a, b) => b.severity_score - a.severity_score);

    // Calculate density
    const areaSqKm = calculateAreaInSqKm(bounds);
    const density = (visiblePoints.length / areaSqKm).toFixed(2);

    // Update immediate stats display
    updateStatsDisplay(stats, criticalAreas, density);

    // Handle AI recommendations with delay
    const currentTime = Date.now();
    if (currentTime - lastAIUpdate > 5000) {
        if (aiTimeout) {
            clearTimeout(aiTimeout);
        }
        
        aiTimeout = setTimeout(async () => {
            // Get weather data
            const weatherData = await getWeatherData(center.lat, center.lng);
            
            // Get AI recommendations
            const analysisData = {
                stats,
                criticalAreas,
                density
            };
            
            const recommendations = await getAIRecommendations(analysisData, weatherData);
            
            // Update AI recommendations section
            updateAIRecommendations(recommendations);
            
            lastAIUpdate = Date.now();
        }, 5000);
    }
}

function calculateAreaInSqKm(bounds) {
  const center = bounds.getCenter();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();

  const height = getDistanceFromLatLonInKm(south, west, north, west);
  const width = getDistanceFromLatLonInKm(center.lat, west, center.lat, east);

  return height * width;
}

function generateMaintenanceRecommendations(criticalAreas, stats) {
  const recommendations = [];

  if (stats.high > 0) {
    const highestPriorityType = criticalAreas[0];
    recommendations.push(
      `Immediate attention needed for ${highestPriorityType.type} issues with ${highestPriorityType.high_percentage}% high severity cases`
    );
  }

  const totalSeverityScore =
    (stats.high * 3 + stats.medium * 2 + stats.low) / stats.total;
  if (totalSeverityScore > 2) {
    recommendations.push(
      "Consider comprehensive road rehabilitation for this section"
    );
  } else if (totalSeverityScore > 1.5) {
    recommendations.push("Schedule regular maintenance checks and repairs");
  }

  const patterns = criticalAreas.filter((area) => area.severity_score > 2);
  if (patterns.length > 1) {
    recommendations.push(
      `Multiple severe distress types detected: ${patterns
        .map((p) => p.type)
        .join(", ")}. Consider structural assessment`
    );
  }

  return recommendations
    .map((rec) => `<li class="text-gray-600">• ${rec}</li>`)
    .join("");
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Update initialization
document.addEventListener("DOMContentLoaded", function () {
  initializeMap();
  addLegend();
  initializeMapControls();

  // Add map event listeners for area analysis
  map.on("moveend", updateAreaAnalysis);
  map.on("zoomend", updateAreaAnalysis);

  // Initial area analysis update
  updateAreaAnalysis();
});

function updateStatsDisplay(stats, criticalAreas, density) {
    document.getElementById("viewStats").innerHTML = `
        <div class="bg-gray-50 p-4 rounded-lg space-y-4">
            <div class="border-b pb-3">
                <h4 class="text-sm font-medium text-gray-500 mb-2">Current View Overview</h4>
                <p class="text-sm">Total Points: <span class="font-semibold">${stats.total}</span></p>
                <p class="text-sm">Density: <span class="font-semibold">${density} points/km²</span></p>
                <p class="text-sm">High Severity: <span class="font-semibold text-red-600">${stats.high} (${stats.highPercent}%)</span></p>
                <p class="text-sm">Medium Severity: <span class="font-semibold text-yellow-500">${stats.medium} (${stats.mediumPercent}%)</span></p>
                <p class="text-sm">Low Severity: <span class="font-semibold text-green-600">${stats.low} (${stats.lowPercent}%)</span></p>
            </div>

            <div class="border-b pb-3">
                <h4 class="text-sm font-medium text-gray-500 mb-2">Critical Areas Analysis</h4>
                ${criticalAreas.slice(0, 3).map((area) => `
                    <div class="mb-2">
                        <p class="text-sm font-medium">${area.type}</p>
                        <p class="text-xs text-gray-500">
                            Severity Score: ${area.severity_score.toFixed(2)} |
                            High Severity: ${area.high_percentage}% |
                            Total Issues: ${area.total}
                        </p>
                    </div>
                `).join("")}
            </div>

            <div class="pb-3">
                <h4 class="text-sm font-medium text-gray-500 mb-2">AI Recommendations</h4>
                <ul id="aiRecommendations" class="text-sm space-y-1">
                    <li class="text-gray-500 italic">Updating recommendations...</li>
                </ul>
            </div>
        </div>
    `;
}

function updateAIRecommendations(recommendations) {
    const aiRecommendationsDiv = document.getElementById('aiRecommendations');
    if (aiRecommendationsDiv) {
        aiRecommendationsDiv.innerHTML = recommendations ? 
            recommendations.map(rec => `<li class="text-gray-600">• ${rec}</li>`).join('') : 
            '<li class="text-gray-500 italic">Failed to load recommendations</li>';
    }
}

/* <div>
                <h4 class="text-sm font-medium text-gray-500 mb-2">Maintenance Recommendations</h4>
                <ul class="text-sm space-y-1">
                    ${generateMaintenanceRecommendations(criticalAreas, stats)}
                </ul>
            </div> */