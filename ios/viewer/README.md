# InstrumentsOS Viewer

Web-based trace viewer with a multi-track Canvas timeline, flame charts, and call trees.

## Setup

```bash
cd viewer
npm install
```

## Running

```bash
npm run dev
# Open http://localhost:5173
```

Make sure the backend is running at `http://localhost:8080`.

## Building

```bash
npm run build
# Output in dist/
```

## Features

- **Multi-track timeline**: CPU, Memory, Hitches, Signposts on a shared time axis
- **Pan and zoom**: Mouse wheel to zoom, drag to pan (like Google Maps)
- **Inspection range**: Click-drag to select a time range, all views filter to it
- **Flame chart**: Nested call stacks over time, width = duration
- **Call tree**: Aggregated top-down/bottom-up view with self-time and total-time
- **Live mode**: Real-time updates when SDK is actively recording

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- HTML Canvas 2D for timeline rendering (not DOM — performance critical)
