import React, { createContext, useContext, useState, useCallback } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  loadingMessage: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextValue>({
  isLoading: false,
  loadingMessage: '',
  showLoading: () => {},
  hideLoading: () => {},
});

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing request...');

  const showLoading = useCallback((message = 'Processing request...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, loadingMessage, showLoading, hideLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

export function useLoading(): LoadingContextValue {
  return useContext(LoadingContext);
}
