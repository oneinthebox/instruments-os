import type { Module } from './types';
import module1 from './modules/module1';
import module2 from './modules/module2';
import module3 from './modules/module3';
import module4 from './modules/module4';
import module5 from './modules/module5';

export const modules: Module[] = [module1, module2, module3, module4, module5];

export function getModule(moduleId: string): Module | undefined {
  return modules.find((m) => m.id === moduleId);
}

export function getLesson(moduleId: string, lessonId: string) {
  const mod = getModule(moduleId);
  return mod?.lessons.find((l) => l.id === lessonId);
}

export function getNextLesson(moduleId: string, lessonId: string) {
  const mod = getModule(moduleId);
  if (!mod) return null;
  const idx = mod.lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1 || idx >= mod.lessons.length - 1) return null;
  return mod.lessons[idx + 1];
}

export function getPrevLesson(moduleId: string, lessonId: string) {
  const mod = getModule(moduleId);
  if (!mod) return null;
  const idx = mod.lessons.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return null;
  return mod.lessons[idx - 1];
}

export function getNextModule(moduleId: string) {
  const idx = modules.findIndex((m) => m.id === moduleId);
  if (idx === -1 || idx >= modules.length - 1) return null;
  return modules[idx + 1];
}
