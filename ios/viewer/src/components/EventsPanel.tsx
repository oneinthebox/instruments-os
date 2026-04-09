import type { TraceEvent } from "@/types";

interface EventsPanelProps {
  events: TraceEvent[];
}

const MAX_DISPLAY = 500;

function formatTimestamp(ns: number, baseNs: number): string {
  const ms = (ns - baseNs) / 1_000_000;
  return ms.toFixed(2);
}

function summarize(evt: TraceEvent): string {
  switch (evt.type) {
    case "cpu_sample":
      return evt.thread_name || `thread ${evt.thread_id}`;
    case "memory":
      return `${(evt.live_bytes / 1_048_576).toFixed(1)} MB`;
    case "hitch":
      return `${evt.duration_ms.toFixed(1)}ms`;
    case "gpu_command_buffer":
      return `${evt.gpu_duration_ms.toFixed(2)}ms`;
    case "gpu_utilization":
      return `${evt.utilization_pct.toFixed(0)}%`;
    case "gpu_memory":
      return `${(evt.allocated_bytes / 1_048_576).toFixed(1)} MB`;
    case "signpost":
      return evt.name;
  }
}

export function EventsPanel({ events }: EventsPanelProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#a1a1aa] font-mono text-sm">
        No events loaded
      </div>
    );
  }

  const baseNs = events[0].timestamp_ns;
  const displayEvents = events.slice(0, MAX_DISPLAY);
  const truncated = events.length > MAX_DISPLAY;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {truncated && (
        <div className="px-3 py-1.5 text-xs text-[#a1a1aa] border-b border-[#27272a] shrink-0">
          Showing first {MAX_DISPLAY} of {events.length.toLocaleString()} events
        </div>
      )}
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-[#09090b]">
            <tr className="text-[#a1a1aa] border-b border-[#27272a]">
              <th className="text-left px-3 py-1.5 font-medium w-24">Time (ms)</th>
              <th className="text-left px-3 py-1.5 font-medium w-36">Type</th>
              <th className="text-left px-3 py-1.5 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {displayEvents.map((evt, i) => (
              <tr
                key={i}
                className="border-b border-[#27272a]/50 hover:bg-[#18181b]"
              >
                <td className="px-3 py-1 text-[#a1a1aa]">
                  {formatTimestamp(evt.timestamp_ns, baseNs)}
                </td>
                <td className="px-3 py-1 text-[#fafafa]">{evt.type}</td>
                <td className="px-3 py-1 text-[#a1a1aa]">{summarize(evt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
