import { useParams, useNavigate, Link } from 'react-router-dom';
import { getModule, getNextModule } from '@/data/modules';
import { recordQuizScore, useProgress } from '@/store/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { ChevronLeft, Zap } from 'lucide-react';

interface AnswerState {
  [questionId: string]: {
    selected: number;
    correct: boolean;
  };
}

export function QuizPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const progress = useProgress();
  const mod = moduleId ? getModule(moduleId) : undefined;
  const [answers, setAnswers] = useState<AnswerState>({});

  if (!mod) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Module not found.</p>
      </div>
    );
  }

  const quiz = mod.quiz;
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQuestions;
  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const scorePercent = allAnswered
    ? Math.round((correctCount / totalQuestions) * 100)
    : 0;
  const passed = scorePercent >= quiz.passingScore;
  const nextMod = moduleId ? getNextModule(moduleId) : null;

  // Check if quiz was already recorded this session
  const prevScore = progress.quizScores[mod.id] ?? 0;

  function handleAnswer(questionId: string, selectedIndex: number) {
    if (!mod) return;
    if (answers[questionId]) return; // Already answered
    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question) return;

    const correct = selectedIndex === question.correctIndex;
    const newAnswers = {
      ...answers,
      [questionId]: { selected: selectedIndex, correct },
    };
    setAnswers(newAnswers);

    // If all answered, record score
    const newAnsweredCount = Object.keys(newAnswers).length;
    if (newAnsweredCount === totalQuestions) {
      const newCorrectCount = Object.values(newAnswers).filter(
        (a) => a.correct
      ).length;
      const newScore = Math.round((newCorrectCount / totalQuestions) * 100);
      if (newScore > prevScore) {
        recordQuizScore(mod.id, newScore, quiz.xpReward);
      }
    }
  }

  function handleRetry() {
    setAnswers({});
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
        <span className="text-foreground">Quiz</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mod.title} — Quiz
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalQuestions} questions. {quiz.passingScore}% to pass.
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {quiz.questions.map((q, qi) => {
          const answer = answers[q.id];
          const isAnswered = !!answer;

          return (
            <div
              key={q.id}
              className={cn(
                'rounded-lg border-l-2 p-4 ring-1 ring-foreground/5',
                isAnswered && answer.correct && 'border-l-green-500 bg-green-500/5',
                isAnswered && !answer.correct && 'border-l-red-500/60 bg-red-500/5',
                !isAnswered && 'border-l-transparent'
              )}
            >
              <p className="mb-3 text-sm font-medium text-foreground">
                <span className="mr-2 font-mono text-muted-foreground">
                  {qi + 1}.
                </span>
                {q.question}
              </p>

              <RadioGroup
                value={isAnswered ? String(answer.selected) : undefined}
                onValueChange={(val) => {
                  handleAnswer(q.id, Number(val));
                }}
                disabled={isAnswered}
              >
                {q.options.map((option, oi) => {
                  const isSelected = isAnswered && answer.selected === oi;
                  const isCorrectOption = oi === q.correctIndex;

                  return (
                    <label
                      key={oi}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        !isAnswered && 'hover:bg-muted/50',
                        isAnswered && isSelected && answer.correct && 'text-green-400',
                        isAnswered && isSelected && !answer.correct && 'text-red-400',
                        isAnswered && !isSelected && isCorrectOption && 'text-green-400',
                        isAnswered && !isSelected && !isCorrectOption && 'text-muted-foreground',
                        isAnswered && 'cursor-default'
                      )}
                    >
                      <RadioGroupItem value={String(oi)} disabled={isAnswered} />
                      <span>{option}</span>
                      {isAnswered && isCorrectOption && (
                        <span className="ml-auto text-xs text-green-500">Correct</span>
                      )}
                    </label>
                  );
                })}
              </RadioGroup>

              {/* Explanation */}
              {isAnswered && (
                <div
                  className={cn(
                    'mt-3 rounded-md px-3 py-2 text-sm',
                    answer.correct
                      ? 'bg-green-500/5 text-green-300/80'
                      : 'bg-red-500/5 text-foreground/70'
                  )}
                >
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Score summary */}
      {allAnswered && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">
                Score: {scorePercent}%
              </p>
              <p className="text-sm text-muted-foreground">
                {correctCount} of {totalQuestions} correct
              </p>
            </div>
            {passed && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5">
                <Zap className="size-4 text-amber-400" />
                <span className="font-mono text-sm font-medium text-amber-400">
                  +{quiz.xpReward} XP
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            {passed && nextMod && (
              <Button
                onClick={() => {
                  navigate(
                    `/module/${nextMod.id}/lesson/${nextMod.lessons[0].id}`
                  );
                }}
              >
                Continue to {nextMod.title}
              </Button>
            )}
            {passed && !nextMod && (
              <Button onClick={() => navigate('/')}>
                Back to Dashboard
              </Button>
            )}
            {!passed && (
              <>
                <Button onClick={handleRetry}>Retry Quiz</Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    navigate(
                      `/module/${mod.id}/lesson/${mod.lessons[0].id}`
                    )
                  }
                >
                  Review Lessons
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          to={`/module/${mod.id}/lesson/${mod.lessons[mod.lessons.length - 1].id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to lessons
        </Link>
      </div>
    </div>
  );
}
