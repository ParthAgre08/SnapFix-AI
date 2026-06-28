import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Report from './pages/Report';
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
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}