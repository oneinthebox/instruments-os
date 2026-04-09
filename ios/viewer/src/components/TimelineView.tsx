import { useRef, useEffect, useCallback } from "react";
import type { TraceEvent } from "@/types";
import { TimelineState } from "@/canvas/timeline";
import { renderTimeline, RULER_HEIGHT, TRACK_HEIGHT, TRACK_GAP } from "@/canvas/renderer";

interface TimelineViewProps {
  events: TraceEvent[];
}

const TRACK_COUNT = 5; // CPU, Memory, Hitches, GPU, Signposts

export function TimelineView({ events }: TimelineViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<TimelineState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const computeDataRange = useCallback((): { start: number; end: number } => {
    if (events.length === 0) {
      return { start: 0, end: 1_000_000_000 }; // Default 1s range
    }

    let min = Infinity;
    let max = -Infinity;

    for (const evt of events) {
      if (evt.timestamp_ns < min) min = evt.timestamp_ns;
      if (evt.timestamp_ns > max) max = evt.timestamp_ns;
    }

    // Add 2% padding on each side
    const range = max - min;
    const padding = range * 0.02 || 1_000_000;
    return { start: min - padding, end: max + padding };
  }, [events]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderTimeline(ctx, state, events);
  }, [events]);

  // Handle resize with DPR-aware sizing
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
        }

        const { start, end } = computeDataRange();

        if (stateRef.current) {
          stateRef.current.width = width;
          stateRef.current.height = height;
        } else {
          stateRef.current = new TimelineState(start, end, width, height);
        }

        draw();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [computeDataRange, draw]);

  // Re-initialize state when events change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const { start, end } = computeDataRange();
    stateRef.current = new TimelineState(start, end, width, height);
    draw();
  }, [events, computeDataRange, draw]);

  // Wheel handler: ctrl/meta + scroll = zoom, else = pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = stateRef.current;
      if (!state) return;

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const factor = e.deltaY > 0 ? 1.1 : 0.9;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        state.zoom(mouseX, factor);
      } else {
        // Pan
        state.pan(e.deltaX);
      }

      draw();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [draw]);

  const minHeight = RULER_HEIGHT + TRACK_COUNT * (TRACK_HEIGHT + TRACK_GAP);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: `${minHeight}px` }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
}
