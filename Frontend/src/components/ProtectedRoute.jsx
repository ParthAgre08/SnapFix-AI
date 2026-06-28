import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function ProtectedRoute({ children }) {
  const { user, loadingAuth } = useApp();

  if (loadingAuth) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
