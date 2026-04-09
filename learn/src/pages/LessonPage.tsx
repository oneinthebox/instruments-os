import { useParams, useNavigate, Link } from 'react-router-dom';
import { getModule, getLesson, getNextLesson, getPrevLesson } from '@/data/modules';
import { ContentRenderer } from '@/components/ContentRenderer';
import {
  completeLesson,
  setCurrentPosition,
  useIsLessonCompleted,
} from '@/store/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { useEffect } from 'react';

export function LessonPage() {
  const { moduleId, lessonId } = useParams<{
    moduleId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();

  const mod = moduleId ? getModule(moduleId) : undefined;
  const lesson = moduleId && lessonId ? getLesson(moduleId, lessonId) : undefined;
  const isCompleted = useIsLessonCompleted(lessonId ?? '');

  const prevLesson = moduleId && lessonId ? getPrevLesson(moduleId, lessonId) : null;
  const nextLesson = moduleId && lessonId ? getNextLesson(moduleId, lessonId) : null;

  useEffect(() => {
    if (moduleId && lessonId) {
      setCurrentPosition(moduleId, lessonId);
    }
  }, [moduleId, lessonId]);

  if (!mod || !lesson) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Lesson not found.</p>
      </div>
    );
  }

  function handleMarkComplete() {
    if (!lessonId || !moduleId) return;
    completeLesson(lessonId);
    if (nextLesson) {
      navigate(`/module/${moduleId}/lesson/${nextLesson.id}`);
    } else {
      // Last lesson in module — go to quiz
      navigate(`/module/${moduleId}/quiz`);
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span>{mod.title}</span>
        <span>/</span>
        <span className="text-foreground">{lesson.title}</span>
      </div>

      {/* Lesson header */}
      <div className="mb-8">
        <span className="mb-1 block font-mono text-xs text-muted-foreground">
          Lesson {lesson.order} of {mod.lessons.length}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </div>

      {/* Content */}
      <ContentRenderer blocks={lesson.content} />

      {/* Navigation */}
      <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
        <div>
          {prevLesson ? (
            <Link
              to={`/module/${moduleId}/lesson/${prevLesson.id}`}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              {prevLesson.title}
            </Link>
          ) : (
            <span />
          )}
        </div>

        <div className="flex items-center gap-3">
          {isCompleted ? (
            <span className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle className="size-4" />
              Completed
            </span>
          ) : (
            <Button onClick={handleMarkComplete}>
              {nextLesson ? 'Complete & Continue' : 'Complete & Take Quiz'}
            </Button>
          )}

          {isCompleted && nextLesson && (
            <Link
              to={`/module/${moduleId}/lesson/${nextLesson.id}`}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {nextLesson.title}
              <ChevronRight className="size-4" />
            </Link>
          )}

          {isCompleted && !nextLesson && (
            <Link
              to={`/module/${moduleId}/quiz`}
              className="flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
            >
              Take Quiz
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
