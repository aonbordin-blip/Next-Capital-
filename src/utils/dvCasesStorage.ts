export type DvRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SavedDvRequestRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  customerName: string;
  topics: string[];
  ncb: string;
  dealer: string;
  bikeModel: string;
  bikeCode: string;
  occupation: string;
  income: string;
  financialDocs: string;
  downPayment: string;
  remark: string;
  ck: string;
  yodRate: string;
  dvMessage: string;
  status: DvRequestStatus;
  proposalKey?: string;
  financeAmount?: number;
  monthlyInstallment?: number;
  term?: number;
  customerAge?: string;
  customerWorkMonths?: string;
  customerIncome?: string;
  customerResidenceMonths?: string;
  isAceCustomer?: boolean;
}

const DV_STORAGE_KEY = 'ncap_dv_requests_v1';
const PENDING_DV_UPLOADS_KEY = 'ncap_dv_pending_uploads_v1';
const PENDING_DV_DELETES_KEY = 'ncap_dv_pending_deletes_v1';
const CONFIRMED_DV_CLOUD_IDS_KEY = 'ncap_dv_confirmed_cloud_v1';

export function sanitizeDvRequestId(rawId?: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  if (cleaned && cleaned.startsWith('dv-')) {
    return cleaned.slice(0, 128);
  }
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `dv-${Date.now()}-${randomSuffix}`;
}

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, setIds: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(setIds)));
  } catch {
    // ignore quota errors
  }
}

export function getPendingDvUploads(): Set<string> {
  return readIdSet(PENDING_DV_UPLOADS_KEY);
}

export function markPendingDvUpload(id: string): void {
  const s = readIdSet(PENDING_DV_UPLOADS_KEY);
  s.add(sanitizeDvRequestId(id));
  writeIdSet(PENDING_DV_UPLOADS_KEY, s);
}

export function clearPendingDvUploads(ids: string[]): void {
  if (ids.length === 0) return;
  const s = readIdSet(PENDING_DV_UPLOADS_KEY);
  ids.forEach((id) => s.delete(sanitizeDvRequestId(id)));
  writeIdSet(PENDING_DV_UPLOADS_KEY, s);
}

export function getPendingDvDeletes(): Set<string> {
  return readIdSet(PENDING_DV_DELETES_KEY);
}

export function markPendingDvDelete(id: string): void {
  const safeId = sanitizeDvRequestId(id);
  const delSet = readIdSet(PENDING_DV_DELETES_KEY);
  delSet.add(safeId);
  writeIdSet(PENDING_DV_DELETES_KEY, delSet);

  const upSet = readIdSet(PENDING_DV_UPLOADS_KEY);
  upSet.delete(safeId);
  writeIdSet(PENDING_DV_UPLOADS_KEY, upSet);
}

export function clearPendingDvDeletes(ids: string[]): void {
  if (ids.length === 0) return;
  const s = readIdSet(PENDING_DV_DELETES_KEY);
  ids.forEach((id) => s.delete(sanitizeDvRequestId(id)));
  writeIdSet(PENDING_DV_DELETES_KEY, s);
}

export function markConfirmedDvCloudIds(ids: string[]): void {
  if (ids.length === 0) return;
  const s = readIdSet(CONFIRMED_DV_CLOUD_IDS_KEY);
  ids.forEach((id) => s.add(sanitizeDvRequestId(id)));
  writeIdSet(CONFIRMED_DV_CLOUD_IDS_KEY, s);
}

export function resetDvCloudTracking(): void {
  try {
    localStorage.removeItem(PENDING_DV_UPLOADS_KEY);
    localStorage.removeItem(PENDING_DV_DELETES_KEY);
    localStorage.removeItem(CONFIRMED_DV_CLOUD_IDS_KEY);
  } catch {
    // ignore
  }
}

function normalizeDvRecord(raw: Partial<SavedDvRequestRecord>): SavedDvRequestRecord {
  const now = Date.now();
  const status: DvRequestStatus =
    raw.status === 'approved' || raw.status === 'rejected' ? raw.status : 'pending';
  return {
    id: sanitizeDvRequestId(raw.id),
    createdAt: typeof raw.createdAt === 'number' && raw.createdAt > 0 ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' && raw.updatedAt > 0 ? raw.updatedAt : now,
    customerName: String(raw.customerName || 'คุณลูกค้า'),
    topics: Array.isArray(raw.topics) ? raw.topics.map(String).filter(Boolean) : [],
    ncb: String(raw.ncb || 'Normal'),
    dealer: String(raw.dealer || ''),
    bikeModel: String(raw.bikeModel || ''),
    bikeCode: String(raw.bikeCode || ''),
    occupation: String(raw.occupation || ''),
    income: String(raw.income || ''),
    financialDocs: String(raw.financialDocs || ''),
    downPayment: String(raw.downPayment || ''),
    remark: String(raw.remark || ''),
    ck: String(raw.ck || ''),
    yodRate: String(raw.yodRate || ''),
    dvMessage: String(raw.dvMessage || ''),
    status,
    ...(raw.proposalKey ? { proposalKey: raw.proposalKey } : {}),
    ...(typeof raw.financeAmount === 'number' ? { financeAmount: raw.financeAmount } : {}),
    ...(typeof raw.monthlyInstallment === 'number' ? { monthlyInstallment: raw.monthlyInstallment } : {}),
    ...(typeof raw.term === 'number' ? { term: raw.term } : {}),
    ...(typeof raw.customerAge === 'string' ? { customerAge: raw.customerAge } : {}),
    ...(typeof raw.customerWorkMonths === 'string' ? { customerWorkMonths: raw.customerWorkMonths } : {}),
    ...(typeof raw.customerIncome === 'string' ? { customerIncome: raw.customerIncome } : {}),
    ...(typeof raw.customerResidenceMonths === 'string'
      ? { customerResidenceMonths: raw.customerResidenceMonths }
      : {}),
    ...(typeof raw.isAceCustomer === 'boolean' ? { isAceCustomer: raw.isAceCustomer } : {}),
  };
}

export function getSavedDvRequests(): SavedDvRequestRecord[] {
  try {
    const raw = localStorage.getItem(DV_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeDvRecord(item as Partial<SavedDvRequestRecord>))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeSavedDvRequests(records: SavedDvRequestRecord[]): void {
  try {
    const sorted = [...records].sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem(DV_STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // ignore storage errors
  }
}

export function saveLocalDvRequest(record: SavedDvRequestRecord): SavedDvRequestRecord[] {
  const normalized = normalizeDvRecord(record);
  const current = getSavedDvRequests();
  const idx = current.findIndex((item) => item.id === normalized.id);
  const next =
    idx >= 0
      ? current.map((item, i) => (i === idx ? normalized : item))
      : [normalized, ...current];
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  writeSavedDvRequests(next);
  markPendingDvUpload(normalized.id);
  return next;
}

export function deleteLocalDvRequest(id: string): SavedDvRequestRecord[] {
  const safeId = sanitizeDvRequestId(id);
  const current = getSavedDvRequests();
  const next = current.filter((item) => item.id !== safeId);
  writeSavedDvRequests(next);
  markPendingDvDelete(safeId);
  return next;
}

export function mergeCloudDvRequestsIntoLocal(
  cloudRecords: SavedDvRequestRecord[],
  options?: { isServerSnapshotSettled?: boolean }
): SavedDvRequestRecord[] {
  const localRecords = getSavedDvRequests();
  const pendingUploads = getPendingDvUploads();
  const pendingDeletes = getPendingDvDeletes();
  const confirmedCloudIds = readIdSet(CONFIRMED_DV_CLOUD_IDS_KEY);

  const cloudMap = new Map<string, SavedDvRequestRecord>();
  for (const c of cloudRecords) {
    const safeId = sanitizeDvRequestId(c.id);
    if (pendingDeletes.has(safeId)) continue;
    cloudMap.set(safeId, normalizeDvRecord({ ...c, id: safeId }));
  }

  const mergedMap = new Map<string, SavedDvRequestRecord>();

  // 1. Add cloud records
  for (const [id, c] of cloudMap.entries()) {
    mergedMap.set(id, c);
  }

  // 2. Reconcile local records
  for (const l of localRecords) {
    const safeId = sanitizeDvRequestId(l.id);
    if (pendingDeletes.has(safeId)) continue;
    const cloudMatch = mergedMap.get(safeId);
    if (cloudMatch) {
      if (pendingUploads.has(safeId) && l.updatedAt > cloudMatch.updatedAt) {
        mergedMap.set(safeId, l);
      }
      continue;
    }

    // Keep local-only record if it has pending upload OR was never confirmed deleted from server
    if (
      pendingUploads.has(safeId) ||
      !options?.isServerSnapshotSettled ||
      !confirmedCloudIds.has(safeId)
    ) {
      mergedMap.set(safeId, l);
    }
  }

  const result = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  writeSavedDvRequests(result);
  return result;
}
