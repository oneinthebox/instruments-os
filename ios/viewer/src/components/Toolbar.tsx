import { useState, useEffect } from "react";
import type { Session } from "@/types";
import { fetchSessions } from "@/api/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ToolbarProps {
  selectedSession: string | null;
  onSelectSession: (sessionId: string | null) => void;
}

export function Toolbar({ selectedSession, onSelectSession }: ToolbarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let active = true;

    const poll = () => {
      fetchSessions()
        .then((data) => {
          if (active) setSessions(data);
        })
        .catch(() => {
          // Silently ignore fetch errors during polling
        });
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-select first session if none selected and sessions are available
  useEffect(() => {
    if (!selectedSession && sessions.length > 0) {
      onSelectSession(sessions[0].id);
    }
  }, [sessions, selectedSession, onSelectSession]);

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-background">
      <div className="flex items-center gap-3">
        <h1
          className="text-sm font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          InstrumentsOS
        </h1>
        <div className="h-4 w-px bg-border" />
        <Select
          value={selectedSession ?? undefined}
          onValueChange={(val) => onSelectSession(val ?? null)}
        >
          <SelectTrigger size="sm" className="w-[240px] text-xs">
            <SelectValue placeholder="Select session..." />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((session) => (
              <SelectItem key={session.id} value={session.id}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{session.app_name}</span>
                  <span className="text-muted-foreground">{session.device}</span>
                </span>
              </SelectItem>
            ))}
            {sessions.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                No sessions available
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {selectedSession && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {sessions.find((s) => s.id === selectedSession)?.event_count ?? 0} events
          </span>
        )}
      </div>
    </header>
  );
}
