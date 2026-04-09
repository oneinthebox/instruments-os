// Content block types for lesson content
export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'mermaid'; content: string }
  | { type: 'callout'; variant: 'info' | 'warning' | 'tip'; content: string }
  | { type: 'comparison-table'; headers: string[]; rows: string[][] };

export interface Lesson {
  id: string;
  title: string;
  moduleId: string;
  order: number;
  content: ContentBlock[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  moduleId: string;
  questions: QuizQuestion[];
  passingScore: number; // percentage, e.g. 70
  xpReward: number;
}

export interface Module {
  id: string;
  number: number;
  title: string;
  description: string;
  lessons: Lesson[];
  quiz: Quiz;
}
