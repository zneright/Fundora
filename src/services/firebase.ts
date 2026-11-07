/**
 * Fundora — Firebase Authentication & Firestore Initialization
 * Safely initializes Firebase when `VITE_FIREBASE_*` keys are provided,
 * and falls back gracefully in local/test environments.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { APP_CONFIG, isFirebaseConfigured } from '../configuration/config';
import { logger } from '../utils/logger';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    appInstance = getApps().length === 0 ? initializeApp(APP_CONFIG.firebase) : getApps()[0];
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    logger.info('Firebase', 'Initialized Firebase client connection.');
  } catch (err) {
    logger.warn('Firebase', 'Failed to initialize Firebase; using local store fallback.', err);
  }
}

export const firebaseApp = appInstance;
export const firebaseAuth = authInstance;
export const firestoreDb = dbInstance;
