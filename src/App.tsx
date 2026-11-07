import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { AuthProvider } from './contexts/AuthContext';
import { UniversalLoadingOverlay } from './components/UniversalLoadingOverlay';
import { AppRoutes } from './routes/AppRoutes';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LoadingProvider>
          <AuthProvider>
            <UniversalLoadingOverlay />
            <AppRoutes />
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
