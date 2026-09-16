import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';

// Using BrowserRouter with wildcard fallback to root
export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root page: Welcome, quick start guide and big CTA to dispatcher */}
        <Route path="/" element={<WelcomePage />} />

        {/* Dispatcher Dashboard: Map, engineers, schedule, metrics, replan */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Catch-all route: redirects any unknown path back to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
