import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  auth,
  formatReadableFirebaseError,
  signInWithGooglePopup,
  signOutFirebase,
} from '../firebase';
import {
  deleteCloudCases,
  ensureUserProfileDoc,
  pushAllLocalCasesToCloud,
  subscribeUserCases,
  updateUserProfilePrefs,
  upsertCloudCases,
  UserProfilePrefs,
} from '../utils/cloudSync';
import {
  registerCloudSyncBridge,
  resetCloudSyncTracking,
} from '../utils/savedCasesStorage';
import { SavedCaseRecord as CaseRecord } from '../types';

export type CloudSyncStatus = 'signed_out' | 'syncing' | 'synced' | 'error';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  syncError: string | null;
  cloudCaseCount: number;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncProfileSettings: (prefs: UserProfilePrefs) => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function readLocalOfficerPrefs(): UserProfilePrefs {
  try {
    return {
      officerName: localStorage.getItem('ncap_officer_name') ?? undefined,
      officerCode: localStorage.getItem('ncap_officer_code') ?? undefined,
      officerLicense: localStorage.getItem('ncap_officer_license') ?? undefined,
      dealerName:
        localStorage.getItem('ncap_dealer_name') ??
        localStorage.getItem('ncap_dv_dealer') ??
        undefined,
    };
  } catch {
    return {};
  }
}

function applyCloudOfficerPrefsIfLocalMissing(cloudPrefs: UserProfilePrefs): void {
  let changed = false;
  try {
    if (cloudPrefs.officerName && !localStorage.getItem('ncap_officer_name')) {
      localStorage.setItem('ncap_officer_name', cloudPrefs.officerName);
      changed = true;
    }
    if (cloudPrefs.officerCode && !localStorage.getItem('ncap_officer_code')) {
      localStorage.setItem('ncap_officer_code', cloudPrefs.officerCode);
      changed = true;
    }
    if (cloudPrefs.officerLicense && !localStorage.getItem('ncap_officer_license')) {
      localStorage.setItem('ncap_officer_license', cloudPrefs.officerLicense);
      changed = true;
    }
    if (cloudPrefs.dealerName && !localStorage.getItem('ncap_dealer_name')) {
      localStorage.setItem('ncap_dealer_name', cloudPrefs.dealerName);
      localStorage.setItem('ncap_dv_dealer', cloudPrefs.dealerName);
      changed = true;
    }
  } catch {
    // ignore storage errors
  }
  if (changed && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ncap-profile-synced', { detail: cloudPrefs }));
  }
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('signed_out');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cloudCaseCount, setCloudCaseCount] = useState(0);

  const cloudCreatedAtMapRef = useRef<Map<string, Timestamp>>(new Map());
  const cloudRecordCreatedAtMapRef = useRef<Map<string, number>>(new Map());
  const profileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUserRef = useRef<User | null>(null);
  const unsubscribeCasesRef = useRef<(() => void) | null>(null);

  const attachBridgeAndSubscription = useCallback(async (targetUser: User, forceTokenRefresh = false) => {
    setSyncStatus('syncing');
    setSyncError(null);

    if (forceTokenRefresh) {
      try {
        await targetUser.getIdToken(true);
      } catch {
        // proceed with existing token if offline
      }
    }

    const localPrefs = readLocalOfficerPrefs();
    const cloudPrefs = await ensureUserProfileDoc(targetUser, localPrefs);
    applyCloudOfficerPrefsIfLocalMissing(cloudPrefs);

    // Register real-time local -> cloud write hooks
    registerCloudSyncBridge({
      upsertCases: (records: CaseRecord[]) => {
        setSyncStatus('syncing');
        upsertCloudCases(
          targetUser.uid,
          records,
          cloudCreatedAtMapRef.current,
          cloudRecordCreatedAtMapRef.current
        )
          .then(() => {
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
            setSyncError(null);
          })
          .catch((err) => {
            setSyncStatus('error');
            setSyncError(formatReadableFirebaseError(err));
          });
      },
      deleteCases: (ids: string[]) => {
        setSyncStatus('syncing');
        deleteCloudCases(
          targetUser.uid,
          ids,
          cloudCreatedAtMapRef.current,
          cloudRecordCreatedAtMapRef.current
        )
          .then(() => {
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
            setSyncError(null);
          })
          .catch((err) => {
            setSyncStatus('error');
            setSyncError(formatReadableFirebaseError(err));
          });
      },
    });

    // Push any existing local cases that aren't in cloud yet
    let pushErr: unknown = null;
    try {
      await pushAllLocalCasesToCloud(
        targetUser.uid,
        cloudCreatedAtMapRef.current,
        cloudRecordCreatedAtMapRef.current
      );
    } catch (err) {
      pushErr = err;
    }

    if (unsubscribeCasesRef.current) {
      unsubscribeCasesRef.current();
      unsubscribeCasesRef.current = null;
    }

    // Attach real-time Firestore listener (only when auth is ready & authenticated)
    unsubscribeCasesRef.current = subscribeUserCases(
      targetUser.uid,
      cloudCreatedAtMapRef.current,
      cloudRecordCreatedAtMapRef.current,
      (cases, fromCache, cloudCount) => {
        setCloudCaseCount(cloudCount);
        if (pushErr) {
          setSyncStatus('error');
          setSyncError(formatReadableFirebaseError(pushErr));
        } else {
          setSyncStatus('synced');
          if (!fromCache || cases.length > 0) {
            setLastSyncedAt(Date.now());
          }
          setSyncError(null);
        }
      },
      (err) => {
        setSyncStatus('error');
        setSyncError(formatReadableFirebaseError(err));
      }
    );

    if (pushErr) {
      throw pushErr;
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubscribeCasesRef.current) {
        unsubscribeCasesRef.current();
        unsubscribeCasesRef.current = null;
      }
      cloudCreatedAtMapRef.current.clear();
      cloudRecordCreatedAtMapRef.current.clear();

      if (!nextUser || !nextUser.email || !nextUser.emailVerified) {
        activeUserRef.current = null;
        resetCloudSyncTracking();
        setUser(null);
        setSyncStatus('signed_out');
        setSyncError(null);
        setCloudCaseCount(0);
        registerCloudSyncBridge(null);
        setAuthReady(true);
        return;
      }

      if (activeUserRef.current?.uid !== nextUser.uid) {
        resetCloudSyncTracking();
      }

      activeUserRef.current = nextUser;
      setUser(nextUser);
      setAuthReady(true);

      try {
        await attachBridgeAndSubscription(nextUser);
      } catch (err) {
        setSyncStatus('error');
        setSyncError(formatReadableFirebaseError(err));
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCasesRef.current) {
        unsubscribeCasesRef.current();
        unsubscribeCasesRef.current = null;
      }
      registerCloudSyncBridge(null);
    };
  }, [attachBridgeAndSubscription]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsSigningIn(true);
    setSyncError(null);
    try {
      await signInWithGooglePopup();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user') && !msg.includes('cancelled-popup-request')) {
        setSyncError('ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง');
      }
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (unsubscribeCasesRef.current) {
      unsubscribeCasesRef.current();
      unsubscribeCasesRef.current = null;
    }
    registerCloudSyncBridge(null);
    resetCloudSyncTracking();
    await signOutFirebase();
    setUser(null);
    setSyncStatus('signed_out');
    setLastSyncedAt(null);
    setSyncError(null);
  }, []);

  const syncNow = useCallback(async () => {
    const currentUser = activeUserRef.current || auth.currentUser;
    if (!currentUser) return;
    try {
      await attachBridgeAndSubscription(currentUser, true);
      setSyncStatus('synced');
      setLastSyncedAt(Date.now());
      setSyncError(null);
    } catch (err) {
      setSyncStatus('error');
      setSyncError(formatReadableFirebaseError(err));
    }
  }, [attachBridgeAndSubscription]);

  const syncProfileSettings = useCallback((prefs: UserProfilePrefs) => {
    const currentUser = activeUserRef.current;
    if (!currentUser) return;
    if (profileDebounceRef.current) {
      clearTimeout(profileDebounceRef.current);
    }
    profileDebounceRef.current = setTimeout(() => {
      updateUserProfilePrefs(currentUser, prefs).catch((err) => {
        console.error('Failed to sync profile prefs:', err);
      });
    }, 800);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        isSigningIn,
        syncStatus,
        lastSyncedAt,
        syncError,
        cloudCaseCount,
        signInWithGoogle,
        signOut: handleSignOut,
        syncNow,
        syncProfileSettings,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
