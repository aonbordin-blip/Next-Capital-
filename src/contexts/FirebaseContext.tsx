import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  formatReadableFirebaseError,
  signInWithGooglePopup,
  signOutFirebase,
} from '../firebase';
import {
  deleteCloudCases,
  deleteCloudDvRequest,
  ensureUserProfileDoc,
  pushAllLocalCasesToCloud,
  pushLocalDvRequestsToCloud,
  subscribeUserCases,
  subscribeUserDvRequests,
  updateUserProfilePrefs,
  upsertCloudCases,
  upsertCloudDvRequest,
  UserProfilePrefs,
} from '../utils/cloudSync';
import {
  registerCloudSyncBridge,
  resetCloudSyncTracking,
} from '../utils/savedCasesStorage';
import {
  deleteLocalDvRequest,
  getSavedDvRequests,
  resetDvCloudTracking,
  saveLocalDvRequest,
} from '../utils/dvCasesStorage';
import { DvRequestStatus, SavedCaseRecord as CaseRecord, SavedDvRequestRecord } from '../types';

export type CloudSyncStatus = 'signed_out' | 'syncing' | 'synced' | 'error';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: number | null;
  syncError: string | null;
  syncNotice: string | null;
  approvalDocSkippedCount: number;
  cloudCaseCount: number;
  dvRequests: SavedDvRequestRecord[];
  saveDvRequest: (record: SavedDvRequestRecord) => Promise<{ savedToCloud: boolean; error?: string }>;
  updateDvRequestStatus: (id: string, status: DvRequestStatus) => Promise<void>;
  removeDvRequest: (id: string) => Promise<void>;
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
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [approvalDocSkippedCount, setApprovalDocSkippedCount] = useState(0);
  const [cloudCaseCount, setCloudCaseCount] = useState(0);
  const [dvRequests, setDvRequests] = useState<SavedDvRequestRecord[]>(() => getSavedDvRequests());

  const cloudCreatedAtMapRef = useRef<Map<string, number>>(new Map());
  const cloudRecordCreatedAtMapRef = useRef<Map<string, number>>(new Map());
  const profileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUserRef = useRef<User | null>(null);
  const unsubscribeCasesRef = useRef<(() => void) | null>(null);
  const unsubscribeDvRequestsRef = useRef<(() => void) | null>(null);

  const attachBridgeAndSubscription = useCallback(
    async (targetUser: User, forceTokenRefresh = false) => {
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
            targetUser,
            records,
            cloudCreatedAtMapRef.current,
            cloudRecordCreatedAtMapRef.current
          )
            .then((res) => {
              setSyncStatus('synced');
              setLastSyncedAt(Date.now());
              setSyncError(null);
              if (res.approvalDocSkippedCount > 0) {
                setApprovalDocSkippedCount((prev) => Math.max(prev, res.approvalDocSkippedCount));
              }
            })
            .catch((err) => {
              setSyncStatus('error');
              setSyncError(formatReadableFirebaseError(err));
            });
        },
        deleteCases: (ids: string[]) => {
          setSyncStatus('syncing');
          deleteCloudCases(
            targetUser,
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
      let pushRes = { pushedCount: 0, uploadedCount: 0, approvalDocSkippedCount: 0 };
      try {
        pushRes = await pushAllLocalCasesToCloud(
          targetUser,
          cloudCreatedAtMapRef.current,
          cloudRecordCreatedAtMapRef.current
        );
        setApprovalDocSkippedCount(pushRes.approvalDocSkippedCount);
      } catch (err) {
        pushErr = err;
      }

      // Push any existing local DV requests (and heal any cloud stubs) before subscribing
      try {
        await pushLocalDvRequestsToCloud(targetUser);
        setDvRequests(getSavedDvRequests());
      } catch (err) {
        console.error('Failed to push local DV requests:', err);
      }

      if (unsubscribeCasesRef.current) {
        unsubscribeCasesRef.current();
        unsubscribeCasesRef.current = null;
      }
      if (unsubscribeDvRequestsRef.current) {
        unsubscribeDvRequestsRef.current();
        unsubscribeDvRequestsRef.current = null;
      }

      // Attach real-time RTDB listener (only when auth is ready & authenticated)
      unsubscribeCasesRef.current = subscribeUserCases(
        targetUser,
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

      unsubscribeDvRequestsRef.current = subscribeUserDvRequests(
        targetUser,
        (records) => {
          setDvRequests(records);
        },
        (err) => {
          console.error('DV requests RTDB listener error:', err);
        }
      );

      if (pushErr) {
        throw pushErr;
      }

      return pushRes;
    },
    []
  );

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubscribeCasesRef.current) {
        unsubscribeCasesRef.current();
        unsubscribeCasesRef.current = null;
      }
      if (unsubscribeDvRequestsRef.current) {
        unsubscribeDvRequestsRef.current();
        unsubscribeDvRequestsRef.current = null;
      }
      cloudCreatedAtMapRef.current.clear();
      cloudRecordCreatedAtMapRef.current.clear();

      if (!nextUser || !nextUser.email || !nextUser.emailVerified) {
        activeUserRef.current = null;
        resetCloudSyncTracking();
        resetDvCloudTracking();
        setUser(null);
        setSyncStatus('signed_out');
        setSyncNotice(null);
        setApprovalDocSkippedCount(0);
        setSyncError(
          nextUser && (!nextUser.email || !nextUser.emailVerified)
            ? 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล จึงยังไม่สามารถเข้าสู่ระบบซิงค์ได้'
            : null
        );
        setCloudCaseCount(0);
        setDvRequests(getSavedDvRequests());
        registerCloudSyncBridge(null);
        setAuthReady(true);
        return;
      }

      if (activeUserRef.current?.uid !== nextUser.uid) {
        resetCloudSyncTracking();
        resetDvCloudTracking();
        setSyncNotice(null);
        setApprovalDocSkippedCount(0);
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
      if (unsubscribeDvRequestsRef.current) {
        unsubscribeDvRequestsRef.current();
        unsubscribeDvRequestsRef.current = null;
      }
      registerCloudSyncBridge(null);
    };
  }, [attachBridgeAndSubscription]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setIsSigningIn(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      await signInWithGooglePopup();
      return true;
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      const msg = err instanceof Error ? err.message : String(err || '');
      const combined = `${code} ${msg}`.toLowerCase();

      if (
        combined.includes('popup-closed-by-user') ||
        combined.includes('cancelled-popup-request')
      ) {
        return false;
      }

      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isInAppBrowser = /Line\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua);

      if (combined.includes('unauthorized-domain')) {
        setSyncError(
          `โดเมน "${host || 'นี้'}" ยังไม่ได้รับอนุญาตใน Firebase Authentication (ต้องเพิ่มในเมนู Authentication -> Settings -> Authorized domains)`
        );
      } else if (combined.includes('popup-blocked')) {
        setSyncError(
          isInAppBrowser
            ? 'ไม่สามารถล็อกอินผ่านแอปแชทได้ กรุณากดเปิดลิงก์ด้วย Chrome หรือ Safari โดยตรง'
            : 'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ (Pop-up) กรุณาอนุญาต Pop-up สำหรับเว็บนี้แล้วลองใหม่อีกครั้ง'
        );
      } else if (combined.includes('operation-not-allowed')) {
        setSyncError(
          'โปรเจกต์ Firebase ยังไม่ได้เปิดใช้งาน Google Sign-In (Authentication -> Sign-in method)'
        );
      } else if (combined.includes('network-request-failed')) {
        setSyncError('เชื่อมต่อระบบล็อกอินของ Google ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      } else if (combined.includes('web-storage-unsupported')) {
        setSyncError('เบราว์เซอร์หรือโหมดไม่ระบุตัวตนปิดการเก็บ Cookies/Storage จึงไม่สามารถเข้าสู่ระบบได้');
      } else if (isInAppBrowser) {
        setSyncError(
          `Google ไม่อนุญาตให้ล็อกอินในเบราว์เซอร์ของแอปแชท กรุณาเปิดผ่าน Chrome หรือ Safari โดยตรง (${code || 'auth-error'})`
        );
      } else {
        setSyncError(
          `ไม่สามารถเข้าสู่ระบบด้วย Google ได้${code ? ` [${code}]` : ''} กรุณาลองใหม่อีกครั้ง`
        );
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
    if (unsubscribeDvRequestsRef.current) {
      unsubscribeDvRequestsRef.current();
      unsubscribeDvRequestsRef.current = null;
    }
    registerCloudSyncBridge(null);
    resetCloudSyncTracking();
    resetDvCloudTracking();
    await signOutFirebase();
    setUser(null);
    setSyncStatus('signed_out');
    setLastSyncedAt(null);
    setSyncError(null);
    setSyncNotice(null);
    setApprovalDocSkippedCount(0);
    setDvRequests(getSavedDvRequests());
  }, []);

  const syncNow = useCallback(async () => {
    const currentUser = activeUserRef.current || auth.currentUser;
    if (!currentUser) return;
    setSyncNotice(null);
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

  const saveDvRequest = useCallback(
    async (record: SavedDvRequestRecord): Promise<{ savedToCloud: boolean; error?: string }> => {
      const updatedList = saveLocalDvRequest(record);
      setDvRequests(updatedList);

      const currentUser = activeUserRef.current || auth.currentUser;
      if (!currentUser || !currentUser.emailVerified) {
        return { savedToCloud: false };
      }

      try {
        await upsertCloudDvRequest(currentUser, record);
        setLastSyncedAt(Date.now());
        return { savedToCloud: true };
      } catch (err) {
        return {
          savedToCloud: false,
          error: formatReadableFirebaseError(err),
        };
      }
    },
    []
  );

  const updateDvRequestStatus = useCallback(
    async (id: string, status: DvRequestStatus): Promise<void> => {
      const current = getSavedDvRequests().find((r) => r.id === id);
      if (!current) return;
      const updatedRecord: SavedDvRequestRecord = {
        ...current,
        status,
        updatedAt: Date.now(),
      };
      const updatedList = saveLocalDvRequest(updatedRecord);
      setDvRequests(updatedList);

      const currentUser = activeUserRef.current || auth.currentUser;
      if (currentUser && currentUser.emailVerified) {
        await upsertCloudDvRequest(currentUser, updatedRecord);
        setLastSyncedAt(Date.now());
      }
    },
    []
  );

  const removeDvRequest = useCallback(async (id: string): Promise<void> => {
    const nextList = deleteLocalDvRequest(id);
    setDvRequests(nextList);

    const currentUser = activeUserRef.current || auth.currentUser;
    if (currentUser && currentUser.emailVerified) {
      await deleteCloudDvRequest(currentUser, id);
      setLastSyncedAt(Date.now());
    }
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
        syncNotice,
        approvalDocSkippedCount,
        cloudCaseCount,
        dvRequests,
        saveDvRequest,
        updateDvRequestStatus,
        removeDvRequest,
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
