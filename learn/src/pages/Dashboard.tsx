import { Link } from 'react-router-dom';
import { modules } from '@/data/modules';
import {
  useModuleProgress,
  useModuleStatus,
  useXP,
  useIsModuleUnlocked,
} from '@/store/progress';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Zap } from 'lucide-react';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  locked: { label: 'Locked', variant: 'outline' },
  'in-progress': { label: 'In Progress', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'default' },
};

function ModuleCard({ moduleId }: { moduleId: string }) {
  const mod = modules.find((m) => m.id === moduleId)!;
  const { completed, total, percent } = useModuleProgress(moduleId);
  const status = useModuleStatus(moduleId);
  const unlocked = useIsModuleUnlocked(moduleId);
  const badge = STATUS_BADGE[status];

  const content = (
    <Card
      className={`relative transition-colors ${
        unlocked ? 'hover:ring-primary/30' : 'opacity-60'
      }`}
    >
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-primary" />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
              {mod.number}
            </span>
            <div>
              <CardTitle>{mod.title}</CardTitle>
              <CardDescription className="mt-0.5">
                {total} lessons
              </CardDescription>
            </div>
          </div>
          <Badge variant={badge.variant}>
            {status === 'locked' && <Lock className="mr-1 size-3" />}
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">{mod.description}</p>
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (!unlocked) {
    return <div className="cursor-not-allowed">{content}</div>;
  }

  // Link to first incomplete lesson, or module overview
  return (
    <Link to={`/module/${moduleId}/lesson/${mod.lessons[0].id}`} className="block">
      {content}
    </Link>
  );
}

export function Dashboard() {
  const xp = useXP();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5">
          <Zap className="size-4 text-amber-400" />
          <span className="font-mono text-sm font-medium text-amber-400">
            {xp} XP
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modules.map((mod) => (
          <ModuleCard key={mod.id} moduleId={mod.id} />
        ))}
      </div>
    </div>
  );
}
