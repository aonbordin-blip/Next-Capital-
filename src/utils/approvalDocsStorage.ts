import { ApprovalDocInfo } from '../types';

const DB_NAME = 'ncap_approval_docs_db';
const DB_VERSION = 1;
const STORE_NAME = 'docs';

interface StoredDocRecord {
  caseId: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: number;
}

// In-memory fallback if IndexedDB is blocked
const memoryStore = new Map<string, StoredDocRecord>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'caseId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Save an uploaded PDF document for a case into IndexedDB
 */
export async function saveApprovalDocFile(caseId: string, file: File): Promise<ApprovalDocInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const docRecord: StoredDocRecord = {
        caseId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        dataUrl,
        uploadedAt: Date.now(),
      };

      try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(docRecord);

        tx.oncomplete = () => {
          resolve({
            name: file.name,
            size: file.size,
            uploadedAt: docRecord.uploadedAt,
            type: docRecord.type,
          });
        };

        tx.onerror = () => {
          console.warn('IndexedDB tx error, using memory fallback:', tx.error);
          memoryStore.set(caseId, docRecord);
          resolve({
            name: file.name,
            size: file.size,
            uploadedAt: docRecord.uploadedAt,
            type: docRecord.type,
          });
        };
      } catch (err) {
        console.warn('Failed to access IndexedDB, saving to memory:', err);
        memoryStore.set(caseId, docRecord);
        resolve({
          name: file.name,
          size: file.size,
          uploadedAt: docRecord.uploadedAt,
          type: docRecord.type,
        });
      }
    };

    reader.onerror = () => {
      reject(new Error('ไม่สามารถอ่านไฟล์ได้ กรุณาลองใหม่อีกครั้ง'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Retrieve the PDF document data (including Base64 Data URL) for viewing
 */
export async function getApprovalDocData(caseId: string): Promise<StoredDocRecord | null> {
  if (memoryStore.has(caseId)) {
    return memoryStore.get(caseId)!;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(caseId);

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as StoredDocRecord);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        console.warn('IndexedDB get error:', req.error);
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('Failed to read from IndexedDB:', err);
    return null;
  }
}

/**
 * Delete an approval document for a case from IndexedDB
 */
export async function deleteApprovalDocFile(caseId: string): Promise<void> {
  memoryStore.delete(caseId);

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(caseId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn('IndexedDB delete error:', tx.error);
        resolve();
      };
    });
  } catch (err) {
    console.warn('Failed to delete from IndexedDB:', err);
  }
}

/**
 * Format bytes to readable string (e.g. 245 KB, 1.2 MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Open PDF in an external application (e.g. mobile PDF viewer, Google Drive, browser)
 */
export function openPdfInExternalApp(dataUrl: string, filename: string = 'เอกสารการอนุมัติ.pdf'): boolean {
  try {
    const base64Index = dataUrl.indexOf('base64,');
    const base64 = base64Index !== -1 ? dataUrl.substring(base64Index + 7) : dataUrl;
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    // Open via anchor tag to support both desktop and mobile external intent / new tab
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener,noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }, 60000);
    return true;
  } catch (err) {
    console.error('Failed to open PDF in external app:', err);
    try {
      window.open(dataUrl, '_blank');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Download PDF directly to local storage / file system
 */
export function downloadPdfFile(dataUrl: string, filename: string = 'เอกสารการอนุมัติ.pdf'): void {
  try {
    const base64Index = dataUrl.indexOf('base64,');
    const base64 = base64Index !== -1 ? dataUrl.substring(base64Index + 7) : dataUrl;
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore
      }
    }, 60000);
  } catch {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

