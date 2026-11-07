import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, type LocalAuthSession } from '../services/auth.service';
import { userRepository } from '../repositories/user.repository';
import { registrationRepository } from '../repositories/registration.repository';
import type { RegistrationRecordDocument, UserProfile } from '../types';

interface AuthContextValue {
  session: LocalAuthSession | null;
  userProfile: UserProfile | null;
  registrationRecord: RegistrationRecordDocument | null;
  isAuthReady: boolean;
  refreshProfile: () => Promise<void>;
  setSessionAndProfile: (
    session: LocalAuthSession | null,
    profile?: UserProfile | null,
    regRecord?: RegistrationRecordDocument | null
  ) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  userProfile: null,
  registrationRecord: null,
  isAuthReady: false,
  refreshProfile: async () => {},
  setSessionAndProfile: () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<LocalAuthSession | null>(() =>
    authService.getCurrentSession()
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [registrationRecord, setRegistrationRecord] =
    useState<RegistrationRecordDocument | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const loadUserRecords = useCallback(async (uid: string) => {
    const [profile, reg] = await Promise.all([
      userRepository.getById(uid),
      registrationRepository.getByUid(uid),
    ]);
    setUserProfile(profile);
    setRegistrationRecord(reg);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const current = authService.getCurrentSession();
      if (current) {
        setSession(current);
        await loadUserRecords(current.uid);
      }
      if (active) {
        setIsAuthReady(true);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [loadUserRecords]);

  const refreshProfile = useCallback(async () => {
    const current = authService.getCurrentSession();
    setSession(current);
    if (current) {
      await loadUserRecords(current.uid);
    } else {
      setUserProfile(null);
      setRegistrationRecord(null);
    }
  }, [loadUserRecords]);

  const setSessionAndProfile = useCallback(
    (
      nextSession: LocalAuthSession | null,
      profile?: UserProfile | null,
      regRecord?: RegistrationRecordDocument | null
    ) => {
      authService.setCurrentSession(nextSession);
      setSession(nextSession);
      if (profile !== undefined) setUserProfile(profile);
      if (regRecord !== undefined) setRegistrationRecord(regRecord);
    },
    []
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setUserProfile(null);
    setRegistrationRecord(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        userProfile,
        registrationRecord,
        isAuthReady,
        refreshProfile,
        setSessionAndProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
