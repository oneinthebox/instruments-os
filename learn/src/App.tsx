import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar, MobileSidebar } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { LessonPage } from '@/pages/LessonPage';
import { QuizPage } from '@/pages/QuizPage';

export default function App() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Sidebar />
      <MobileSidebar />

      <main className="min-h-dvh md:pl-60">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/module/:moduleId"
            element={<Navigate to="/" replace />}
          />
          <Route
            path="/module/:moduleId/lesson/:lessonId"
            element={<LessonPage />}
          />
          <Route path="/module/:moduleId/quiz" element={<QuizPage />} />
        </Routes>
      </main>
    </div>
  );
}
