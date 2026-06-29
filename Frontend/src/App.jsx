import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Report from './pages/Report';
import OfficerLogin from './pages/OfficerLogin';
import OfficerDashboard from './pages/OfficerDashboard';
import CommunityFeedPage from './pages/CommunityFeedPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/officer/login" element={<OfficerLogin />} />
          <Route path="/officer/dashboard" element={<OfficerDashboard />} />
          <Route path="/community" element={<CommunityFeedPage />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}