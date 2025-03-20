// Initialize map and global variables
let map,
  markers = [],
  markerCluster = L.markerClusterGroup(),
  heatLayer = null;
const basePoint = data[0];

// Initialize map with the first point as center
function initializeMap() {
  map = L.map("map").setView([basePoint.latitude_y, basePoint.longitude_x], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // Add zoom control
  map.zoomControl.setPosition("bottomleft");

  // Initialize layer controls
  document.getElementById("layer").addEventListener("change", updateMap);
  document.getElementById("severity").addEventListener("change", updateMap);
  document.getElementById("distressType").addEventListener("change", updateMap);

  // Initial map update
  updateMap();
}

// Marker creation with custom styling
function createMarker(point) {
  const severityColors = {
    High: "#EF4444", // Red
    Medium: "#F59E0B", // Orange
    Low: "#10B981", // Green
  };

  const marker = L.marker([point.latitude_y, point.longitude_x], {
    icon: L.divIcon({
      className: "custom-div-icon",
      html: `
                <div style="
                    background-color: ${severityColors[point.Severity]};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    }),
  });

  // Enhanced popup content
  const popupContent = `
        <div class="popup-content" style="
            min-width: 250px; 
            padding: 15px; 
            border-radius: 10px; 
            background-color: #ffffff;
            font-family: Arial, sans-serif;
        ">
        <!-- Distress Type -->
        <div style="margin-bottom: 10px; text-align: center;">
            <span style="
                display: inline-block;
                width: 100%;
                padding: 6px 12px;
                border-radius: 20px;
                background-color: ${severityColors[point.Severity]};
                font-size: 14px; 
                font-weight: bold; 
                color: #ffffff;
            ">
                ${point.Distress_Type}
            </span>
        </div>
        
        <!-- Distress Level -->
        <p style="
            font-size: 14px;
            color: #374151;
            margin-bottom: 5px;
            margin-top: 10px;
        ">
            <b>Distress Level:</b> ${point.Distress_Level}
        </p>
        
        <!-- Date and Time -->
        <p style="
            font-size: 14px;
            color: #374151;
            margin-bottom: 20px;
            margin-top: 5px;
        ">
            <b>Date:</b> ${new Date(point.DateTime_1).toLocaleString()}
        </p>
        
        <!-- File Preview -->
        ${
          point.File_URL
            ? `
            <div style="margin-bottom: 15px;">
                <iframe 
                    src="${point.File_URL}" 
                    style="
                        width: 100%; 
                        height: 200px; 
                        border: none; 
                        border-radius: 8px; 
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
                    "
                    allowfullscreen
                ></iframe>
            </div>
        `
            : ""
        }
        </div>
    `;

  marker.bindPopup(popupContent);
  return marker;
}

// Clear existing map layers
function clearMap() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];
  map.removeLayer(markerCluster);
  markerCluster = L.markerClusterGroup();
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
}

// Update map based on selected filters
function updateMap() {
  const layer = document.getElementById("layer").value;
  const severity = document.getElementById("severity").value;
  const distressType = document.getElementById("distressType").value;

  // Update URL parameters
  const params = new URLSearchParams(window.location.search);
  params.set("layer", layer);
  if (severity) params.set("severity", severity);
  if (distressType) params.set("type", distressType);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);

  // Show/hide filter groups
  document.getElementById("severityGroup").style.display =
    layer === "By Severity" ? "block" : "none";
  document.getElementById("typeGroup").style.display =
    layer === "By Distress Type" ? "block" : "none";

  // Filter data based on selections
  let filteredData = data;
  if (layer === "By Severity" && severity) {
    filteredData = data.filter((point) => point.Severity === severity);
  } else if (layer === "By Distress Type" && distressType) {
    filteredData = data.filter((point) => point.Distress_Type === distressType);
  }

  clearMap();

  if (layer === "Distress Heatmap") {
    const heatData = filteredData.map((point) => {
      const weight =
        point.Severity === "High"
          ? 1.0
          : point.Severity === "Medium"
          ? 0.7
          : 0.4;
      return [point.latitude_y, point.longitude_x, weight];
    });

    heatLayer = L.heatLayer(heatData, {
      radius: 30, // Increased radius for better spread
      blur: 50, // Increased blur for smoother gradients
      maxZoom: 15, // Adjusted max zoom level
      max: 1.0, // Maximum point intensity
      gradient: {
        // Custom gradient for more vibrant colors
        0.0: "rgb(0,0,255)",
        0.3: "rgb(0,255,255)",
        0.5: "rgb(0,255,0)",
        0.7: "rgb(255,255,0)",
        1.0: "rgb(255,0,0)",
      },
    }).addTo(map);
  } else if (layer === "Distress Type Clustering") {
    filteredData.forEach((point) => {
      const marker = createMarker(point);
      markerCluster.addLayer(marker);
      markers.push(marker);
    });
    map.addLayer(markerCluster);
  } else {
    filteredData.forEach((point) => {
      const marker = createMarker(point);
      marker.addTo(map);
      markers.push(marker);
    });
  }
}

// Add custom legend
function addLegend() {
  const legend = L.control({ position: "bottomright" });

  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    div.style.backgroundColor = "white";
    div.style.padding = "10px";
    div.style.borderRadius = "4px";
    div.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";

    div.innerHTML = `
            <h4 style="margin: 0 0 5px 0; font-weight: 600;">Severity</h4>
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div>
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #EF4444; margin-right: 5px;"></span>
                    High
                </div>
                <div>
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #F59E0B; margin-right: 5px;"></span>
                    Medium
                </div>
                <div>
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #10B981; margin-right: 5px;"></span>
                    Low
                </div>
            </div>
        `;
    return div;
  };

  legend.addTo(map);
}

// Opacity controls for map controls
function initializeMapControls() {
  const mapControls = document.querySelector(".map-controls");
  let fadeTimeout;

  // Add these styles to your map controls
  mapControls.style.transition = "opacity 0.3s ease";
  mapControls.style.opacity = "1";

  // Function to fade controls
  function fadeControls() {
    mapControls.style.opacity = "0.5";
  }

  // Function to show controls
  function showControls() {
    mapControls.style.opacity = "1";
    clearTimeout(fadeTimeout);
    fadeTimeout = setTimeout(fadeControls, 2000); // Fade after 2 seconds of no interaction
  }

  // Map interaction events
  map.on("dragstart zoomstart", () => {
    mapControls.style.opacity = "0.5";
  });

  // Mouse events for controls
  mapControls.addEventListener("mouseenter", () => {
    mapControls.style.opacity = "1";
    clearTimeout(fadeTimeout);
  });

  mapControls.addEventListener("mouseleave", () => {
    if (map.dragging.moved()) {
      fadeControls();
    }
  });

  // Map idle events
  map.on("dragend zoomend", () => {
    showControls();
  });

  // Initial fade
  fadeTimeout = setTimeout(fadeControls, 2000);
}

// Initialize everything when DOM is loaded
// document.addEventListener('DOMContentLoaded', function() {
//     initializeMap();
//     addLegend();
//     initializeTimeSeriesChart();

//     // Add responsive handlers
//     window.addEventListener('resize', function() {
//         map.invalidateSize();
//     });
// });

// Export functions for use in the template
window.updateMap = updateMap;
