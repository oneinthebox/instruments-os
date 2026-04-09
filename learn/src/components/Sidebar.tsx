import { Link, useParams } from 'react-router-dom';
import { modules } from '@/data/modules';
import {
  useModuleProgress,
  useIsModuleUnlocked,
  useProgress,
} from '@/store/progress';
import {
  BookOpen,
  Lock,
  ChevronDown,
  ChevronRight,
  Cpu,
  Activity,
  Globe,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const MODULE_ICONS: Record<string, React.ElementType> = {
  'mod-1': Cpu,
  'mod-2': Activity,
  'mod-3': Globe,
  'mod-4': Smartphone,
  'mod-5': Laptop,
};

function ModuleProgressBar({ moduleId }: { moduleId: string }) {
  const { percent } = useModuleProgress(moduleId);
  return (
    <div className="mt-1 h-0.5 w-full rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function SidebarModule({ moduleId }: { moduleId: string }) {
  const mod = modules.find((m) => m.id === moduleId)!;
  const { moduleId: activeModuleId, lessonId: activeLessonId } = useParams();
  const unlocked = useIsModuleUnlocked(moduleId);
  const progress = useProgress();
  const isActive = activeModuleId === moduleId;
  const [expanded, setExpanded] = useState(isActive);

  const Icon = MODULE_ICONS[moduleId] ?? BookOpen;

  if (!unlocked) {
    return (
      <div className="px-3 py-2 opacity-40">
        <div className="flex items-center gap-2">
          <Lock className="size-4 shrink-0" />
          <span className="truncate text-sm">{mod.title}</span>
        </div>
        <ModuleProgressBar moduleId={moduleId} />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50',
          isActive && 'text-foreground'
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium">{mod.title}</span>
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      <ModuleProgressBar moduleId={moduleId} />

      {expanded && (
        <div className="pb-1">
          {mod.lessons.map((lesson) => {
            const isCompleted = progress.completedLessons.includes(lesson.id);
            const isCurrentLesson =
              activeModuleId === moduleId && activeLessonId === lesson.id;

            return (
              <Link
                key={lesson.id}
                to={`/module/${moduleId}/lesson/${lesson.id}`}
                className={cn(
                  'flex items-center gap-2 py-1.5 pl-9 pr-3 text-sm transition-colors',
                  isCurrentLesson
                    ? 'border-l-2 border-primary bg-primary/5 text-foreground'
                    : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    isCompleted
                      ? 'bg-primary'
                      : isCurrentLesson
                        ? 'bg-primary/60'
                        : 'bg-muted-foreground/30'
                  )}
                />
                <span className="truncate">{lesson.title}</span>
              </Link>
            );
          })}
          <Link
            to={`/module/${moduleId}/quiz`}
            className={cn(
              'flex items-center gap-2 py-1.5 pl-9 pr-3 text-sm transition-colors',
              activeModuleId === moduleId && !activeLessonId
                ? 'border-l-2 border-primary bg-primary/5 text-foreground'
                : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
            <span className="truncate">Quiz</span>
            {(progress.quizScores[moduleId] ?? 0) >= 70 && (
              <span className="ml-auto text-xs text-primary">
                {progress.quizScores[moduleId]}%
              </span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-60 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <BookOpen className="size-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          instruments-os
        </span>
      </div>

      <ScrollArea className="flex-1">
        <nav className="py-2">
          {modules.map((mod) => (
            <SidebarModule key={mod.id} moduleId={mod.id} />
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-border px-4 py-3">
        <Link
          to="/"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
        </Link>
      </div>
    </aside>
  );
}

// Compact sidebar for mobile
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 flex size-9 items-center justify-center rounded-lg bg-card ring-1 ring-foreground/10 md:hidden"
        aria-label="Open navigation"
      >
        <BookOpen className="size-4 text-primary" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 h-dvh w-60 flex-col border-r border-border bg-card md:hidden flex">
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <span className="text-sm font-semibold tracking-tight">
                  instruments-os
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close navigation"
              >
                &times;
              </button>
            </div>

            <ScrollArea className="flex-1">
              <nav className="py-2" onClick={() => setOpen(false)}>
                {modules.map((mod) => (
                  <SidebarModule key={mod.id} moduleId={mod.id} />
                ))}
              </nav>
            </ScrollArea>

            <div className="border-t border-border px-4 py-3">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
