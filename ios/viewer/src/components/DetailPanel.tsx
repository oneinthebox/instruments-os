import type { TraceEvent } from "@/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EventsPanel } from "./EventsPanel";

interface DetailPanelProps {
  events: TraceEvent[];
}

export function DetailPanel({ events }: DetailPanelProps) {
  return (
    <div className="h-[300px] border-t border-[#27272a] bg-[#09090b] flex flex-col">
      <Tabs defaultValue="events" className="flex flex-col h-full gap-0">
        <TabsList
          variant="line"
          className="shrink-0 px-2 pt-1 pb-0 border-b border-[#27272a] bg-[#09090b] h-auto rounded-none"
        >
          <TabsTrigger value="events" className="text-xs px-3 py-1.5 rounded-none">
            Events
          </TabsTrigger>
          <TabsTrigger value="flamechart" className="text-xs px-3 py-1.5 rounded-none">
            Flame Chart
          </TabsTrigger>
          <TabsTrigger value="calltree" className="text-xs px-3 py-1.5 rounded-none">
            Call Tree
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="flex-1 overflow-hidden">
          <EventsPanel events={events} />
        </TabsContent>

        <TabsContent value="flamechart" className="flex-1 overflow-hidden">
          <div className="flex items-center justify-center h-full text-[#a1a1aa] font-mono text-sm px-4 text-center">
            Flame chart — select a time range with CPU samples to view call stacks
          </div>
        </TabsContent>

        <TabsContent value="calltree" className="flex-1 overflow-hidden">
          <div className="flex items-center justify-center h-full text-[#a1a1aa] font-mono text-sm px-4 text-center">
            Call tree — select a time range to see aggregated call stacks
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
