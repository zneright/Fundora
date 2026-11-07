import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LandingView } from '../views/LandingView';
import { AuthPage } from '../views/auth/AuthPage';
import { MainLayout } from '../views/MainLayout';
import { TransparencyHub } from '../components/TransparencyHub';

export const AppRoutes: React.FC = () => {
  const { session, userProfile, refreshProfile } = useAuth();
  const [viewMode, setViewMode] = useState<
    'landing' | 'auth' | 'workspace' | 'transparency'
  >('landing');

  if (session && userProfile) {
    return <MainLayout />;
  }

  if (viewMode === 'transparency') {
    return (
      <div className="banking-app-container page-enter" style={{ paddingTop: '1.5rem' }}>
        <TransparencyHub onBackToLanding={() => setViewMode('landing')} />
      </div>
    );
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

  return (
    <LandingView
      onLaunchOnboarding={() => setViewMode('auth')}
      onOpenTransparencyHub={() => setViewMode('transparency')}
    />
  );
};
