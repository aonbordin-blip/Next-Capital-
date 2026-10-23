import { SavedCaseRecord } from '../types';

const STORAGE_KEY = 'ncap_saved_cases_v1';

export function getSavedCases(): SavedCaseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.createdAt - a.createdAt);
    }
    return [];
  } catch (err) {
    console.error('Failed to read saved cases from localStorage:', err);
    return [];
  }
}

export function saveCaseRecord(
  data: Omit<SavedCaseRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): SavedCaseRecord {
  const cases = getSavedCases();
  const now = Date.now();

  if (data.id) {
    // Update existing
    const index = cases.findIndex((c) => c.id === data.id);
    if (index >= 0) {
      const updated: SavedCaseRecord = {
        ...cases[index],
        ...data,
        id: data.id,
        updatedAt: now,
      };
      cases[index] = updated;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
      } catch (err) {
        console.error('Failed to update case in localStorage:', err);
      }
      return updated;
    }
  }

  // Create new
  const newRecord: SavedCaseRecord = {
    ...data,
    id: `case-${now}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCases = [newRecord, ...cases];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCases));
  } catch (err) {
    console.error('Failed to save case in localStorage:', err);
  }
  return newRecord;
}

export function deleteCaseRecord(id: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const filtered = cases.filter((c) => c.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete case from localStorage:', err);
  }
  return filtered;
}

export function updateCaseTitle(id: string, newTitle: string): SavedCaseRecord[] {
  const cases = getSavedCases();
  const updated = cases.map((c) => (c.id === id ? { ...c, caseTitle: newTitle, updatedAt: Date.now() } : c));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to update title in localStorage:', err);
  }
  return updated;
}

export function clearAllCaseRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear cases in localStorage:', err);
  }
}

export function exportCasesAsJson(): string {
  const cases = getSavedCases();
  return JSON.stringify(
    {
      app: 'MotoLease Calculator Next Capital',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      cases,
    },
    null,
    2
  );
}

export function importCasesFromJson(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    const incoming: SavedCaseRecord[] = Array.isArray(data) ? data : data.cases;
    if (!Array.isArray(incoming)) {
      return { success: false, count: 0, error: 'รูปแบบไฟล์ไม่ถูกต้อง (ต้องเป็นรายการเคส)' };
    }

    const current = getSavedCases();
    const currentIds = new Set(current.map((c) => c.id));
    let addedCount = 0;

    const merged = [...current];
    incoming.forEach((item) => {
      if (item && item.vehiclePrice && item.proposalKey) {
        // Ensure id is unique
        let finalId = item.id || `case-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        if (currentIds.has(finalId)) {
          finalId = `case-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        }
        merged.push({
          ...item,
          id: finalId,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
        });
        currentIds.add(finalId);
        addedCount++;
      }
    });

    merged.sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return { success: true, count: addedCount };
  } catch (err) {
    return { success: false, count: 0, error: 'ไม่สามารถอ่านไฟล์ JSON ได้ หรือไฟล์เสียหาย' };
  }
}
