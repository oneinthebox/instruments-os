import type { Session, TraceEvent } from "@/types";

const BASE_URL = "http://localhost:8080";

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch(`${BASE_URL}/api/sessions`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sessions: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTimeline(
  sessionId: string,
  startNs?: number,
  endNs?: number,
): Promise<TraceEvent[]> {
  const params = new URLSearchParams();
  if (startNs !== undefined) params.set("start_ns", String(startNs));
  if (endNs !== undefined) params.set("end_ns", String(endNs));

  const query = params.toString();
  const url = `${BASE_URL}/api/sessions/${sessionId}/timeline${query ? `?${query}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch timeline: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchEvents(
  sessionId: string,
  type?: string,
): Promise<TraceEvent[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);

  const query = params.toString();
  const url = `${BASE_URL}/api/sessions/${sessionId}/events${query ? `?${query}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
