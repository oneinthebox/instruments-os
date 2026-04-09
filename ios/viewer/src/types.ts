export interface StackFrame {
  address: string;
  symbol: string | null;
}

export interface CpuSampleEvent {
  type: "cpu_sample";
  timestamp_ns: number;
  thread_id: number;
  thread_name: string;
  frames: StackFrame[];
}

export interface MemoryEvent {
  type: "memory";
  timestamp_ns: number;
  live_bytes: number;
  allocation_rate_bps: number;
  peak_bytes: number;
}

export interface HitchEvent {
  type: "hitch";
  timestamp_ns: number;
  duration_ms: number;
  severity: "micro_hang" | "severe_hang";
  main_thread_stack: StackFrame[];
}

export interface GpuCmdBufEvent {
  type: "gpu_command_buffer";
  timestamp_ns: number;
  label: string;
  gpu_start_ns: number;
  gpu_end_ns: number;
  gpu_duration_ms: number;
  encoder_type: string;
}

export interface GpuMemoryEvent {
  type: "gpu_memory";
  timestamp_ns: number;
  allocated_bytes: number;
  peak_bytes: number;
}

export interface GpuUtilEvent {
  type: "gpu_utilization";
  timestamp_ns: number;
  utilization_pct: number;
  vertex_count: number;
  fragment_count: number;
}

export interface SignpostEvent {
  type: "signpost";
  timestamp_ns: number;
  event: "begin" | "end" | "event";
  name: string;
  signpost_id: string;
}

export type TraceEvent =
  | CpuSampleEvent
  | MemoryEvent
  | HitchEvent
  | GpuCmdBufEvent
  | GpuMemoryEvent
  | GpuUtilEvent
  | SignpostEvent;

export interface Session {
  id: string;
  start_time_ns: number;
  device: string;
  app_name: string;
  event_count: number;
}

export interface TimeRange {
  start_ns: number;
  end_ns: number;
}
