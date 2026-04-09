const MIN_VISIBLE_RANGE_NS = 1_000_000; // 1ms

export class TimelineState {
  visibleStart: number;
  visibleEnd: number;
  width: number;
  height: number;
  dataStart: number;
  dataEnd: number;

  constructor(
    dataStart: number,
    dataEnd: number,
    width: number,
    height: number,
  ) {
    this.dataStart = dataStart;
    this.dataEnd = dataEnd;
    this.visibleStart = dataStart;
    this.visibleEnd = dataEnd;
    this.width = width;
    this.height = height;
  }

  get visibleDurationMs(): number {
    return (this.visibleEnd - this.visibleStart) / 1_000_000;
  }

  nsToX(ns: number): number {
    const range = this.visibleEnd - this.visibleStart;
    if (range === 0) return 0;
    return ((ns - this.visibleStart) / range) * this.width;
  }

  xToNs(x: number): number {
    const range = this.visibleEnd - this.visibleStart;
    return this.visibleStart + (x / this.width) * range;
  }

  zoom(centerX: number, factor: number): void {
    const centerNs = this.xToNs(centerX);
    const currentRange = this.visibleEnd - this.visibleStart;
    let newRange = currentRange * factor;

    // Enforce minimum range of 1ms
    if (newRange < MIN_VISIBLE_RANGE_NS) {
      newRange = MIN_VISIBLE_RANGE_NS;
    }

    // Enforce maximum range to data bounds
    const dataRange = this.dataEnd - this.dataStart;
    if (newRange > dataRange) {
      newRange = dataRange;
    }

    // Compute new bounds centered on the cursor position
    const ratio = (centerNs - this.visibleStart) / currentRange;
    let newStart = centerNs - ratio * newRange;
    let newEnd = centerNs + (1 - ratio) * newRange;

    // Clamp to data bounds
    if (newStart < this.dataStart) {
      newStart = this.dataStart;
      newEnd = newStart + newRange;
    }
    if (newEnd > this.dataEnd) {
      newEnd = this.dataEnd;
      newStart = newEnd - newRange;
    }

    // Final clamp in case range exceeds data
    newStart = Math.max(newStart, this.dataStart);
    newEnd = Math.min(newEnd, this.dataEnd);

    this.visibleStart = newStart;
    this.visibleEnd = newEnd;
  }

  pan(deltaX: number): void {
    const range = this.visibleEnd - this.visibleStart;
    const deltaNs = (deltaX / this.width) * range;

    let newStart = this.visibleStart - deltaNs;
    let newEnd = this.visibleEnd - deltaNs;

    // Clamp to data bounds
    if (newStart < this.dataStart) {
      newStart = this.dataStart;
      newEnd = newStart + range;
    }
    if (newEnd > this.dataEnd) {
      newEnd = this.dataEnd;
      newStart = newEnd - range;
    }

    this.visibleStart = newStart;
    this.visibleEnd = newEnd;
  }
}
