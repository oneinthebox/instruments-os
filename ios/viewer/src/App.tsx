import { useState, useEffect } from "react";
import type { TraceEvent } from "./types";
import { fetchTimeline } from "./api/client";
import { Toolbar } from "./components/Toolbar";
import { TimelineView } from "./components/TimelineView";

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      return;
    }
    fetchTimeline(sessionId).then(setEvents);
  }, [sessionId]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <Toolbar selectedSession={sessionId} onSelectSession={setSessionId} />
      <div className="flex-1 overflow-hidden">
        <TimelineView events={events} />
      </div>
    </div>
  );
}
