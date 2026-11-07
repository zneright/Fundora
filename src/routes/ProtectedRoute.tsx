import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthPage } from '../views/auth/AuthPage';
import { SuspendedView } from '../views/auth/SuspendedView';
import { ExpiredNoticeView } from '../views/auth/ExpiredNoticeView';
import { isTermExpired } from '../utils/lifecycle';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { session, userProfile, signOut, refreshProfile } = useAuth();

  if (!session || !userProfile) {
    return <AuthPage onCompleteSuccess={() => void refreshProfile()} />;
  }

  if (userProfile.verificationStatus === 'suspended') {
    return <SuspendedView onSignOut={() => void signOut()} />;
  }

  if (
    userProfile.verificationStatus === 'expired' ||
    isTermExpired(userProfile.termEndsAt)
  ) {
    return (
      <ExpiredNoticeView
        termEndsAt={userProfile.termEndsAt}
        onRenewCredentials={() => void refreshProfile()}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    return (
      <div className="bank-card" style={{ maxWidth: 480, margin: '2rem auto', textAlign: 'center' }}>
        <h3 className="bank-card-title">Role Access Restricted</h3>
        <p className="text-secondary-sm" style={{ marginTop: '0.5rem' }}>
          Your current role (<strong>{userProfile.role}</strong>) is not authorized for this
          administrative desk.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
