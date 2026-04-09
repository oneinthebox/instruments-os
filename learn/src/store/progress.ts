import { useSyncExternalStore, useCallback } from 'react';
import { modules } from '@/data/modules';

// --- Types ---

interface ProgressState {
  completedLessons: string[]; // lesson ids
  quizScores: Record<string, number>; // moduleId -> score percentage
  xp: number;
  currentModuleId: string;
  currentLessonId: string;
}

// --- Storage ---

const STORAGE_KEY = 'learn-progress';

function getDefaultState(): ProgressState {
  return {
    completedLessons: [],
    quizScores: {},
    xp: 0,
    currentModuleId: 'os-fundamentals',
    currentLessonId: 'processes-and-threads',
  };
}

function loadState(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...getDefaultState(), ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return getDefaultState();
}

function saveState(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Store (external store for useSyncExternalStore) ---

let state = loadState();
let listeners = new Set<() => void>();

function emitChange() {
  saveState(state);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

// --- Actions ---

export function completeLesson(lessonId: string) {
  if (state.completedLessons.includes(lessonId)) return;
  state = {
    ...state,
    completedLessons: [...state.completedLessons, lessonId],
    xp: state.xp + 10,
  };
  emitChange();
}

export function recordQuizScore(moduleId: string, score: number, xpEarned: number) {
  const prevScore = state.quizScores[moduleId] ?? 0;
  // Only add XP if this is a new pass or better score
  const addXp = score > prevScore ? xpEarned : 0;
  state = {
    ...state,
    quizScores: { ...state.quizScores, [moduleId]: Math.max(prevScore, score) },
    xp: state.xp + addXp,
  };
  emitChange();
}

export function setCurrentPosition(moduleId: string, lessonId: string) {
  state = {
    ...state,
    currentModuleId: moduleId,
    currentLessonId: lessonId,
  };
  emitChange();
}

// --- Hooks ---

export function useProgress() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useModuleProgress(moduleId: string) {
  const progress = useProgress();
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return { completed: 0, total: 0, percent: 0 };
  const completed = mod.lessons.filter((l) => progress.completedLessons.includes(l.id)).length;
  const total = mod.lessons.length;
  return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function useXP() {
  const progress = useProgress();
  return progress.xp;
}

export function useIsModuleUnlocked(moduleId: string) {
  const progress = useProgress();
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return false;
  // Module 1 is always unlocked
  if (mod.number === 1) return true;
  // Find the previous module
  const prevModule = modules.find((m) => m.number === mod.number - 1);
  if (!prevModule) return true;
  // Previous module's quiz must be passed (>= 70%)
  const prevScore = progress.quizScores[prevModule.id] ?? 0;
  return prevScore >= 70;
}

export function useIsLessonCompleted(lessonId: string) {
  const progress = useProgress();
  return progress.completedLessons.includes(lessonId);
}

export function useModuleStatus(moduleId: string): 'locked' | 'in-progress' | 'completed' {
  const progress = useProgress();
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return 'locked';

  // Check if unlocked
  if (mod.number > 1) {
    const prevModule = modules.find((m) => m.number === mod.number - 1);
    if (prevModule) {
      const prevScore = progress.quizScores[prevModule.id] ?? 0;
      if (prevScore < 70) return 'locked';
    }
  }

  // Check if all lessons completed and quiz passed
  const allLessonsComplete = mod.lessons.every((l) =>
    progress.completedLessons.includes(l.id)
  );
  const quizPassed = (progress.quizScores[moduleId] ?? 0) >= 70;

  if (allLessonsComplete && quizPassed) return 'completed';
  return 'in-progress';
}

export function useResetProgress() {
  return useCallback(() => {
    state = getDefaultState();
    emitChange();
  }, []);
}
