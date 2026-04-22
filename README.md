# RoadLens

A web-based GIS application for road condition surveys and infrastructure monitoring. Field teams capture defect reports with GPS coordinates, which are visualized on an interactive map with cluster markers and heatmap overlays to identify high-priority repair areas.

## Features

- **Interactive Map** — Leaflet.js map with zoom, pan, and tile layer switching for field and satellite views
- **Cluster Markers** — Leaflet.markercluster groups nearby survey points for clean rendering across all zoom levels
- **Heatmap Overlay** — Leaflet.heat visualizes defect density — red/orange hotspots highlight roads needing urgent attention
- **Survey Data Entry** — Capture defect type, severity, GPS coordinates, photos, and notes per survey point
- **Filtering** — Filter the map by road type, defect category, date range, and severity level
- **Data Export** — Download survey data as CSV or GeoJSON for use in external GIS tools
- **Responsive UI** — Works on tablets and mobile devices used in the field

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router), TypeScript |
| State Management | Zustand |
| Maps | Leaflet.js, Leaflet.markercluster, Leaflet.heat |
| Styling | Tailwind CSS |
| Database | PostgreSQL, Prisma ORM |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@host:5432/roadlens"
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Installation

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Map Usage

### Cluster Markers

Survey points auto-cluster when zoomed out. Click any cluster badge to zoom in and expand it into individual markers.

### Heatmap Layer

Toggle the heatmap button in the map controls to overlay a thermal density visualization. Colours scale from blue (sparse) through yellow to red (dense problem areas).

### Adding a Survey Point

1. Click the **Add Survey** button or tap the map at the target location
2. Fill in the defect details in the side panel (type, severity, notes)
3. Attach a photo if available
4. Submit — the marker appears on the map immediately

### Each survey point records

- GPS coordinates (lat / lng)
- Road name or segment ID
- Defect type (pothole, crack, subsidence, edge break, etc.)
- Severity rating (1 to 5)
- Photo attachments
- Timestamp and surveyor name

## License

MIT
