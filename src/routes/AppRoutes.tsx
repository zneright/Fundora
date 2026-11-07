import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LandingView } from '../views/LandingView';
import { AuthPage } from '../views/auth/AuthPage';
import { MainLayout } from '../views/MainLayout';

export const AppRoutes: React.FC = () => {
  const { session, userProfile, refreshProfile } = useAuth();
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'workspace'>('landing');

  if (session && userProfile) {
    return <MainLayout />;
  }

  if (viewMode === 'auth') {
    return (
      <AuthPage
        onCompleteSuccess={() => {
          void refreshProfile();
          setViewMode('workspace');
        }}
      />
    );
  }

  return <LandingView onLaunchOnboarding={() => setViewMode('auth')} />;
};
