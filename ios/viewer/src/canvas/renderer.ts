import type { TraceEvent, CpuSampleEvent, MemoryEvent, HitchEvent, GpuUtilEvent, GpuCmdBufEvent, SignpostEvent } from "@/types";
import { TimelineState } from "./timeline";

const COLORS = {
  background: "#09090b",
  trackBg: "#18181b",
  border: "#27272a",
  text: "#a1a1aa",
  textBright: "#fafafa",
  cpu: "#7c3aed",
  memory: "#06b6d4",
  hitchGreen: "#22c55e",
  hitchYellow: "#eab308",
  hitchRed: "#ef4444",
  gpu: "#f97316",
  signpost: "#8b5cf6",
};

const RULER_HEIGHT = 28;
const TRACK_HEIGHT = 80;
const TRACK_GAP = 4;
const LABEL_WIDTH = 120;

function formatTime(ns: number, visibleDurationMs: number): string {
  const ms = ns / 1_000_000;
  if (visibleDurationMs < 100) {
    return `${ms.toFixed(2)}ms`;
  }
  if (visibleDurationMs < 10_000) {
    return `${ms.toFixed(0)}ms`;
  }
  const s = ms / 1000;
  return `${s.toFixed(2)}s`;
}

function computeNiceTickInterval(visibleRangeNs: number, maxTicks: number): number {
  const rawInterval = visibleRangeNs / maxTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalized = rawInterval / magnitude;

  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;

  return niceNormalized * magnitude;
}

function renderRuler(ctx: CanvasRenderingContext2D, state: TimelineState): void {
  const trackAreaWidth = state.width - LABEL_WIDTH;

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, state.width, RULER_HEIGHT);

  // Border bottom
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER_HEIGHT - 0.5);
  ctx.lineTo(state.width, RULER_HEIGHT - 0.5);
  ctx.stroke();

  // Ticks
  const visibleRange = state.visibleEnd - state.visibleStart;
  const maxTicks = Math.floor(trackAreaWidth / 80);
  const tickInterval = computeNiceTickInterval(visibleRange, maxTicks);

  const firstTick = Math.ceil(state.visibleStart / tickInterval) * tickInterval;

  ctx.fillStyle = COLORS.text;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (let ns = firstTick; ns <= state.visibleEnd; ns += tickInterval) {
    const x = LABEL_WIDTH + ((ns - state.visibleStart) / visibleRange) * trackAreaWidth;

    // Tick line
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath();
    ctx.moveTo(x, RULER_HEIGHT - 8);
    ctx.lineTo(x, RULER_HEIGHT - 1);
    ctx.stroke();

    // Label - show relative time from visible start
    const label = formatTime(ns - state.dataStart, state.visibleDurationMs);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(label, x, RULER_HEIGHT - 10);
  }
}

function renderTrackBackground(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  trackIndex: number,
): number {
  const y = RULER_HEIGHT + trackIndex * (TRACK_HEIGHT + TRACK_GAP);

  // Track background
  ctx.fillStyle = COLORS.trackBg;
  ctx.fillRect(LABEL_WIDTH, y, state.width - LABEL_WIDTH, TRACK_HEIGHT);

  // Border
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(LABEL_WIDTH + 0.5, y + 0.5, state.width - LABEL_WIDTH - 1, TRACK_HEIGHT - 1);

  return y;
}

function renderTrackLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  y: number,
): void {
  ctx.fillStyle = COLORS.text;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(label, LABEL_WIDTH - 12, y + TRACK_HEIGHT / 2);
}

function renderCpuTrack(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  cpuEvents: CpuSampleEvent[],
  trackIndex: number,
): void {
  const y = renderTrackBackground(ctx, state, trackIndex);
  renderTrackLabel(ctx, "CPU", y);

  if (cpuEvents.length === 0) return;

  const trackAreaWidth = state.width - LABEL_WIDTH;
  const binCount = Math.max(1, Math.floor(trackAreaWidth));
  const bins = new Float64Array(binCount);

  // Bin events into pixel columns
  const visibleRange = state.visibleEnd - state.visibleStart;
  for (const evt of cpuEvents) {
    if (evt.timestamp_ns < state.visibleStart || evt.timestamp_ns > state.visibleEnd) continue;
    const bin = Math.floor(
      ((evt.timestamp_ns - state.visibleStart) / visibleRange) * binCount,
    );
    if (bin >= 0 && bin < binCount) {
      bins[bin]++;
    }
  }

  // Find max for normalization
  let maxBin = 0;
  for (let i = 0; i < binCount; i++) {
    if (bins[i] > maxBin) maxBin = bins[i];
  }
  if (maxBin === 0) return;

  // Render filled area chart
  ctx.fillStyle = COLORS.cpu;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(LABEL_WIDTH, y + TRACK_HEIGHT);

  for (let i = 0; i < binCount; i++) {
    const x = LABEL_WIDTH + i;
    const h = (bins[i] / maxBin) * (TRACK_HEIGHT - 4);
    ctx.lineTo(x, y + TRACK_HEIGHT - h);
  }

  ctx.lineTo(LABEL_WIDTH + binCount, y + TRACK_HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function renderMemoryTrack(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  memEvents: MemoryEvent[],
  trackIndex: number,
): void {
  const y = renderTrackBackground(ctx, state, trackIndex);
  renderTrackLabel(ctx, "Memory", y);

  if (memEvents.length === 0) return;

  // Filter visible events and sort by timestamp
  const visible = memEvents
    .filter((e) => e.timestamp_ns >= state.visibleStart && e.timestamp_ns <= state.visibleEnd)
    .sort((a, b) => a.timestamp_ns - b.timestamp_ns);

  if (visible.length === 0) return;

  // Find max for normalization
  let maxBytes = 0;
  for (const evt of visible) {
    if (evt.live_bytes > maxBytes) maxBytes = evt.live_bytes;
  }
  if (maxBytes === 0) return;

  const trackAreaWidth = state.width - LABEL_WIDTH;
  const visibleRange = state.visibleEnd - state.visibleStart;

  // Render line graph
  ctx.strokeStyle = COLORS.memory;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let i = 0; i < visible.length; i++) {
    const evt = visible[i];
    const x =
      LABEL_WIDTH +
      ((evt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth;
    const h = (evt.live_bytes / maxBytes) * (TRACK_HEIGHT - 8);
    const py = y + TRACK_HEIGHT - 4 - h;

    if (i === 0) {
      ctx.moveTo(x, py);
    } else {
      ctx.lineTo(x, py);
    }
  }

  ctx.stroke();

  // Fill under the line
  if (visible.length > 1) {
    const lastEvt = visible[visible.length - 1];
    const lastX =
      LABEL_WIDTH +
      ((lastEvt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth;
    const firstEvt = visible[0];
    const firstX =
      LABEL_WIDTH +
      ((firstEvt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth;

    ctx.lineTo(lastX, y + TRACK_HEIGHT);
    ctx.lineTo(firstX, y + TRACK_HEIGHT);
    ctx.closePath();
    ctx.fillStyle = COLORS.memory;
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

function renderHitchTrack(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  hitchEvents: HitchEvent[],
  trackIndex: number,
): void {
  const y = renderTrackBackground(ctx, state, trackIndex);
  renderTrackLabel(ctx, "Hitches", y);

  if (hitchEvents.length === 0) return;

  const trackAreaWidth = state.width - LABEL_WIDTH;
  const visibleRange = state.visibleEnd - state.visibleStart;
  const barHeight = TRACK_HEIGHT / 2;
  const barY = y + (TRACK_HEIGHT - barHeight) / 2;

  for (const evt of hitchEvents) {
    if (evt.timestamp_ns > state.visibleEnd) continue;
    const endNs = evt.timestamp_ns + evt.duration_ms * 1_000_000;
    if (endNs < state.visibleStart) continue;

    const x1 = Math.max(
      LABEL_WIDTH,
      LABEL_WIDTH +
        ((evt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth,
    );
    const x2 = Math.min(
      state.width,
      LABEL_WIDTH + ((endNs - state.visibleStart) / visibleRange) * trackAreaWidth,
    );
    const barWidth = Math.max(2, x2 - x1);

    // Color by severity
    if (evt.severity === "severe_hang") {
      ctx.fillStyle = COLORS.hitchRed;
    } else if (evt.duration_ms > 100) {
      ctx.fillStyle = COLORS.hitchYellow;
    } else {
      ctx.fillStyle = COLORS.hitchGreen;
    }

    ctx.globalAlpha = 0.85;
    ctx.fillRect(x1, barY, barWidth, barHeight);
    ctx.globalAlpha = 1.0;
  }
}

function renderGpuTrack(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  gpuUtilEvents: GpuUtilEvent[],
  gpuCmdBufEvents: GpuCmdBufEvent[],
  trackIndex: number,
): void {
  const y = renderTrackBackground(ctx, state, trackIndex);
  renderTrackLabel(ctx, "GPU", y);

  const trackAreaWidth = state.width - LABEL_WIDTH;
  const visibleRange = state.visibleEnd - state.visibleStart;

  // Render utilization as area chart
  const visibleUtil = gpuUtilEvents
    .filter((e) => e.timestamp_ns >= state.visibleStart && e.timestamp_ns <= state.visibleEnd)
    .sort((a, b) => a.timestamp_ns - b.timestamp_ns);

  if (visibleUtil.length > 0) {
    const areaHeight = TRACK_HEIGHT - 20; // Leave room for command buffers below

    ctx.fillStyle = COLORS.gpu;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, y + areaHeight);

    for (const evt of visibleUtil) {
      const x =
        LABEL_WIDTH +
        ((evt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth;
      const h = (evt.utilization_pct / 100) * (areaHeight - 4);
      ctx.lineTo(x, y + areaHeight - h);
    }

    const lastEvt = visibleUtil[visibleUtil.length - 1];
    const lastX =
      LABEL_WIDTH +
      ((lastEvt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth;
    ctx.lineTo(lastX, y + areaHeight);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Stroke line on top
    ctx.strokeStyle = COLORS.gpu;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < visibleUtil.length; i++) {
      const evt = visibleUtil[i];
      const x =
        LABEL_WIDTH +
        ((evt.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth;
      const h = (evt.utilization_pct / 100) * (areaHeight - 4);
      if (i === 0) {
        ctx.moveTo(x, y + areaHeight - h);
      } else {
        ctx.lineTo(x, y + areaHeight - h);
      }
    }
    ctx.stroke();
  }

  // Render command buffers as small horizontal bars below utilization
  const cmdBarY = y + TRACK_HEIGHT - 16;
  const cmdBarHeight = 10;

  for (const evt of gpuCmdBufEvents) {
    if (evt.gpu_start_ns > state.visibleEnd) continue;
    if (evt.gpu_end_ns < state.visibleStart) continue;

    const x1 = Math.max(
      LABEL_WIDTH,
      LABEL_WIDTH +
        ((evt.gpu_start_ns - state.visibleStart) / visibleRange) * trackAreaWidth,
    );
    const x2 = Math.min(
      state.width,
      LABEL_WIDTH +
        ((evt.gpu_end_ns - state.visibleStart) / visibleRange) * trackAreaWidth,
    );
    const barWidth = Math.max(2, x2 - x1);

    ctx.fillStyle = COLORS.gpu;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x1, cmdBarY, barWidth, cmdBarHeight);
    ctx.globalAlpha = 1.0;
  }
}

function renderSignpostTrack(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  signpostEvents: SignpostEvent[],
  trackIndex: number,
): void {
  const y = renderTrackBackground(ctx, state, trackIndex);
  renderTrackLabel(ctx, "Signposts", y);

  if (signpostEvents.length === 0) return;

  const trackAreaWidth = state.width - LABEL_WIDTH;
  const visibleRange = state.visibleEnd - state.visibleStart;

  // Match begin/end pairs by signpost_id
  const beginMap = new Map<string, SignpostEvent>();
  const intervals: { begin: SignpostEvent; end: SignpostEvent }[] = [];

  for (const evt of signpostEvents) {
    if (evt.event === "begin") {
      beginMap.set(evt.signpost_id, evt);
    } else if (evt.event === "end") {
      const begin = beginMap.get(evt.signpost_id);
      if (begin) {
        intervals.push({ begin, end: evt });
        beginMap.delete(evt.signpost_id);
      }
    }
  }

  const barHeight = 24;
  const barY = y + (TRACK_HEIGHT - barHeight) / 2;

  // Simple lane assignment to avoid overlapping bars
  const lanes: number[] = []; // end timestamps per lane
  for (const interval of intervals) {
    if (interval.begin.timestamp_ns > state.visibleEnd) continue;
    if (interval.end.timestamp_ns < state.visibleStart) continue;

    const x1 = Math.max(
      LABEL_WIDTH,
      LABEL_WIDTH +
        ((interval.begin.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth,
    );
    const x2 = Math.min(
      state.width,
      LABEL_WIDTH +
        ((interval.end.timestamp_ns - state.visibleStart) / visibleRange) * trackAreaWidth,
    );
    const barWidth = Math.max(2, x2 - x1);

    // Find a free lane
    let lane = 0;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] <= interval.begin.timestamp_ns) {
        lane = i;
        break;
      }
      lane = i + 1;
    }
    lanes[lane] = interval.end.timestamp_ns;

    const laneOffset = lane * (barHeight + 2);
    const currentBarY = barY + laneOffset;

    // Don't render if it goes beyond the track
    if (currentBarY + barHeight > y + TRACK_HEIGHT) continue;

    ctx.fillStyle = COLORS.signpost;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x1, currentBarY, barWidth, barHeight);
    ctx.globalAlpha = 1.0;

    // Label inside bar
    if (barWidth > 30) {
      ctx.fillStyle = COLORS.textBright;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      ctx.save();
      ctx.beginPath();
      ctx.rect(x1, currentBarY, barWidth, barHeight);
      ctx.clip();
      ctx.fillText(interval.begin.name, x1 + 4, currentBarY + barHeight / 2);
      ctx.restore();
    }
  }
}

export function renderTimeline(
  ctx: CanvasRenderingContext2D,
  state: TimelineState,
  events: TraceEvent[],
): void {
  // Clear entire canvas
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, state.width, state.height);

  // Label area background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, LABEL_WIDTH, state.height);

  // Separate events by type
  const cpuEvents: CpuSampleEvent[] = [];
  const memEvents: MemoryEvent[] = [];
  const hitchEvents: HitchEvent[] = [];
  const gpuUtilEvents: GpuUtilEvent[] = [];
  const gpuCmdBufEvents: GpuCmdBufEvent[] = [];
  const signpostEvents: SignpostEvent[] = [];

  for (const evt of events) {
    switch (evt.type) {
      case "cpu_sample":
        cpuEvents.push(evt);
        break;
      case "memory":
        memEvents.push(evt);
        break;
      case "hitch":
        hitchEvents.push(evt);
        break;
      case "gpu_utilization":
        gpuUtilEvents.push(evt);
        break;
      case "gpu_command_buffer":
        gpuCmdBufEvents.push(evt);
        break;
      case "signpost":
        signpostEvents.push(evt);
        break;
    }
  }

  // Render ruler
  renderRuler(ctx, state);

  // Render tracks
  let trackIndex = 0;
  renderCpuTrack(ctx, state, cpuEvents, trackIndex++);
  renderMemoryTrack(ctx, state, memEvents, trackIndex++);
  renderHitchTrack(ctx, state, hitchEvents, trackIndex++);
  renderGpuTrack(ctx, state, gpuUtilEvents, gpuCmdBufEvents, trackIndex++);
  renderSignpostTrack(ctx, state, signpostEvents, trackIndex++);

  // Separator line between label area and track area
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LABEL_WIDTH - 0.5, 0);
  ctx.lineTo(LABEL_WIDTH - 0.5, state.height);
  ctx.stroke();
}

export { RULER_HEIGHT, TRACK_HEIGHT, TRACK_GAP, LABEL_WIDTH };
