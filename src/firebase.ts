import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import firebaseConfig from '../firebase-applet-config.json';

const DEFAULT_RTDB_URL =
  'https://next-capital-28320-default-rtdb.asia-southeast1.firebasedatabase.app';

export const RTDB_DATABASE_URL: string = (
  (import.meta.env?.VITE_FIREBASE_DATABASE_URL as string | undefined)?.trim() || DEFAULT_RTDB_URL
).replace(/\/+$/, '');

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Pass firestoreDatabaseId from firebase-applet-config.json (retained for legacy one-time read fallback)
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db: Firestore = dbInstance;
export const rtdb: Database = getDatabase(app, RTDB_DATABASE_URL);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firebase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatReadableFirebaseError(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  let innerMsg = rawMsg;
  let pathInfo = '';

  try {
    const parsed = JSON.parse(rawMsg) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string') {
      innerMsg = parsed.error;
      if (parsed.operationType || parsed.path) {
        pathInfo = ` [${parsed.operationType || ''}${parsed.path ? `: ${parsed.path}` : ''}]`;
      }
    }
  } catch {
    // not JSON
  }

  const lower = innerMsg.toLowerCase();
  if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
    const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
    return `โควต้าการใช้งาน Cloud รายวันเต็มชั่วคราว (รีเซ็ตวันถัดไป) สามารถตรวจสอบเพิ่มเติมได้ที่ ${consoleUrl}`;
  }
  if (lower.includes('permission') || lower.includes('insufficient')) {
    const diagPart = innerMsg.includes(' | ') ? innerMsg.split(' | ').slice(1).join(' | ') : '';
    const dbTag = `db=${firebaseConfig.projectId}/${firebaseConfig.firestoreDatabaseId.slice(0, 12)}... verified=${String(auth.currentUser?.emailVerified)}`;
    const extra = diagPart ? ` (${dbTag} | ${diagPart})` : ` (${dbTag})`;
    return `สิทธิ์การเข้าถึงหรือรูปแบบข้อมูลบางเคสถูกกฎความปลอดภัยปฏิเสธ${pathInfo}${extra} กรุณากด "ล้างแคชแอปและโหลดใหม่" หรือลองซิงค์ใหม่อีกครั้ง`;
  }
  if (lower.includes('offline') || lower.includes('unavailable') || lower.includes('network') || lower.includes('disconnected')) {
    return 'ไม่สามารถเชื่อมต่อฐานข้อมูล Cloud Firestore ได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองกดซิงค์อีกครั้ง';
  }
  if (lower.includes('index')) {
    return `ฐานข้อมูลกำลังเตรียม Index${pathInfo} กรุณารอสักครู่แล้วลองใหม่อีกครั้ง`;
  }
  if (innerMsg) {
    return `ซิงค์ข้อมูลไม่สำเร็จ: ${innerMsg}`;
  }
  return 'ไม่สามารถเชื่อมต่อฐานข้อมูล Cloud ได้ กรุณาลองใหม่อีกครั้ง';
}

// Validate Connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}
