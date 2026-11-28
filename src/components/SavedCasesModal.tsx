import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalTransition } from '../hooks/useModalTransition';
import { MarqueeText } from './MarqueeText';
import { CloudSyncCard } from './CloudSyncCard';
import {
  X,
  Search,
  FolderArchive,
  Download,
  Upload,
  Trash2,
  Calendar,
  User,
  Bike,
  Banknote,
  Clock,
  Sparkles,
  ExternalLink,
  Edit2,
  Check,
  AlertCircle,
  Share2,
  Pencil,
  CheckCircle2,
  XCircle,
  Ban,
  PackageCheck,
  CalendarDays,
  CalendarClock,
  SlidersHorizontal,
  HelpCircle,
  Smartphone,
  MapPin,
  Navigation,
  ClipboardCopy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutList,
  LayoutGrid,
  Table2,
  Phone,
  ShieldCheck,
  Percent,
  BadgePercent,
  Receipt,
  RotateCcw,
  FileText,
  Eye,
  Paperclip,
  UploadCloud,
  FileCheck,
  Maximize2,
  Building2,
  FileSpreadsheet,
  CreditCard,
  EyeOff,
  Barcode,
  ScanLine,
  Briefcase,
  Home,
  BadgeCheck,
  UserCheck,
} from 'lucide-react';
import { SavedCaseRecord, CaseApprovalStatus, VehicleDeliveryStatus, ApprovalDocInfo } from '../types';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { exportSavedCasesToExcel } from '../utils/excelExport';
import {
  formatThaiDateFromIso,
  formatThaiIdDisplay,
  maskThaiIdDisplay,
} from '../utils/thaiIdUtils';
import {
  getSavedCases,
  deleteCaseRecord,
  updateCaseTitle,
  updateCaseDealerName,
  updateCaseApprovalStatus,
  updateCaseDeliveryStatus,
  updateCaseDates,
  updateCasePaymentDueDay,
  updateCaseGoogleMapsLocation,
  updateCaseVehicleNumbers,
  updateCaseApprovalDoc,
  updateCaseCustomerPhoto,
  getGoogleMapsNavigationUrl,
  calculateFirstPaymentDueDate,
  clearAllCaseRecords,
  exportCasesAsJson,
  importCasesFromJson,
} from '../utils/savedCasesStorage';
import {
  saveApprovalDocFile,
  getApprovalDocData,
  deleteApprovalDocFile,
  formatFileSize,
  openPdfInExternalApp,
  downloadPdfFile,
} from '../utils/approvalDocsStorage';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { ProvisionalApprovalModal, ProvisionalApprovalData } from './ProvisionalApprovalModal';
import { normalizeVehicleSerial, VehicleBarcodeTarget } from '../utils/vehicleNumberUtils';
import { VehicleBarcodeScannerModal } from './VehicleBarcodeScannerModal';
import { CustomerAvatar } from './CustomerAvatar';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadCase: (record: SavedCaseRecord) => void;
  onEditCase?: (record: SavedCaseRecord) => void;
  onSaveCurrentCase?: () => void;
  onDeleteCase?: (deletedId?: string) => void;
  activeEditingId?: string | null;
  initialShowAllMonths?: boolean;
}

const THAI_MONTHS = [
  { id: 1, name: 'มกราคม', short: 'ม.ค.' },
  { id: 2, name: 'กุมภาพันธ์', short: 'ก.พ.' },
  { id: 3, name: 'มีนาคม', short: 'มี.ค.' },
  { id: 4, name: 'เมษายน', short: 'เม.ย.' },
  { id: 5, name: 'พฤษภาคม', short: 'พ.ค.' },
  { id: 6, name: 'มิถุนายน', short: 'มิ.ย.' },
  { id: 7, name: 'กรกฎาคม', short: 'ก.ค.' },
  { id: 8, name: 'สิงหาคม', short: 'ส.ค.' },
  { id: 9, name: 'กันยายน', short: 'ก.ย.' },
  { id: 10, name: 'ตุลาคม', short: 'ต.ค.' },
  { id: 11, name: 'พฤศจิกายน', short: 'พ.ย.' },
  { id: 12, name: 'ธันวาคม', short: 'ธ.ค.' },
];

function toInputDateStr(timestampOrStr?: number | string): string {
  if (!timestampOrStr) return '';
  if (typeof timestampOrStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestampOrStr)) {
    return timestampOrStr;
  }
  const d = new Date(timestampOrStr);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentYearMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${y}-${m}`;
}

function formatYearMonthLabel(ymKey: string): string {
  if (ymKey === 'all') return 'ทั้งหมด (ทุกช่วงเวลา)';
  const [yStr, mStr] = ymKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return ymKey;
  const thaiYear = y + 543;
  const monthName = THAI_MONTHS.find((item) => item.id === m)?.name || `เดือน ${m}`;
  return `${monthName} ${thaiYear}`;
}

function getAdjacentMonthKey(ymKey: string, direction: -1 | 1): string {
  const [yStr, mStr] = (ymKey === 'all' ? getCurrentYearMonthKey() : ymKey).split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = new Date(y, m - 1 + direction, 1);
  const nextY = d.getFullYear();
  const nextM = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${nextY}-${nextM}`;
}

function getCaseCreatedYM(c: SavedCaseRecord): string {
  return toInputDateStr(c.createdAt).slice(0, 7);
}

function getCaseApprovalYM(c: SavedCaseRecord): string {
  if (c.approvalDate && /^\d{4}-\d{2}-\d{2}$/.test(c.approvalDate)) {
    return c.approvalDate.slice(0, 7);
  }
  return c.approvalStatus === 'approved' ? getCaseCreatedYM(c) : '';
}

function getCaseDeliveryYM(c: SavedCaseRecord): string {
  if (c.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(c.deliveryDate)) {
    return c.deliveryDate.slice(0, 7);
  }
  return c.deliveryStatus === 'delivered' ? (getCaseApprovalYM(c) || getCaseCreatedYM(c)) : '';
}

function formatThaiDateOnly(dateInput?: string | number): string {
  if (!dateInput) return '';
  let d: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const parts = dateInput.split('-').map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(dateInput);
  }
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = THAI_MONTHS[d.getMonth()]?.short || '';
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function formatThaiDateTime(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    const day = d.getDate();
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = months[d.getMonth()];
    const year = d.getFullYear() + 543;
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins} น.`;
  } catch {
    return '';
  }
}

function formatMonthsToThaiDuration(raw?: string): string {
  if (!raw || !raw.trim()) return '—';
  const totalMonths = parseInt(raw.trim(), 10);
  if (isNaN(totalMonths) || totalMonths < 0) return raw.trim();
  if (totalMonths === 0) return 'น้อยกว่า 1 เดือน';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} ปี ${months} เดือน`;
  if (years > 0) return `${years} ปี`;
  return `${months} เดือน`;
}

function formatMonthlyIncomeThai(raw?: string): string {
  if (!raw || !raw.trim()) return '—';
  const cleaned = raw.replace(/,/g, '').trim();
  const num = Number(cleaned);
  if (isNaN(num) || num <= 0) return raw.trim();
  return `฿${num.toLocaleString('th-TH')} /เดือน`;
}

type DealStatusKey = 'pending' | 'approved_pending' | 'delivered' | 'rejected' | 'cancelled';

function getDealStatusMeta(record: SavedCaseRecord): {
  key: DealStatusKey;
  label: string;
  subLabel?: string;
  badgeClass: string;
  selectClass: string;
  iconColorClass: string;
} {
  if (record.approvalStatus === 'approved') {
    if (record.deliveryStatus === 'delivered') {
      const dateText = record.deliveryDate ? formatThaiDateOnly(record.deliveryDate) : '';
      return {
        key: 'delivered',
        label: 'รับรถแล้ว',
        subLabel: dateText ? `รับ ${dateText}` : undefined,
        badgeClass: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700/70',
        selectClass: 'bg-teal-50 dark:bg-teal-950/70 text-teal-900 dark:text-teal-100 border-teal-300 dark:border-teal-700/70 hover:bg-teal-100/80 dark:hover:bg-teal-900/70 dark:[color-scheme:dark]',
        iconColorClass: 'text-teal-600 dark:text-teal-400',
      };
    }
    const dateText = record.approvalDate ? formatThaiDateOnly(record.approvalDate) : '';
    return {
      key: 'approved_pending',
      label: 'อนุมัติแล้ว',
      subLabel: dateText ? `รอรับรถ · ${dateText}` : 'รอรับรถ',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700/70',
      selectClass: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700/70 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/70 dark:[color-scheme:dark]',
      iconColorClass: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (record.approvalStatus === 'rejected') {
    return {
      key: 'rejected',
      label: 'ไม่อนุมัติ',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 border-rose-300 dark:border-rose-700/70',
      selectClass: 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-100 border-rose-300 dark:border-rose-700/70 hover:bg-rose-100/80 dark:hover:bg-rose-900/70 dark:[color-scheme:dark]',
      iconColorClass: 'text-rose-600 dark:text-rose-400',
    };
  }
  if (record.approvalStatus === 'cancelled') {
    return {
      key: 'cancelled',
      label: 'ยกเลิก',
      badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      selectClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-200/80 dark:hover:bg-slate-700 dark:[color-scheme:dark]',
      iconColorClass: 'text-slate-500 dark:text-slate-400',
    };
  }
  return {
    key: 'pending',
    label: 'รออนุมัติ',
    badgeClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-700/70',
    selectClass: 'bg-sky-50 dark:bg-sky-950/70 text-sky-900 dark:text-sky-100 border-sky-200 dark:border-sky-700/70 hover:bg-sky-100/80 dark:hover:bg-sky-900/70 dark:[color-scheme:dark]',
    iconColorClass: 'text-sky-600 dark:text-sky-400',
  };
}

export const SavedCasesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLoadCase,
  onEditCase,
  onSaveCurrentCase,
  onDeleteCase,
  activeEditingId,
  initialShowAllMonths = false,
}) => {
  const [cases, setCases] = useState<SavedCaseRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseApprovalStatus>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | VehicleDeliveryStatus>('all');
  // Monthly filter key: 'YYYY-MM' (e.g. '2026-11') or 'all' - Defaults to current month on open!
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => getCurrentYearMonthKey());
  const [selectedDueMonth, setSelectedDueMonth] = useState<string>('all'); // 'all' or '2569-11'
  const [viewMode, setViewMode] = useState<'table' | 'list' | 'cards'>('table'); // 'table' = ตารางพร้อมคอลัมน์สถานะ
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Detail Popup Modal state for selected customer
  const [detailCase, setDetailCase] = useState<SavedCaseRecord | null>(null);

  // Inline rename states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const [showTransferGuide, setShowTransferGuide] = useState<boolean>(false);

  // Approval PDF state and upload states
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [deleteDocConfirmId, setDeleteDocConfirmId] = useState<string | null>(null);
  const pdfFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Inline PDF preview state (แสดงตัวอย่างอัตโนมัติไม่ต้องกดเปิด)
  const [inlinePdfDataUrl, setInlinePdfDataUrl] = useState<string | null>(null);
  const [isLoadingInlinePdf, setIsLoadingInlinePdf] = useState<boolean>(false);
  // Provisional Approval Certificate Modal State
  const [approvalModalCase, setApprovalModalCase] = useState<SavedCaseRecord | null>(null);
  const [showFullIdCard, setShowFullIdCard] = useState<boolean>(true);
  const [showPhotoPreview, setShowPhotoPreview] = useState<boolean>(false);
  const [barcodeScannerState, setBarcodeScannerState] = useState<{
    caseId: string;
    target: VehicleBarcodeTarget;
  } | null>(null);

  // Load cases when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadedCases = getSavedCases();
      setCases(loadedCases);
      setSearchQuery('');
      setStatusFilter('all');
      setDeliveryFilter('all');
      const currentYM = getCurrentYearMonthKey();
      const hasCurrentMonthCase = loadedCases.some(
        (c) =>
          getCaseCreatedYM(c) === currentYM ||
          getCaseApprovalYM(c) === currentYM ||
          getCaseDeliveryYM(c) === currentYM
      );
      setSelectedMonthKey(
        initialShowAllMonths || (loadedCases.length > 0 && !hasCurrentMonthCase)
          ? 'all'
          : currentYM
      );
      setSelectedDueMonth('all');
      setEditingId(null);
      setDetailCase(null);
      setDeleteConfirmId(null);
      setShowClearAllConfirm(false);
      setShowTransferGuide(false);
      setIsLoadingPdf(false);
      setIsUploadingPdf(false);
      setDeleteDocConfirmId(null);
      setInlinePdfDataUrl(null);
      setIsLoadingInlinePdf(false);
      setShowPhotoPreview(false);
      setBarcodeScannerState(null);
    }
  }, [isOpen, initialShowAllMonths]);

  // Live refresh when Cloud Sync updates local cases
  useEffect(() => {
    if (!isOpen) return;
    const handleCloudSync = () => {
      setCases(getSavedCases());
    };
    window.addEventListener('ncap-cases-synced', handleCloudSync);
    return () => {
      window.removeEventListener('ncap-cases-synced', handleCloudSync);
    };
  }, [isOpen]);

  // Keep detailCase in sync when cases state changes
  useEffect(() => {
    if (detailCase) {
      const fresh = cases.find((c) => c.id === detailCase.id);
      if (fresh && fresh !== detailCase) {
        setDetailCase(fresh);
      }
    }
  }, [cases]);

  useEffect(() => {
    setShowPhotoPreview(false);
  }, [detailCase?.id]);

  // Automatically load PDF data for instant inline preview when detailCase has an approvalDoc
  useEffect(() => {
    if (detailCase?.approvalDoc) {
      let isCancelled = false;
      setIsLoadingInlinePdf(true);
      getApprovalDocData(detailCase.id)
        .then((doc) => {
          if (!isCancelled) {
            setInlinePdfDataUrl(doc?.dataUrl || null);
            setIsLoadingInlinePdf(false);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setIsLoadingInlinePdf(false);
          }
        });
      return () => {
        isCancelled = true;
      };
    } else {
      setInlinePdfDataUrl(null);
      setIsLoadingInlinePdf(false);
    }
  }, [detailCase?.id, detailCase?.approvalDoc?.uploadedAt]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Available month options (YYYY-MM), sorted descending, plus 'all'
  const availableMonthOptions = useMemo(() => {
    const set = new Set<string>();
    const currentYM = getCurrentYearMonthKey();
    set.add(currentYM);
    // Add prev and next month around current
    set.add(getAdjacentMonthKey(currentYM, -1));
    set.add(getAdjacentMonthKey(currentYM, 1));

    cases.forEach((c) => {
      const cr = getCaseCreatedYM(c);
      if (cr) set.add(cr);
      const ap = getCaseApprovalYM(c);
      if (ap) set.add(ap);
      const dl = getCaseDeliveryYM(c);
      if (dl) set.add(dl);
    });

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [cases]);

  // Statistics for the selected month (or all) taking into account cross-month approvals vs deliveries
  const monthlyStats = useMemo(() => {
    let deliveredInMonth = 0;
    let approvedInMonth = 0;
    let carriedOverDelivered = 0; // อนุมัติเดือนก่อน แต่มารับรถเดือนนี้
    let carriedOverPendingDelivery = 0; // อนุมัติเดือนก่อน แต่ยังไม่ได้รับรถ (ยกยอดมารอรับรถในเดือนนี้)
    let approvedPendingDelivery = 0; // อนุมัติเดือนนี้ ยังไม่ได้รับรถในเดือนนี้
    let approvedDeliveredLater = 0; // อนุมัติเดือนนี้ แต่ไปรับรถเดือนหน้า
    let pendingInMonth = 0;
    let rejectedInMonth = 0;
    let cancelledInMonth = 0;
    let totalInMonth = 0;

    const isAll = selectedMonthKey === 'all';

    cases.forEach((c) => {
      const createdYM = getCaseCreatedYM(c);
      const approvalYM = getCaseApprovalYM(c);
      const deliveryYM = getCaseDeliveryYM(c);
      const isApproved = c.approvalStatus === 'approved';
      const isDelivered = isApproved && c.deliveryStatus === 'delivered';

      if (isAll) {
        if (isDelivered) {
          deliveredInMonth++;
        } else if (isApproved) {
          approvedPendingDelivery++;
        } else if (c.approvalStatus === 'rejected') {
          rejectedInMonth++;
        } else if (c.approvalStatus === 'cancelled') {
          cancelledInMonth++;
        } else {
          pendingInMonth++;
        }
        if (isApproved) approvedInMonth++;
        totalInMonth++;
        return;
      }

      // Specific Month:
      // 1. Check if delivered in this month:
      const deliveredHere = isDelivered && deliveryYM === selectedMonthKey;
      if (deliveredHere) {
        deliveredInMonth++;
        // Did approval happen in an earlier month?
        if (approvalYM && approvalYM < selectedMonthKey) {
          carriedOverDelivered++;
        }
      }

      // 2. Check if approved in this month:
      const approvedHere = isApproved && approvalYM === selectedMonthKey;
      if (approvedHere) {
        approvedInMonth++;
        if (!isDelivered || deliveryYM === '' || deliveryYM === selectedMonthKey) {
          if (!isDelivered) {
            approvedPendingDelivery++;
          }
        } else if (deliveryYM > selectedMonthKey) {
          // Approved in this month, but customer receives car in a future month!
          approvedDeliveredLater++;
          approvedPendingDelivery++;
        }
      }

      // 3. Check if approved in an earlier month, but still waiting for delivery (or delivered in a future month):
      // นี่คือเคสของลูกค้าที่ยังไม่ได้รับรถจากเดือนที่แล้ว ให้นำมาแสดงในเดือนปัจจุบันด้วย
      const carriedPendingHere =
        isApproved &&
        approvalYM &&
        approvalYM < selectedMonthKey &&
        (!isDelivered || (deliveryYM && deliveryYM > selectedMonthKey));
      if (carriedPendingHere) {
        carriedOverPendingDelivery++;
      }

      // 4. Other statuses (pending, rejected, cancelled) based on createdYM
      if (!isApproved) {
        if (createdYM === selectedMonthKey) {
          if (c.approvalStatus === 'rejected') rejectedInMonth++;
          else if (c.approvalStatus === 'cancelled') cancelledInMonth++;
          else pendingInMonth++;
          totalInMonth++;
        }
      } else {
        // If approved, it is part of this month if approved here, delivered here, OR carried over waiting for delivery!
        if (deliveredHere || approvedHere || carriedPendingHere) {
          totalInMonth++;
        }
      }
    });

    return {
      deliveredInMonth,
      approvedInMonth,
      carriedOverDelivered,
      carriedOverPendingDelivery,
      approvedPendingDelivery,
      approvedDeliveredLater,
      totalPendingDelivery: approvedPendingDelivery + carriedOverPendingDelivery,
      pendingInMonth,
      rejectedInMonth,
      cancelledInMonth,
      totalInMonth,
    };
  }, [cases, selectedMonthKey]);

  // Status statistics and counters for filter chips
  const statusCounts = useMemo(() => {
    return {
      all: monthlyStats.totalInMonth,
      pending: monthlyStats.pendingInMonth,
      approved: monthlyStats.approvedInMonth + monthlyStats.carriedOverDelivered + monthlyStats.carriedOverPendingDelivery,
      rejected: monthlyStats.rejectedInMonth,
      cancelled: monthlyStats.cancelledInMonth,
      pendingDelivery: monthlyStats.totalPendingDelivery,
      delivered: monthlyStats.deliveredInMonth,
    };
  }, [monthlyStats]);

  // สถิติและตัวนับกำหนดชำระงวดแรก
  const dueMonthStats = useMemo(() => {
    const counts: Record<string, { key: string; label: string; shortLabel: string; thaiYear: number; month: number; count: number }> = {};
    let totalDelivered = 0;

    cases.forEach((c) => {
      if (c.approvalStatus !== 'approved' || c.deliveryStatus !== 'delivered') return;

      const deliveryYM = getCaseDeliveryYM(c);
      if (selectedMonthKey !== 'all' && deliveryYM !== selectedMonthKey) {
        return;
      }

      totalDelivered++;
      const dueInfo = calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt);
      if (!counts[dueInfo.key]) {
        counts[dueInfo.key] = {
          key: dueInfo.key,
          label: dueInfo.formattedShort,
          shortLabel: `2 ${dueInfo.monthShort} ${dueInfo.thaiShortYear}`,
          thaiYear: dueInfo.thaiYear,
          month: dueInfo.month,
          count: 0,
        };
      }
      counts[dueInfo.key].count++;
    });

    const activeDueMonths = Object.values(counts).sort((a, b) => {
      if (a.thaiYear !== b.thaiYear) return a.thaiYear - b.thaiYear;
      return a.month - b.month;
    });

    return {
      counts,
      activeDueMonths,
      totalDelivered,
    };
  }, [cases, selectedMonthKey]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const createdYM = getCaseCreatedYM(c);
      const approvalYM = getCaseApprovalYM(c);
      const deliveryYM = getCaseDeliveryYM(c);
      const isApproved = c.approvalStatus === 'approved';
      const isDelivered = isApproved && c.deliveryStatus === 'delivered';

      // Month Key Filter:
      if (selectedMonthKey !== 'all') {
        const deliveredHere = isDelivered && deliveryYM === selectedMonthKey;
        const approvedHere = isApproved && approvalYM === selectedMonthKey;
        const createdHere = createdYM === selectedMonthKey;
        const carriedPendingHere =
          isApproved &&
          approvalYM &&
          approvalYM < selectedMonthKey &&
          (!isDelivered || (deliveryYM && deliveryYM > selectedMonthKey));

        // If case is delivered in this month, it belongs to this month!
        // If case was approved in this month, it belongs to this month!
        // If case was approved in earlier month and is still pending delivery, it belongs to this month!
        // If not approved yet (pending, rejected, cancelled), it belongs if created in this month.
        if (!deliveredHere && !approvedHere && !carriedPendingHere && !(!isApproved && createdHere)) {
          return false;
        }
      }

      // Delivery filter
      if (deliveryFilter !== 'all') {
        if (!isApproved) return false;
        if (deliveryFilter === 'delivered') {
          // If viewing a specific month, must be delivered in that month
          if (selectedMonthKey !== 'all') {
            if (!isDelivered || deliveryYM !== selectedMonthKey) return false;
          } else {
            if (!isDelivered) return false;
          }
        } else if (deliveryFilter === 'pending_delivery') {
          // If viewing a specific month, either not yet delivered, or delivered in a later month
          if (selectedMonthKey !== 'all') {
            if (isDelivered && deliveryYM <= selectedMonthKey) return false;
          } else {
            if (isDelivered) return false;
          }
        }
      }

      // First Installment Due Month filter
      if (selectedDueMonth !== 'all') {
        if (!isDelivered) return false;
        const dueInfo = calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt);
        if (dueInfo.key !== selectedDueMonth) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'approved') {
          if (!isApproved) return false;
        } else if (statusFilter === 'pending') {
          if (c.approvalStatus !== 'pending') return false;
        } else if (statusFilter === 'rejected') {
          if (c.approvalStatus !== 'rejected') return false;
        } else if (statusFilter === 'cancelled') {
          if (c.approvalStatus !== 'cancelled') return false;
        }
      }

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = c.caseTitle.toLowerCase().includes(q);
        const custMatch = c.customerName.toLowerCase().includes(q);
        const phoneMatch = c.customerPhone?.toLowerCase().includes(q);
        const dealerMatch = c.dealerName?.toLowerCase().includes(q);
        const bikeMatch = c.bikeModelName?.toLowerCase().includes(q);
        const codeMatch = c.bikeModelCode?.toLowerCase().includes(q);
        const proposalMatch = c.snapshot.proposalCode.toLowerCase().includes(q);
        const locationMatch = c.googleMapsLocation?.toLowerCase().includes(q);
        const cleanIdQuery = q.replace(/-/g, '').trim();
        const idCardMatch =
          Boolean(cleanIdQuery) && Boolean(c.customerIdCard?.includes(cleanIdQuery));
        const addressMatch = Boolean(c.customerAddress?.toLowerCase().includes(q));
        const engineMatch = Boolean(c.engineNumber?.toLowerCase().includes(q));
        const chassisMatch = Boolean(c.chassisNumber?.toLowerCase().includes(q));
        let dueMatch = false;
        if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
          const dueInfo = calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt);
          dueMatch =
            dueInfo.formattedShort.toLowerCase().includes(q) ||
            dueInfo.formattedLong.toLowerCase().includes(q) ||
            dueInfo.cycleRangeText.toLowerCase().includes(q) ||
            `ชำระ 2 ${dueInfo.monthName}`.toLowerCase().includes(q);
        }
        return titleMatch || custMatch || phoneMatch || Boolean(dealerMatch) || bikeMatch || codeMatch || proposalMatch || Boolean(locationMatch) || idCardMatch || addressMatch || engineMatch || chassisMatch || dueMatch;
      }

      return true;
    });
  }, [cases, searchQuery, statusFilter, deliveryFilter, selectedMonthKey, selectedDueMonth]);

  // Group filtered cases by Year and Month
  const groupedCases = useMemo(() => {
    const map = new Map<string, SavedCaseRecord[]>();
    filteredCases.forEach((c) => {
      // If a specific month is selected, all filtered cases belong to that selected month's view
      // If 'all' is selected, group by effective month of delivery / approval / creation
      let keyYM = selectedMonthKey !== 'all' ? selectedMonthKey : getCaseCreatedYM(c);
      if (selectedMonthKey === 'all' && c.approvalStatus === 'approved') {
        if (c.deliveryStatus === 'delivered') {
          keyYM = getCaseDeliveryYM(c) || getCaseApprovalYM(c) || keyYM;
        } else {
          keyYM = getCaseApprovalYM(c) || keyYM;
        }
      }
      if (!keyYM) keyYM = getCurrentYearMonthKey();
      if (!map.has(keyYM)) {
        map.set(keyYM, []);
      }
      map.get(keyYM)!.push(c);
    });

    const groups: {
      key: string;
      year: number;
      month: number;
      monthName: string;
      items: SavedCaseRecord[];
      deliveredCount: number;
      pendingDeliveryCount: number;
    }[] = [];

    Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([key, items]) => {
        const [yrStr, moStr] = key.split('-');
        const yr = parseInt(yrStr, 10) + 543;
        const mo = parseInt(moStr, 10);
        const monthObj = THAI_MONTHS.find((m) => m.id === mo);

        const deliveredCount = items.filter(
          (c) => c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered'
        ).length;
        const pendingDeliveryCount = items.filter(
          (c) => c.approvalStatus === 'approved' && (!c.deliveryStatus || c.deliveryStatus === 'pending_delivery')
        ).length;

        groups.push({
          key,
          year: yr,
          month: mo,
          monthName: monthObj ? monthObj.name : `เดือน ${mo}`,
          items,
          deliveredCount,
          pendingDeliveryCount,
        });
      });

    return groups;
  }, [filteredCases, selectedMonthKey]);

  const handleSetApprovalStatus = (
    id: string,
    status: CaseApprovalStatus,
    deliveryStatus?: VehicleDeliveryStatus
  ) => {
    triggerHaptic(status === 'approved' ? 'success' : 'light');
    const updated = updateCaseApprovalStatus(id, status, deliveryStatus);
    setCases(updated);
    const label =
      status === 'approved'
        ? '✓ เปลี่ยนสถานะเป็น "อนุมัติ" เรียบร้อย'
        : status === 'rejected'
        ? '✕ เปลี่ยนสถานะเป็น "ไม่อนุมัติ"'
        : status === 'cancelled'
        ? '⊘ เปลี่ยนสถานะเป็น "ยกเลิก"'
        : '⏱ เปลี่ยนสถานะเป็น "รอผล"';
    showToast(label);
  };

  const handleSetDeliveryStatus = (id: string, deliveryStatus: VehicleDeliveryStatus) => {
    triggerHaptic('success');
    const updated = updateCaseDeliveryStatus(id, deliveryStatus);
    setCases(updated);
    showToast(
      deliveryStatus === 'delivered'
        ? '✓ อัปเดตสถานะ: "รับรถแล้ว"'
        : '⏳ อัปเดตสถานะ: "รอรับรถ"'
    );
  };

  const handleQuickDealStatusChange = (id: string, nextStatus: DealStatusKey) => {
    if (nextStatus === 'pending') {
      handleSetApprovalStatus(id, 'pending');
      return;
    }
    if (nextStatus === 'approved_pending') {
      handleSetApprovalStatus(id, 'approved', 'pending_delivery');
      return;
    }
    if (nextStatus === 'delivered') {
      triggerHaptic('success');
      updateCaseApprovalStatus(id, 'approved', 'delivered');
      const updated = updateCaseDeliveryStatus(id, 'delivered');
      setCases(updated);
      showToast('✓ อัปเดตสถานะเป็น "รับรถแล้ว" เรียบร้อย');
      return;
    }
    if (nextStatus === 'rejected') {
      handleSetApprovalStatus(id, 'rejected');
      return;
    }
    handleSetApprovalStatus(id, 'cancelled');
  };

  const handleSetDates = (
    id: string,
    dates: { approvalDate?: string; deliveryDate?: string }
  ) => {
    triggerHaptic('success');
    const updated = updateCaseDates(id, dates);
    setCases(updated);
    if (dates.approvalDate) {
      showToast(`✓ อัปเดตวันอนุมัติ: ${formatThaiDateOnly(dates.approvalDate)}`);
    } else if (dates.deliveryDate) {
      showToast(`✓ อัปเดตวันรับรถ: ${formatThaiDateOnly(dates.deliveryDate)}`);
    }
  };

  const handleSaveLocation = (id: string, location: string) => {
    const updated = updateCaseGoogleMapsLocation(id, location);
    setCases(updated);
  };

  const handleSaveVehicleNumbers = (
    id: string,
    numbers: { engineNumber?: string; chassisNumber?: string },
    toastText?: string
  ) => {
    const updated = updateCaseVehicleNumbers(id, numbers);
    setCases(updated);
    if (toastText) {
      showToast(toastText);
    }
  };

  const handlePasteLocation = async (id: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          triggerHaptic('success');
          handleSaveLocation(id, text.trim());
          showToast('✓ วางที่อยู่/ลิงก์ Google Maps สำเร็จ');
          return;
        }
      }
    } catch {
      // Clipboard API might require permission or not available in iframe
    }
    showToast('💡 สามารถแตะค้างที่ช่องแล้วเลือก "วาง" (Paste) ได้เลย');
  };

  const handleOpenGoogleMaps = (location?: string) => {
    const url = getGoogleMapsNavigationUrl(location);
    if (!url) {
      triggerHaptic('warning');
      showToast('⚠️ กรุณาระบุหรือวางที่อยู่ / ลิงก์ Google Maps ก่อนนำทาง');
      return;
    }
    triggerHaptic('success');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePdfUpload = async (caseId: string, file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      triggerHaptic('warning');
      showToast('⚠️ รองรับเฉพาะไฟล์เอกสาร PDF (.pdf) เท่านั้น');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      triggerHaptic('warning');
      showToast('⚠️ ไฟล์มีขนาดเกิน 25MB กรุณาลดขนาดไฟล์ก่อนอัปโหลด');
      return;
    }

    try {
      setIsUploadingPdf(true);
      triggerHaptic('light');
      const docInfo = await saveApprovalDocFile(caseId, file);
      const updated = updateCaseApprovalDoc(caseId, docInfo);
      setCases(updated);
      const stored = await getApprovalDocData(caseId);
      if (stored?.dataUrl) {
        setInlinePdfDataUrl(stored.dataUrl);
      }
      triggerHaptic('success');
      showToast(`✓ อัปโหลด "${file.name}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      triggerHaptic('warning');
      showToast(`✕ เกิดข้อผิดพลาดในการอัปโหลด: ${err?.message || 'ไม่สามารถบันทึกได้'}`);
    } finally {
      setIsUploadingPdf(false);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
    }
  };

  const handleOpenExternalPdf = async (caseItem: SavedCaseRecord) => {
    try {
      setIsLoadingPdf(true);
      triggerHaptic('light');
      const data = await getApprovalDocData(caseItem.id);
      if (!data || !data.dataUrl) {
        triggerHaptic('warning');
        showToast('⚠️ ไม่พบข้อมูลไฟล์เอกสารในเครื่อง กรุณาลองอัปโหลดใหม่อีกครั้ง');
        return;
      }
      const fileName = data.name || caseItem.approvalDoc?.name || 'เอกสารการอนุมัติ.pdf';
      const opened = openPdfInExternalApp(data.dataUrl, fileName);
      if (opened) {
        triggerHaptic('success');
        showToast('✓ เปิดดูเอกสารด้วยแอพภายนอกเรียบร้อย');
      } else {
        triggerHaptic('warning');
        showToast('⚠️ ไม่สามารถเปิดด้วยแอพภายนอกได้โดยตรง กรุณากดปุ่มดาวน์โหลด');
      }
    } catch (err: any) {
      console.error('Failed to open PDF externally:', err);
      triggerHaptic('warning');
      showToast('✕ ไม่สามารถเปิดไฟล์เอกสารได้');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleDeletePdfDoc = async (caseId: string) => {
    try {
      triggerHaptic('light');
      await deleteApprovalDocFile(caseId);
      const updated = updateCaseApprovalDoc(caseId, undefined);
      setCases(updated);
      setInlinePdfDataUrl(null);
      setDeleteDocConfirmId(null);
      triggerHaptic('success');
      showToast('✓ ลบเอกสารการอนุมัติเรียบร้อยแล้ว');
    } catch {
      triggerHaptic('warning');
      showToast('✕ เกิดข้อผิดพลาดในการลบเอกสาร');
    }
  };

  const getCustomerDisplayName = (record: SavedCaseRecord): string => {
    if (record.customerName && record.customerName.trim()) {
      return record.customerName.trim();
    }
    if (record.caseTitle) {
      const parts = record.caseTitle.split(' - ');
      if (parts.length > 0 && parts[0].trim()) {
        return parts[0].trim();
      }
      return record.caseTitle.trim();
    }
    return 'คุณลูกค้า';
  };

  const executeDelete = (id: string) => {
    triggerHaptic('warning');
    const remaining = deleteCaseRecord(id);
    setCases(remaining);
    if (detailCase?.id === id) setDetailCase(null);
    setDeleteConfirmId(null);
    onDeleteCase?.(id);
    showToast('ลบรายการเรียบร้อยแล้ว');
  };

  const handleStartEditTitle = (c: SavedCaseRecord) => {
    triggerHaptic('light');
    setEditingId(c.id);
    setEditTitleInput(getCustomerDisplayName(c));
  };

  const handleSaveTitle = (id: string) => {
    if (!editTitleInput.trim()) return;
    triggerHaptic('success');
    const updated = updateCaseTitle(id, editTitleInput.trim());
    setCases(updated);
    setEditingId(null);
    showToast('แก้ไขชื่อลูกค้าสำเร็จ');
  };

  const handleClearAll = () => {
    triggerHaptic('warning');
    if (cases.length === 0) return;
    setShowClearAllConfirm(true);
  };

  const executeClearAll = () => {
    triggerHaptic('warning');
    clearAllCaseRecords();
    setCases([]);
    setDetailCase(null);
    setShowClearAllConfirm(false);
    onDeleteCase?.();
    showToast('ล้างรายการทั้งหมดแล้ว');
  };

  const handleExport = async () => {
    triggerHaptic('success');
    const jsonStr = exportCasesAsJson();
    const fileName = `MotoLease_Saved_Cases_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });

    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'ข้อมูลเคสที่บันทึก MotoLease',
            text: `ส่งออกข้อมูลเคส ${cases.length} รายการ`,
          });
          showToast('แชร์ไฟล์ข้อมูลเรียบร้อยแล้ว');
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์สำรองข้อมูล (JSON) แล้ว');
  };

  const handleExportExcel = () => {
    const targetCases = filteredCases.length > 0 ? filteredCases : cases;
    if (targetCases.length === 0) {
      triggerHaptic('warning');
      showToast('⚠️ ไม่มีรายการเคสสำหรับส่งออก Excel');
      return;
    }
    triggerHaptic('success');
    const label =
      selectedMonthKey === 'all'
        ? 'ทั้งหมด'
        : formatYearMonthLabel(selectedMonthKey);
    const fileName = exportSavedCasesToExcel(targetCases, label);
    showToast(`✓ ส่งออกไฟล์ Excel "${fileName}" (${targetCases.length} รายการ) แล้ว`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importCasesFromJson(content);
        if (res.success) {
          triggerHaptic('success');
          const allCases = getSavedCases();
          setCases(allCases);
          setSelectedMonthKey('all');
          setStatusFilter('all');
          setDeliveryFilter('all');
          setSelectedDueMonth('all');
          setSearchQuery('');
          const parts: string[] = [`นำเข้าข้อมูลสำเร็จ ${res.count} รายการ`];
          if ((res.updatedCount || 0) > 0 && (res.addedCount || 0) > 0) {
            parts[0] = `นำเข้าสำเร็จ ${res.count} รายการ (เพิ่มใหม่ ${res.addedCount}, อัปเดต ${res.updatedCount})`;
          } else if ((res.updatedCount || 0) > 0 && (res.addedCount || 0) === 0) {
            parts[0] = `ซิงค์ข้อมูลจากไฟล์สำรองเรียบร้อย ${res.updatedCount} รายการ`;
          }
          parts.push(`รวม ${allCases.length} เคส (แสดงทุกช่วงเวลาแล้ว)`);
          showToast(parts.join(' • '));
        } else {
          triggerHaptic('warning');
          showToast(res.error || 'เกิดข้อผิดพลาดในการนำเข้าไฟล์');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasActiveAdvancedFilter = selectedDueMonth !== 'all';

  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } = useModalTransition(
    isOpen,
    onClose
  );

  if (!shouldRender || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-modal-portal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/80 overflow-y-auto overscroll-contain ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[32px] w-full ${
          viewMode === 'table' && !detailCase ? 'max-w-5xl' : 'max-w-2xl'
        } max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] min-h-0 my-auto flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden relative transition-all duration-150 ${sheetAnimClass}`}
      >
        {/* Top Specular Accent Sheen */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-600 opacity-95" />

        {/* =========================================================================
            PANEL 1: SAVED CASES LIST / CARDS VIEW (หน้ารวมเคสทั้งหมด)
            ========================================================================= */}
        <div className={`flex-1 flex flex-col min-h-0 ${detailCase ? 'hidden' : 'flex'}`}>
          {/* Modal Header */}
        <div className="p-3.5 sm:p-5 pb-3 border-b border-sky-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-b from-sky-50/80 dark:from-slate-800/80 to-transparent shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <FolderArchive className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight truncate">
                  เคสที่บันทึกไว้ในอุปกรณ์
                </h2>
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                บันทึกลงในเครื่อง เรียกดูหรือนำกลับมาใช้งานได้ตลอดเวลา
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Switcher: ตาราง vs รายชื่อ vs การ์ด */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-colors duration-150 cursor-pointer select-none touch-manipulation whitespace-nowrap shrink-0 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="มุมมองตาราง (แสดงคอลัมน์สถานะชัดเจน)"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ตาราง</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-colors duration-150 cursor-pointer select-none touch-manipulation whitespace-nowrap shrink-0 ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="มุมมองรายชื่อลูกค้า (แตะเพื่อเปิดดูรายละเอียด)"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">รายชื่อ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-colors duration-150 cursor-pointer select-none touch-manipulation whitespace-nowrap shrink-0 ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="มุมมองการ์ดสรุป"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">การ์ด</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Action & Search Bar */}
        <div className="p-2.5 sm:p-4 pb-2.5 space-y-2 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, รุ่นรถ, รหัสรุ่น หรือ Proposal..."
                className="w-full pl-9 pr-7 py-1.5 sm:py-2 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200/90 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {onSaveCurrentCase && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveCurrentCase();
                    setCases(getSavedCases());
                    showToast('บันทึกเคสปัจจุบันลงเครื่องเรียบร้อยแล้ว!');
                  }}
                  className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs shadow-sky-500/20 hover:opacity-95 cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                  title="บันทึกข้อมูลหน้าจอปัจจุบันเป็นเคสใหม่"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">บันทึกเคสนี้</span>
                </button>
              )}

              {/* ส่งออก Excel */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={cases.length === 0}
                className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 disabled:opacity-50 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/70 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="ส่งออกรายการเคสที่แสดงอยู่เป็นไฟล์ Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px]">Excel</span>
              </button>

              {/* ส่งออก JSON */}
              <button
                type="button"
                onClick={handleExport}
                disabled={cases.length === 0}
                className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="ส่งออก / แชร์ไฟล์สำรองข้อมูล (JSON)"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span className="hidden sm:inline text-[11px]">ส่งออก</span>
              </button>

              {/* นำเข้า */}
              <label
                className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="นำเข้าไฟล์เคสจากอีกเครื่อง"
              >
                <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="hidden sm:inline text-[11px]">นำเข้า</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>

              {/* วิธีย้ายเครื่อง */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowTransferGuide((prev) => !prev);
                }}
                className={`p-1.5 sm:px-2 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1 border shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all ${
                  showTransferGuide
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-200/90 dark:border-amber-800/70'
                }`}
                title="วิธีย้ายข้อมูลเคสข้ามเครื่อง"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </button>

              {cases.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-1.5 sm:p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/70 transition-colors cursor-pointer"
                  title="ล้างรายการทั้งหมด"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="absolute top-16 inset-x-4 mx-auto max-w-sm z-40 p-2.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold text-center shadow-xl backdrop-blur-md animate-fade-in flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Scrollable Content Area (Controls + Filters + Cases List) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-4 space-y-2.5">
          {/* Cloud Sync / Google Sign-In Status Bar */}
          <CloudSyncCard compact localCount={cases.length} />

          {/* Primary Month Selector Bar */}
          {cases.length > 0 && (
            <div className="bg-gradient-to-r from-sky-50 via-indigo-50/40 to-sky-50/60 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-sky-100 dark:border-slate-700/80 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                {/* Month Navigator */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>

                  {/* Previous Month */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedMonthKey((prev) => getAdjacentMonthKey(prev, -1));
                    }}
                    className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors cursor-pointer shrink-0"
                    title="เดือนก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Dropdown */}
                  <div className="relative min-w-0 flex-1 max-w-[210px] sm:max-w-[250px]">
                    <select
                      value={selectedMonthKey}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setSelectedMonthKey(e.target.value);
                      }}
                      className="w-full appearance-none pl-2.5 pr-7 py-1 rounded-xl text-xs sm:text-[13px] font-extrabold bg-white dark:bg-slate-900 border border-sky-200 dark:border-slate-700 text-sky-950 dark:text-sky-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer shadow-2xs truncate"
                    >
                      <option value="all">ทุกช่วงเวลา (เคสทั้งหมด)</option>
                      {availableMonthOptions.map((ym) => (
                        <option key={ym} value={ym}>
                          {formatYearMonthLabel(ym)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Next Month */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedMonthKey((prev) => getAdjacentMonthKey(prev, 1));
                    }}
                    className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors cursor-pointer shrink-0"
                    title="เดือนถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Reset to Current Month Button */}
                {selectedMonthKey !== getCurrentYearMonthKey() && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('success');
                      setSelectedMonthKey(getCurrentYearMonthKey());
                    }}
                    className="p-1 sm:p-1.5 rounded-xl bg-white hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70 text-xs font-extrabold flex items-center justify-center shadow-2xs cursor-pointer shrink-0 transition-all active:scale-95"
                    title="กลับไปยังเดือนปัจจุบัน"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </button>
                )}
              </div>

              {/* Monthly Summary KPI Badges */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto scrollbar-none pt-0.5 text-[10px] sm:text-[11px] tabular-nums">
                <div
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 font-extrabold whitespace-nowrap shrink-0"
                  title="จำนวนเคสที่รับรถในงวดเดือนนี้"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>รับรถ</span>
                  <span className="text-emerald-950 dark:text-emerald-100 font-black">{monthlyStats.deliveredInMonth}</span>
                </div>

                <div
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/70 text-sky-800 dark:text-sky-200 font-bold whitespace-nowrap shrink-0"
                  title="จำนวนเคสที่อนุมัติในงวดเดือนนี้"
                >
                  <span>อนุมัติ</span>
                  <span className="text-sky-950 dark:text-sky-100 font-black">{monthlyStats.approvedInMonth}</span>
                </div>

                {/* Badge: เคสที่อนุมัติเดือนก่อน แต่มารับรถเดือนนี้ */}
                {monthlyStats.carriedOverDelivered > 0 && (
                  <div
                    className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800/70 text-teal-800 dark:text-teal-200 font-bold whitespace-nowrap shrink-0"
                    title="มีเคสที่อนุมัติในงวดก่อนหน้านี้ แต่มารับรถในเดือนนี้ นับเป็นยอดรับรถของเดือนนี้"
                  >
                    <BadgePercent className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>ยกยอดรับรถ</span>
                    <span className="text-teal-950 dark:text-teal-100 font-black">+{monthlyStats.carriedOverDelivered}</span>
                  </div>
                )}

                {/* Badge: เคสที่อนุมัติจากเดือนก่อน แต่ยังรอรับรถ */}
                {monthlyStats.carriedOverPendingDelivery > 0 && (
                  <div
                    className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/70 text-amber-950 dark:text-amber-200 font-bold whitespace-nowrap shrink-0"
                    title="เคสที่อนุมัติจากเดือนก่อน แต่ยังไม่ได้รับรถ ยกยอดมารอรับรถในงวดนี้"
                  >
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>ยกยอดรอรับ</span>
                    <span className="text-amber-950 dark:text-amber-100 font-black">{monthlyStats.carriedOverPendingDelivery}</span>
                  </div>
                )}

                {/* Badge: เคสที่อนุมัติเดือนนี้ แต่ลูกค้ารับรถเดือนถัดไป */}
                {monthlyStats.approvedDeliveredLater > 0 && (
                  <div
                    className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 text-indigo-800 dark:text-indigo-200 font-bold whitespace-nowrap shrink-0"
                    title="เคสอนุมัติในเดือนนี้ แต่ลูกค้ารับรถในเดือนถัดไป (นับยอดอนุมัติในงวดนี้)"
                  >
                    <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>รับเดือนหน้า</span>
                    <span className="text-indigo-950 dark:text-indigo-100 font-black">{monthlyStats.approvedDeliveredLater}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Filter Chips Bar */}
          {cases.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                <div className="flex items-center gap-1.5">
                  {/* ทั้งหมด */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStatusFilter('all');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] tabular-nums ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 dark:bg-sky-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>ทั้งหมด</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'all' ? 'bg-slate-700 dark:bg-sky-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {statusCounts.all}
                    </span>
                  </button>

                  {/* อนุมัติ */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStatusFilter('approved');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] tabular-nums ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 dark:ring-emerald-700'
                        : 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>อนุมัติ</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'approved' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                    }`}>
                      {statusCounts.approved}
                    </span>
                  </button>

                  {/* รอผล */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStatusFilter('pending');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] tabular-nums ${
                      statusFilter === 'pending'
                        ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300 dark:ring-sky-700'
                        : 'bg-white dark:bg-slate-800 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-sky-200 dark:border-sky-800/70'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>รอผล</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'pending' ? 'bg-sky-700 text-white' : 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200'
                    }`}>
                      {statusCounts.pending}
                    </span>
                  </button>

                  {/* ไม่อนุมัติ */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStatusFilter('rejected');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] tabular-nums ${
                      statusFilter === 'rejected'
                        ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300 dark:ring-rose-700'
                        : 'bg-white dark:bg-slate-800 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70'
                    }`}
                  >
                    <XCircle className="w-3 h-3" />
                    <span>ไม่อนุมัติ</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'rejected' ? 'bg-rose-700 text-white' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                    }`}>
                      {statusCounts.rejected}
                    </span>
                  </button>

                  {/* ยกเลิก */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setStatusFilter('cancelled');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                      statusFilter === 'cancelled'
                        ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Ban className="w-3 h-3" />
                    <span>ยกเลิก</span>
                  </button>
                </div>

                {/* ปุ่มเปิด/ปิด แผงตัวกรองเดือน & งวดชำระ */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowAdvancedFilters((prev) => !prev);
                  }}
                  className={`px-2 py-1 rounded-xl text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                    hasActiveAdvancedFilter || showAdvancedFilters
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 shadow-2xs font-extrabold'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title="ตัวกรองเพิ่มเติม (เดือน/ปี, กำหนดชำระงวดแรก)"
                >
                  <SlidersHorizontal className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>ตัวกรองงวด/เดือน</span>
                  {hasActiveAdvancedFilter && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                  {showAdvancedFilters ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Sub-filter for Delivery Status when "อนุมัติ" is active */}
              {statusFilter === 'approved' && (
                <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-600 dark:text-slate-300 animate-fade-in flex-wrap tabular-nums">
                  <span className="font-bold text-slate-400 dark:text-slate-500 text-[10px]">การรับรถ:</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition-all ${
                      deliveryFilter === 'all'
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    ทั้งหมด ({statusCounts.approved})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDeliveryFilter('delivered');
                    }}
                    className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition-all flex items-center gap-1 ${
                      deliveryFilter === 'delivered'
                        ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 font-bold border border-teal-300 dark:border-teal-700'
                        : 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/50'
                    }`}
                  >
                    <Check className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>รับรถแล้ว ({statusCounts.delivered})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDeliveryFilter('pending_delivery');
                    }}
                    className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition-all flex items-center gap-1 ${
                      deliveryFilter === 'pending_delivery'
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-700'
                        : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>รอรับรถ ({statusCounts.pendingDelivery})</span>
                  </button>
                </div>
              )}

              {/* Expandable Advanced Filters (First Payment Due Month) */}
              {showAdvancedFilters && (
                <div className="pt-2 mt-1 border-t border-slate-200/80 dark:border-slate-700 space-y-2 animate-fade-in bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-800/60">
                  {/* First Due Month */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                      <CalendarClock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>งวดแรกชำระ:</span>
                    </div>

                    <select
                      value={selectedDueMonth}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setSelectedDueMonth(e.target.value);
                      }}
                      className={`px-2 py-1 rounded-xl text-xs font-bold border cursor-pointer shadow-2xs dark:[color-scheme:dark] ${
                        selectedDueMonth !== 'all'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 dark:border-indigo-600 text-indigo-900 dark:text-indigo-100 font-extrabold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <option value="all">ทุกงวดแรกที่ครบกำหนด</option>
                      {dueMonthStats.activeDueMonths.map((item) => (
                        <option key={item.key} value={item.key}>
                          งวดแรก: {item.label} ({item.count} คน)
                        </option>
                      ))}
                    </select>

                    {selectedDueMonth !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedDueMonth('all');
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-rose-600 dark:text-rose-300 hover:text-rose-800 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 cursor-pointer"
                      >
                        ✕ ล้างตัวกรองงวด
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clear All In-App Confirmation Banner */}
          {showClearAllConfirm && (
            <div className="mt-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800/70 text-rose-900 dark:text-rose-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="font-semibold text-rose-950 dark:text-rose-100">
                  ต้องการลบเคสทั้งหมด ({cases.length} รายการ) ออกจากเครื่องใช่หรือไม่?
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={executeClearAll}
                  className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  ยืนยันลบทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirm(false)}
                  className="px-2.5 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Transfer Guide Dialog */}
          {showTransferGuide && (
            <div className="mt-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-sky-50 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-300 dark:border-amber-800/70 text-slate-800 dark:text-slate-200 text-xs space-y-2 animate-fade-in shadow-xs relative">
              <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-800/50 pb-1.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                    วิธีย้ายข้อมูลเคสจากเครื่องหนึ่งไปอีกเครื่อง
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransferGuide(false)}
                  className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 text-slate-500 dark:text-slate-400 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5 text-slate-700 dark:text-slate-300 text-[11px]">
                <p>
                  1. <strong>เครื่องเดิม:</strong> กดปุ่ม <span className="text-sky-700 dark:text-sky-300 font-bold">"ส่งออก"</span> ด้านบน แล้วส่งไฟล์ <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">.json</span> เข้า LINE หรือ AirDrop ส่งไปอีกเครื่อง
                </p>
                <p>
                  2. <strong>เครื่องใหม่:</strong> เปิดแอป เข้าหน้านี้แล้วกดปุ่ม <span className="text-teal-700 dark:text-teal-300 font-bold">"นำเข้า"</span> แล้วเลือกไฟล์ที่ได้รับ ข้อมูลจะเข้ามาครบถ้วนทันที
                </p>
              </div>
            </div>
          )}

          {filteredCases.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-sky-50 dark:bg-sky-950/60 text-sky-500 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-100 dark:border-sky-800/60 shadow-inner">
                <FolderArchive className="w-7 h-7 opacity-70" />
              </div>
              <div className="max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {searchQuery ? 'ไม่พบเคสที่ตรงกับการค้นหา' : 'ยังไม่มีเคสที่บันทึกไว้ในอุปกรณ์'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {searchQuery
                    ? 'ลองเปลี่ยนคำค้นหาเป็นชื่อลูกค้า หรือรุ่นรถมอเตอร์ไซค์'
                    : 'เมื่อคุณกรอกข้อมูลคำนวณค่างวด สามารถกดปุ่ม "บันทึกเคสนี้" เพื่อเก็บประวัติไว้ดูหรือนำกลับมาใช้งานต่อได้ตลอดเวลา'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {groupedCases.map((group) => (
                <div key={group.key} className="space-y-2">
                  {/* Sticky Month & Year Header Banner */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-100/90 via-sky-50 to-white dark:from-sky-950/70 dark:via-slate-800/90 dark:to-slate-900 border border-sky-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                        {group.monthName} พ.ศ. {group.year}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300 font-bold tabular-nums">
                      <span className="bg-sky-500 text-white px-2 py-0.2 rounded-full">
                        {group.items.length} รายการ
                      </span>
                      {group.deliveredCount > 0 && (
                        <span className="bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border border-transparent dark:border-teal-800/60 px-1.5 py-0.2 rounded-full">
                          รับรถ {group.deliveredCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Records: TABLE VIEW (ตารางรายการเคสพร้อมคอลัมน์สถานะ) */}
                  <div className={viewMode === 'table' ? 'block' : 'hidden'}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto scrollbar-thin">
                        <table className="w-full text-left border-collapse min-w-[740px]">
                          <thead>
                            <tr className="bg-slate-50/95 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 text-[10.5px] font-extrabold text-slate-600 dark:text-slate-300">
                              <th className="py-2.5 px-2.5 text-center w-9 tabular-nums">#</th>
                              <th className="sticky left-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs py-2.5 px-3 border-r border-slate-200/80 dark:border-slate-700 min-w-[145px]">
                                ชื่อลูกค้า
                              </th>
                              <th className="py-2.5 px-2.5 min-w-[142px] whitespace-nowrap">
                                สถานะ
                              </th>
                              <th className="py-2.5 px-2.5 min-w-[165px]">
                                รุ่นรถ / ดีลเลอร์
                              </th>
                              <th className="py-2.5 px-2.5 text-right min-w-[115px] whitespace-nowrap">
                                ค่างวด / ยอดจัด
                              </th>
                              <th className="py-2.5 px-2.5 min-w-[110px] whitespace-nowrap">
                                งวดแรก / วันที่
                              </th>
                              <th className="py-2.5 px-2 text-center w-[76px] whitespace-nowrap">
                                จัดการ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px] bg-white dark:bg-slate-900">
                            {group.items.map((record, idx) => {
                              const isCurrentEditing = activeEditingId === record.id;
                              const isApproved = record.approvalStatus === 'approved';
                              const isDelivered = record.deliveryStatus === 'delivered';
                              const firstDue = isDelivered
                                ? calculateFirstPaymentDueDate(record.deliveryDate || record.createdAt)
                                : null;
                              const custName = getCustomerDisplayName(record);
                              const statusMeta = getDealStatusMeta(record);

                              return (
                                <tr
                                  key={record.id}
                                  onClick={() => setDetailCase(record)}
                                  className={`transition-colors duration-150 cursor-pointer group ${
                                    isCurrentEditing
                                      ? 'bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-50/70 dark:hover:bg-amber-950/50'
                                      : 'hover:bg-sky-50/50 dark:hover:bg-sky-950/40'
                                  }`}
                                >
                                  {/* # */}
                                  <td className="py-2.5 px-2.5 text-center text-[10.5px] font-bold text-slate-400 dark:text-slate-500 tabular-nums align-middle">
                                    {idx + 1}
                                  </td>

                                  {/* ชื่อลูกค้า (Sticky Left) */}
                                  <td
                                    className={`sticky left-0 z-10 backdrop-blur-xs py-2.5 px-3 border-r border-slate-200/70 dark:border-slate-700/80 max-w-[205px] align-middle ${
                                      isCurrentEditing
                                        ? 'bg-amber-50/95 dark:bg-amber-950/80 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/90'
                                        : 'bg-white/95 dark:bg-slate-900/95 group-hover:bg-sky-50/80 dark:group-hover:bg-sky-950/60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <CustomerAvatar
                                        photoUrl={record.customerPhotoUrl}
                                        customerName={custName}
                                        size="sm"
                                        fallbackClassName={
                                          isApproved
                                            ? isDelivered
                                              ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/70'
                                              : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                            : record.approvalStatus === 'rejected'
                                            ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
                                            : record.approvalStatus === 'cancelled'
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                            : 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/70'
                                        }
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1 min-w-0">
                                          <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-300 truncate">
                                            {custName}
                                          </span>
                                          {isCurrentEditing && (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shrink-0">
                                              แก้ไข
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate tabular-nums">
                                          {record.customerPhone ? record.customerPhone : formatThaiDateOnly(record.createdAt)}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* สถานะ (Explicit Status Column + Quick Status Selector) */}
                                  <td
                                    className="py-2 px-2.5 align-middle"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="space-y-1">
                                      <div className="relative inline-flex items-center w-full max-w-[136px]">
                                        <span className="pointer-events-none absolute left-2 flex items-center">
                                          {statusMeta.key === 'delivered' && (
                                            <PackageCheck className={`w-3.5 h-3.5 ${statusMeta.iconColorClass}`} />
                                          )}
                                          {statusMeta.key === 'approved_pending' && (
                                            <CheckCircle2 className={`w-3.5 h-3.5 ${statusMeta.iconColorClass}`} />
                                          )}
                                          {statusMeta.key === 'rejected' && (
                                            <XCircle className={`w-3.5 h-3.5 ${statusMeta.iconColorClass}`} />
                                          )}
                                          {statusMeta.key === 'cancelled' && (
                                            <Ban className={`w-3.5 h-3.5 ${statusMeta.iconColorClass}`} />
                                          )}
                                          {statusMeta.key === 'pending' && (
                                            <Clock className={`w-3.5 h-3.5 ${statusMeta.iconColorClass}`} />
                                          )}
                                        </span>
                                        <select
                                          aria-label={`สถานะของ ${custName}`}
                                          value={statusMeta.key}
                                          onChange={(e) =>
                                            handleQuickDealStatusChange(
                                              record.id,
                                              e.target.value as DealStatusKey
                                            )
                                          }
                                          className={`w-full appearance-none pl-7 pr-6 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/25 whitespace-nowrap ${statusMeta.selectClass}`}
                                        >
                                          <option value="pending">รออนุมัติ</option>
                                          <option value="approved_pending">อนุมัติแล้ว</option>
                                          <option value="delivered">รับรถแล้ว</option>
                                          <option value="rejected">ไม่อนุมัติ</option>
                                          <option value="cancelled">ยกเลิก</option>
                                        </select>
                                        <ChevronDown className="w-3 h-3 opacity-60 pointer-events-none absolute right-1.5" />
                                      </div>

                                      {statusMeta.subLabel && (
                                        <div className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400 pl-0.5 tabular-nums whitespace-nowrap">
                                          {statusMeta.subLabel}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* รุ่นรถ / ดีลเลอร์ */}
                                  <td className="py-2.5 px-2.5 max-w-[190px] align-middle">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                      {record.bikeModelName || 'ไม่ระบุรุ่นรถ'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                      {record.dealerName ? (
                                        <span className="text-sky-700 dark:text-sky-300 font-medium">{record.dealerName}</span>
                                      ) : (
                                        <span>{record.snapshot.proposalCode}</span>
                                      )}
                                    </div>
                                    {isApproved && isDelivered && (record.engineNumber || record.chassisNumber) && (
                                      <div className="flex items-center gap-1 mt-0.5 flex-wrap font-mono text-[9.5px] font-bold text-teal-800 dark:text-teal-300 truncate">
                                        {record.engineNumber && <span>E:{record.engineNumber}</span>}
                                        {record.chassisNumber && <span>C:{record.chassisNumber}</span>}
                                      </div>
                                    )}
                                  </td>

                                  {/* ค่างวด / ยอดจัด */}
                                  <td className="py-2.5 px-2.5 text-right tabular-nums align-middle whitespace-nowrap">
                                    <div className="font-black text-sky-700 dark:text-sky-300 text-xs">
                                      {formatBaht(record.snapshot.monthlyInstallment)}
                                      <span className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-400">/ด.</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {record.term} งวด · จัด {formatBaht(record.snapshot.financeAmount, true)}
                                    </div>
                                  </td>

                                  {/* งวดแรก / วันที่ */}
                                  <td className="py-2.5 px-2.5 tabular-nums align-middle whitespace-nowrap">
                                    {firstDue ? (
                                      <div className="text-[10.5px] font-bold text-indigo-800 dark:text-indigo-300">
                                        งวดแรก 2 {firstDue.monthShort} {firstDue.thaiShortYear}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                        บันทึก {formatThaiDateOnly(record.createdAt)}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[9.5px] text-slate-500 dark:text-slate-400">
                                      <span>{record.snapshot.proposalCode}</span>
                                      {record.approvalDoc && (
                                        <span className="text-rose-600 dark:text-rose-400 font-bold">· PDF</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* จัดการ */}
                                  <td className="py-2.5 px-2 text-center align-middle">
                                    <div className="inline-flex items-center justify-center gap-1">
                                      {isApproved && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            triggerHaptic('light');
                                            setApprovalModalCase(record);
                                          }}
                                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 transition-colors cursor-pointer"
                                          title="เปิดดูใบอนุมัติผลชั่วคราว"
                                        >
                                          <FileCheck className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDetailCase(record);
                                        }}
                                        className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-sky-500 group-hover:text-white text-slate-500 dark:text-slate-400 inline-flex items-center justify-center transition-colors cursor-pointer"
                                        title="ดูรายละเอียดเคส"
                                      >
                                        <ChevronRight className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Customer Records: LIST VIEW (รายการชื่อลูกค้า) */}
                  <div className={viewMode === 'list' ? 'block' : 'hidden'}>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
                      {group.items.map((record) => {
                        const isCurrentEditing = activeEditingId === record.id;
                        const isApproved = record.approvalStatus === 'approved';
                        const isDelivered = record.deliveryStatus === 'delivered';
                        const firstDue = isDelivered
                          ? calculateFirstPaymentDueDate(record.deliveryDate || record.createdAt)
                          : null;
                        const custName = getCustomerDisplayName(record);
                        const firstLetter = custName.slice(0, 1) || 'ค';
                        const statusMeta = getDealStatusMeta(record);

                        let crossMonthBadge: { label: string; className: string; title?: string } | null = null;
                        if (isApproved && isDelivered) {
                          const approvalYM = getCaseApprovalYM(record);
                          const deliveryYM = getCaseDeliveryYM(record);
                          if (approvalYM && deliveryYM && approvalYM < deliveryYM) {
                            crossMonthBadge = {
                              label: `ยกยอดรับรถ (อนุมัติ ${formatThaiDateOnly(record.approvalDate)})`,
                              className: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800/70',
                              title: `อนุมัติเมื่อ ${formatThaiDateOnly(record.approvalDate)} และมารับรถในเดือนนี้`,
                            };
                          } else if (approvalYM && deliveryYM && approvalYM > deliveryYM) {
                            crossMonthBadge = {
                              label: 'รับรถก่อนผล',
                              className: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/70',
                            };
                          }
                        } else if (isApproved && !isDelivered) {
                          const approvalYM = getCaseApprovalYM(record);
                          const deliveryYM = getCaseDeliveryYM(record);
                          if (approvalYM && selectedMonthKey !== 'all' && approvalYM < selectedMonthKey) {
                            crossMonthBadge = {
                              label: `ยกยอดรอรับรถ (${formatThaiDateOnly(record.approvalDate)})`,
                              className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/70',
                              title: `อนุมัติตั้งแต่งวด ${formatYearMonthLabel(approvalYM)} แต่ยังไม่ได้รับรถ`,
                            };
                          } else if (approvalYM && deliveryYM && deliveryYM > approvalYM) {
                            crossMonthBadge = {
                              label: `รับรถ ${formatThaiDateOnly(record.deliveryDate)}`,
                              className: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/70',
                              title: `อนุมัติในงวดนี้ กำหนดรับรถ ${formatThaiDateOnly(record.deliveryDate)}`,
                            };
                          }
                        }

                        return (
                          <div
                            key={record.id}
                            onClick={() => setDetailCase(record)}
                            className={`p-3 sm:p-3.5 hover:bg-sky-50/60 dark:hover:bg-sky-950/40 transition-colors duration-150 cursor-pointer group active:bg-sky-100/60 dark:active:bg-sky-900/50 space-y-1.5 ${
                              isCurrentEditing ? 'bg-amber-50/35 dark:bg-amber-950/30' : ''
                            }`}
                          >
                            {/* Top Row */}
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <CustomerAvatar
                                  photoUrl={record.customerPhotoUrl}
                                  customerName={custName}
                                  size="md"
                                  fallbackClassName={
                                    isApproved
                                      ? isDelivered
                                        ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/70'
                                        : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                                      : record.approvalStatus === 'rejected'
                                      ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70'
                                      : record.approvalStatus === 'cancelled'
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                      : 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/70'
                                  }
                                />

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <MarqueeText className="font-extrabold text-[13px] sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors min-w-0">
                                      {custName}
                                    </MarqueeText>
                                    {isCurrentEditing && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shrink-0 whitespace-nowrap">
                                        กำลังแก้ไข
                                      </span>
                                    )}
                                    {record.approvalDoc && (
                                      <span
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 inline-flex items-center gap-0.5 shrink-0 whitespace-nowrap"
                                        title={`แนบเอกสารแล้ว: ${record.approvalDoc.name}`}
                                      >
                                        <FileText className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                                        <span>PDF</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div
                                  className={`px-2 py-0.5 sm:py-1 rounded-lg border text-[10px] sm:text-[10.5px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${statusMeta.badgeClass}`}
                                  title={statusMeta.subLabel || statusMeta.label}
                                >
                                  {statusMeta.key === 'delivered' && (
                                    <PackageCheck className={`w-3 h-3 shrink-0 ${statusMeta.iconColorClass}`} />
                                  )}
                                  {statusMeta.key === 'approved_pending' && (
                                    <CheckCircle2 className={`w-3 h-3 shrink-0 ${statusMeta.iconColorClass}`} />
                                  )}
                                  {statusMeta.key === 'rejected' && (
                                    <XCircle className={`w-3 h-3 shrink-0 ${statusMeta.iconColorClass}`} />
                                  )}
                                  {statusMeta.key === 'cancelled' && (
                                    <Ban className={`w-3 h-3 shrink-0 ${statusMeta.iconColorClass}`} />
                                  )}
                                  {statusMeta.key === 'pending' && (
                                    <Clock className={`w-3 h-3 shrink-0 ${statusMeta.iconColorClass}`} />
                                  )}
                                  <span>{statusMeta.label}</span>
                                </div>

                                {isApproved && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerHaptic('light');
                                      setApprovalModalCase(record);
                                    }}
                                    className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/70 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
                                    title="เปิดดูใบอนุมัติผลชั่วคราว (Provisional Approval Certificate)"
                                  >
                                    <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  </button>
                                )}

                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-sky-500 group-hover:text-white text-slate-400 dark:text-slate-400 flex items-center justify-center transition-colors duration-150 shrink-0">
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>

                            {/* Middle Row */}
                            <div className="pl-[46px] min-w-0">
                              <MarqueeText className="text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5">
                                  {record.bikeModelName && (
                                    <span className="text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1">
                                      <Bike className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                      <span>{record.bikeModelName}</span>
                                    </span>
                                  )}
                                  {record.dealerName && (
                                    <>
                                      {record.bikeModelName && <span className="text-slate-300 dark:text-slate-600">•</span>}
                                      <span className="text-sky-700 dark:text-sky-300 font-medium inline-flex items-center gap-1">
                                        <Building2 className="w-3 h-3 text-sky-500 dark:text-sky-400 shrink-0" />
                                        <span>{record.dealerName}</span>
                                      </span>
                                    </>
                                  )}
                                  {record.customerPhone && (
                                    <>
                                      {(record.bikeModelName || record.dealerName) && (
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                      )}
                                      <span className="text-slate-600 dark:text-slate-300 font-medium inline-flex items-center gap-0.5 tabular-nums">
                                        <Phone className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                        {record.customerPhone}
                                      </span>
                                    </>
                                  )}
                                </span>
                              </MarqueeText>
                            </div>

                            {isApproved && isDelivered && (record.engineNumber || record.chassisNumber) && (
                              <div className="pl-[46px] flex items-center gap-1.5 flex-wrap text-[10px] font-mono font-bold">
                                {record.engineNumber && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800/70 inline-flex items-center gap-1">
                                    <Barcode className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400 shrink-0" />
                                    <span>เครื่อง: {record.engineNumber}</span>
                                  </span>
                                )}
                                {record.chassisNumber && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200/80 dark:border-cyan-800/70 inline-flex items-center gap-1">
                                    <Barcode className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                    <span>ถัง: {record.chassisNumber}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Bottom Row */}
                            <div className="pl-[46px] flex items-center justify-between gap-2 flex-wrap text-[10.5px]">
                              <span className="text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap tabular-nums">
                                ค่างวด{' '}
                                <strong className="text-sky-700 dark:text-sky-300 font-extrabold">
                                  {formatBaht(record.snapshot.monthlyInstallment)}
                                </strong>
                                /ด. · {record.term} งวด
                              </span>

                              {(firstDue || crossMonthBadge) && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {firstDue && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/70 font-bold text-[10px] inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                                      <CalendarClock className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                      <span>งวดแรก: 2 {firstDue.monthShort} {firstDue.thaiShortYear}</span>
                                    </span>
                                  )}
                                  {crossMonthBadge && (
                                    <span
                                      className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border inline-flex items-center gap-0.5 whitespace-nowrap ${crossMonthBadge.className}`}
                                      title={crossMonthBadge.title}
                                    >
                                      <span>{crossMonthBadge.label}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customer Records: CARDS VIEW (การ์ดสรุป) */}
                  <div className={viewMode === 'cards' ? 'block' : 'hidden'}>
                    <div className="grid grid-cols-1 gap-2.5">
                      {group.items.map((record) => {
                        const isCurrentEditing = activeEditingId === record.id;
                        const isApproved = record.approvalStatus === 'approved';
                        const isDelivered = record.deliveryStatus === 'delivered';
                        const firstDue = isDelivered
                          ? calculateFirstPaymentDueDate(record.deliveryDate || record.createdAt)
                          : null;
                        const custName = getCustomerDisplayName(record);

                        return (
                          <div
                            key={record.id}
                            onClick={() => setDetailCase(record)}
                            className={`p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-800/80 border shadow-2xs hover:shadow-md transition-colors duration-150 cursor-pointer space-y-2 relative group ${
                              isCurrentEditing
                                ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-300/60 dark:ring-amber-600/40 bg-amber-50/20 dark:bg-amber-950/30'
                                : 'border-slate-200/80 dark:border-slate-700/80 hover:border-sky-300 dark:hover:border-sky-600'
                            }`}
                          >
                            {/* Card Top */}
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <CustomerAvatar
                                  photoUrl={record.customerPhotoUrl}
                                  customerName={custName}
                                  size="sm"
                                />
                                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                                  {custName}
                                </h3>
                                {record.customerPhone && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                                    ({record.customerPhone})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 flex-wrap">
                                {isApproved ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800/70">
                                    อนุมัติ
                                  </span>
                                ) : record.approvalStatus === 'rejected' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-800/70">
                                    ไม่อนุมัติ
                                  </span>
                                ) : record.approvalStatus === 'cancelled' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                                    ยกเลิก
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-200 border border-sky-200 dark:border-sky-800/70">
                                    รอผล
                                  </span>
                                )}

                                {isApproved && (
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      isDelivered
                                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800/70'
                                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800/70'
                                    }`}
                                  >
                                    {isDelivered ? 'รับรถแล้ว ✓' : 'รอรับรถ ⏳'}
                                  </span>
                                )}

                                {isApproved && isDelivered && (() => {
                                  const approvalYM = getCaseApprovalYM(record);
                                  const deliveryYM = getCaseDeliveryYM(record);
                                  if (approvalYM && deliveryYM && approvalYM < deliveryYM) {
                                    return (
                                      <span
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700"
                                        title={`อนุมัติเมื่อ ${formatThaiDateOnly(record.approvalDate)} และมารับรถในเดือนนี้`}
                                      >
                                        ยกยอดรับรถ
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}

                                {isApproved && !isDelivered && (() => {
                                  const approvalYM = getCaseApprovalYM(record);
                                  if (approvalYM && selectedMonthKey !== 'all' && approvalYM < selectedMonthKey) {
                                    return (
                                      <span
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/70 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                                        title={`อนุมัติเมื่อ ${formatThaiDateOnly(record.approvalDate)} (ยกยอดมารอรับรถ)`}
                                      >
                                        ยกยอดรอรับรถ
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}

                                {record.approvalStatus === 'approved' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerHaptic('light');
                                      setApprovalModalCase(record);
                                    }}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800/70 inline-flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer shadow-2xs active:scale-95"
                                    title="เปิดดูใบอนุมัติผลชั่วคราว (Provisional Approval Certificate)"
                                  >
                                    <FileCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>ใบอนุมัติผล</span>
                                  </button>
                                )}

                                {record.approvalDoc && (
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 border border-rose-300 dark:border-rose-800/70 inline-flex items-center gap-1"
                                    title={`แนบเอกสารแล้ว: ${record.approvalDoc.name}`}
                                  >
                                    <FileText className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                    <span>PDF</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Bike & Proposal row */}
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                              {record.bikeModelName && (
                                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                  <Bike className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                  {record.bikeModelName}
                                </span>
                              )}
                              <span>•</span>
                              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                {record.snapshot.proposalCode}
                              </span>
                              {firstDue && (
                                <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 px-2 py-0.5 rounded tabular-nums">
                                  งวดแรก: 2 {firstDue.monthShort} {firstDue.thaiShortYear}
                                </span>
                              )}
                            </div>

                            {isApproved && isDelivered && (record.engineNumber || record.chassisNumber) && (
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono font-bold">
                                {record.engineNumber && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border border-teal-200/80 dark:border-teal-800/70">
                                    <Barcode className="w-2.5 h-2.5 shrink-0" />
                                    <span>เลขเครื่อง: {record.engineNumber}</span>
                                  </span>
                                )}
                                {record.chassisNumber && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200/80 dark:border-cyan-800/70">
                                    <Barcode className="w-2.5 h-2.5 shrink-0" />
                                    <span>เลขถัง: {record.chassisNumber}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Financial 4 stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70 text-xs tabular-nums">
                              <div>
                                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">ค่างวดต่อเดือน:</span>
                                <span className="font-black text-sky-700 dark:text-sky-300 text-xs sm:text-sm">
                                  {formatBaht(record.snapshot.monthlyInstallment)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">ระยะเวลา:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                  {record.term} งวด
                                </span>
                              </div>
                              <div>
                                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">เงินดาวน์:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                  {formatBaht(record.snapshot.downAmount)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block">ยอดจัด:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                                  {formatBaht(record.snapshot.financeAmount, true)}
                                </span>
                              </div>
                            </div>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-bold pt-0.5">
                              <span className="text-slate-400 dark:text-slate-500 text-[10px] tabular-nums">
                                {formatThaiDateTime(record.createdAt)}
                              </span>
                              <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                แตะเพื่อดูรายละเอียดเคส <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span className="text-[11px] truncate pr-2">
            บันทึกลงในเครื่อง (LocalStorage) ปลอดภัย เป็นส่วนตัว
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer transition-colors shrink-0"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* =========================================================================
          PANEL 2: DEDICATED CASE DETAIL VIEW (หน้ารายละเอียดเคสที่เลือก)
          ========================================================================= */}
      {detailCase && (() => {
        const statusMeta = getDealStatusMeta(detailCase);
        const installmentEntries = detailCase.installmentPayments
          ? Object.entries(detailCase.installmentPayments)
              .map(([k, v]) => ({ num: Number(k), status: v }))
              .filter((item) => !isNaN(item.num) && item.num >= 1 && item.num <= 9)
              .sort((a, b) => a.num - b.num)
          : [];
        const paidInstallmentCount = installmentEntries.filter((i) => i.status === 'paid').length;
        const hasDeliveryFees =
          detailCase.includeDeliveryFees ||
          detailCase.registrationFee > 0 ||
          detailCase.theftInsuranceFee > 0;
        const driveAwayTotal =
          detailCase.snapshot.totalDriveAwayCost ??
          (detailCase.vehiclePrice +
            (detailCase.includeDeliveryFees
              ? (detailCase.registrationFee || 0) + (detailCase.theftInsuranceFee || 0)
              : 0));

        return (
          <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
            {/* Compact Top Navigation Bar (No squeezed customer name here) */}
            <div className="px-3.5 sm:px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2.5 bg-white/85 dark:bg-slate-900/90 backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => setDetailCase(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-sky-50 dark:bg-slate-800 dark:hover:bg-sky-950/60 text-slate-700 hover:text-sky-800 dark:text-slate-200 dark:hover:text-sky-300 font-bold text-xs flex items-center gap-1 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition-all duration-150 shrink-0 active:scale-95 select-none touch-manipulation"
                title="กลับไปยังหน้ารายการเคสทั้งหมด"
              >
                <ChevronLeft className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>รายการ</span>
              </button>

              {/* Quiet unboxed status indicator */}
              <div className="min-w-0 flex items-center justify-center gap-1.5 text-xs font-extrabold truncate">
                <span className={`inline-flex items-center gap-1 truncate ${statusMeta.iconColorClass}`}>
                  {statusMeta.key === 'delivered' ? (
                    <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                  ) : statusMeta.key === 'approved_pending' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : statusMeta.key === 'rejected' ? (
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : statusMeta.key === 'cancelled' ? (
                    <Ban className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="text-slate-800 dark:text-slate-100 truncate">
                    {statusMeta.label}
                  </span>
                </span>
                {statusMeta.subLabel && (
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate hidden xs:inline sm:inline">
                    · {statusMeta.subLabel}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setDetailCase(null);
                  onClose();
                }}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto tsd-slim-scroll p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 overscroll-contain bg-slate-50/70 dark:bg-slate-950/60">
              {/* 1. HERO PROFILE & CASE STATUS CARD */}
              <section
                className="case-detail-surface rounded-2xl p-4 sm:p-5 relative overflow-hidden space-y-3.5 animate-case-detail-rise"
                style={{ animationDelay: '20ms' }}
              >
                {/* Ambient subtle float glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-14 -right-12 w-44 h-44 rounded-full bg-gradient-to-br from-sky-400/20 via-cyan-300/15 to-indigo-400/15 dark:from-sky-500/15 dark:via-cyan-500/10 dark:to-indigo-500/10 blur-2xl animate-case-ambient-float"
                />

                {/* Hero Customer Identity Row (Unclipped Full Name) */}
                <div className="relative flex items-start gap-3.5">
                  {detailCase.customerPhotoUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowPhotoPreview((v) => !v);
                      }}
                      className="relative shrink-0 cursor-pointer group/avatar focus:outline-none"
                      title="แตะเพื่อดูรูปโปรไฟล์จากบัตรประชาชน"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-400/50 via-sky-400/40 to-teal-400/50 opacity-75 blur-[2px] animate-sidebar-avatar-ring"
                      />
                      <CustomerAvatar
                        photoUrl={detailCase.customerPhotoUrl}
                        customerName={getCustomerDisplayName(detailCase)}
                        size="lg"
                        className="relative w-14 h-14 sm:w-16 sm:h-16"
                        imgRingClassName="border-2 border-white dark:border-slate-900 ring-2 ring-emerald-500/45 shadow-md group-hover/avatar:scale-105 transition-transform"
                      />
                    </button>
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
                      <User className="w-7 h-7 text-white" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    {editingId === detailCase.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          autoFocus
                          className="px-2.5 py-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 bg-sky-50 dark:bg-slate-800 border border-sky-300 dark:border-sky-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/25 w-full"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTitle(detailCase.id)}
                          className="p-2 rounded-xl bg-emerald-600 text-white text-xs cursor-pointer hover:bg-emerald-700 shrink-0 active:scale-95 transition-all"
                          title="บันทึกชื่อ"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 shrink-0 active:scale-95 transition-all"
                          title="ยกเลิก"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 leading-snug break-words">
                          {getCustomerDisplayName(detailCase)}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleStartEditTitle(detailCase)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer shrink-0"
                          title="แก้ไขชื่อลูกค้า"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Unboxed Metadata Line */}
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                      <span>บันทึกเมื่อ {formatThaiDateTime(detailCase.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-sky-700 dark:text-sky-300">
                        {detailCase.snapshot.proposalCode}
                      </span>
                      {detailCase.isAceCustomer && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-extrabold text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3" />
                            ลูกค้า ACE
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Expandable ID Card Portrait Preview */}
                {showPhotoPreview && detailCase.customerPhotoUrl && (
                  <div className="p-3 rounded-xl bg-emerald-50/75 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={detailCase.customerPhotoUrl}
                        alt={getCustomerDisplayName(detailCase)}
                        className="w-20 h-20 rounded-2xl object-cover object-top border-2 border-emerald-400 dark:border-emerald-500 shadow-md shrink-0"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                          {getCustomerDisplayName(detailCase)}
                        </div>
                        <div className="text-[10.5px] text-emerald-800 dark:text-emerald-300 font-semibold">
                          รูปโปรไฟล์จากบัตรประชาชน (เก็บในเคสเท่านั้น)
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('warning');
                            const updated = updateCaseCustomerPhoto(detailCase.id, undefined);
                            setCases(updated);
                            setShowPhotoPreview(false);
                            showToast('ลบรูปโปรไฟล์ออกจากเคสนี้แล้ว');
                          }}
                          className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          ลบรูปโปรไฟล์นี้ออก
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPhotoPreview(false)}
                      className="p-1.5 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-pointer shrink-0"
                      aria-label="ซ่อนตัวอย่างรูปโปรไฟล์"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Status Switcher Section */}
                <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      สถานะการพิจารณาเคส
                    </span>
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 font-medium">
                      แตะเพื่อเปลี่ยนสถานะ
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleSetApprovalStatus(detailCase.id, 'pending')}
                      className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] active:scale-[0.97] ${
                        (!detailCase.approvalStatus || detailCase.approvalStatus === 'pending')
                          ? 'bg-white dark:bg-slate-800 text-sky-800 dark:text-sky-300 shadow-xs font-extrabold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                      <span>รอผล</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetApprovalStatus(detailCase.id, 'approved')}
                      className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] active:scale-[0.97] ${
                        detailCase.approvalStatus === 'approved'
                          ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>อนุมัติ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetApprovalStatus(detailCase.id, 'rejected')}
                      className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] active:scale-[0.97] ${
                        detailCase.approvalStatus === 'rejected'
                          ? 'bg-rose-600 text-white shadow-xs font-extrabold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>ไม่อนุมัติ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetApprovalStatus(detailCase.id, 'cancelled')}
                      className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] active:scale-[0.97] ${
                        detailCase.approvalStatus === 'cancelled'
                          ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-xs font-extrabold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5 shrink-0" />
                      <span>ยกเลิก</span>
                    </button>
                  </div>

                  {/* Approved Workflow: Delivery, Dates, Due Date, Engine/Chassis, Certificate */}
                  {detailCase.approvalStatus === 'approved' && (
                    <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 animate-fade-in">
                      {/* Delivery Status Switch */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          การรับมอบรถ
                        </span>
                        <div className="inline-flex rounded-xl p-0.5 bg-slate-100 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800 text-xs font-bold gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetDeliveryStatus(detailCase.id, 'pending_delivery')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] active:scale-[0.97] ${
                              (!detailCase.deliveryStatus || detailCase.deliveryStatus === 'pending_delivery')
                                ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                                : 'text-slate-600 dark:text-slate-400 hover:text-amber-800 dark:hover:text-amber-300'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>รอรับรถ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetDeliveryStatus(detailCase.id, 'delivered')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] active:scale-[0.97] ${
                              detailCase.deliveryStatus === 'delivered'
                                ? 'bg-teal-600 text-white shadow-xs font-extrabold'
                                : 'text-slate-600 dark:text-slate-400 hover:text-teal-800 dark:hover:text-teal-300'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>รับรถแล้ว</span>
                          </button>
                        </div>
                      </div>

                      {/* Date Pickers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>วันอนุมัติ</span>
                          </div>
                          <input
                            type="date"
                            value={detailCase.approvalDate || toInputDateStr(detailCase.createdAt)}
                            onChange={(e) => handleSetDates(detailCase.id, { approvalDate: e.target.value })}
                            className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-emerald-50 dark:bg-emerald-950/60 dark:[color-scheme:dark] px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/70 focus:outline-none cursor-pointer tabular-nums"
                          />
                        </div>

                        <div className="px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                            <PackageCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            <span>
                              {detailCase.deliveryStatus === 'delivered' ? 'วันรับรถ' : 'วันนัดรับ'}
                            </span>
                          </div>
                          <input
                            type="date"
                            value={detailCase.deliveryDate || (detailCase.deliveryStatus === 'delivered' ? toInputDateStr(detailCase.createdAt) : '')}
                            onChange={(e) => handleSetDates(detailCase.id, { deliveryDate: e.target.value })}
                            className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-teal-50 dark:bg-teal-950/60 dark:[color-scheme:dark] px-2 py-1 rounded-lg border border-teal-200 dark:border-teal-800/70 focus:outline-none cursor-pointer tabular-nums"
                          />
                        </div>
                      </div>

                      {/* Automatic First Payment Due */}
                      {detailCase.deliveryStatus === 'delivered' && (() => {
                        const firstDue = calculateFirstPaymentDueDate(detailCase.deliveryDate || detailCase.createdAt);
                        return (
                          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2 animate-fade-in">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                  <CalendarClock className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 block">
                                    กำหนดชำระงวดแรก
                                  </span>
                                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                    คำนวณอัตโนมัติ · ชำระทุกวันที่ 2 ของเดือน
                                  </span>
                                </div>
                              </div>
                              <span className="text-sm font-black text-indigo-900 dark:text-indigo-200 tracking-tight tabular-nums text-right">
                                {firstDue.formattedLong}
                              </span>
                            </div>

                            <div className="pt-1.5 border-t border-indigo-200/60 dark:border-indigo-800/50 flex items-center justify-between gap-2 text-[10.5px] text-slate-600 dark:text-slate-300 flex-wrap">
                              <span>
                                {firstDue.cycleRangeText} ➔ งวดแรก 2 {firstDue.monthName}
                              </span>
                              <span className="text-[10.5px] text-indigo-800 dark:text-indigo-300 font-bold">
                                งวดถัดไป: ทุกวันที่ 2
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Engine & Chassis Numbers */}
                      {detailCase.deliveryStatus === 'delivered' && (
                        <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/35 border border-teal-200/80 dark:border-teal-800/60 space-y-2.5 animate-fade-in">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                <Barcode className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-teal-950 dark:text-teal-100 block">
                                  เลขเครื่อง / เลขตัวถัง
                                </span>
                                <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                  กรอกหรือสแกนบาร์โค้ดสติ๊กเกอร์รถ
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(detailCase.engineNumber || detailCase.chassisNumber) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const lines = [
                                      detailCase.engineNumber ? `เลขเครื่อง: ${detailCase.engineNumber}` : '',
                                      detailCase.chassisNumber ? `เลขตัวถัง: ${detailCase.chassisNumber}` : '',
                                    ]
                                      .filter(Boolean)
                                      .join('\n');
                                    navigator.clipboard?.writeText(lines);
                                    triggerHaptic('success');
                                    showToast('✓ คัดลอกเลขเครื่อง/เลขถังแล้ว');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <ClipboardCopy className="w-3 h-3" />
                                  <span>คัดลอกคู่</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setBarcodeScannerState({ caseId: detailCase.id, target: 'both' });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-[10.5px] font-extrabold shadow-xs inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                              >
                                <ScanLine className="w-3.5 h-3.5" />
                                <span>สแกนสติ๊กเกอร์</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-white/95 dark:bg-slate-900/90 border border-teal-200/70 dark:border-teal-800/50 space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10.5px] font-extrabold text-teal-900 dark:text-teal-200">
                                  เลขเครื่อง (Engine No.)
                                </span>
                                <div className="flex items-center gap-1">
                                  {detailCase.engineNumber && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(detailCase.engineNumber || '');
                                        triggerHaptic('success');
                                        showToast('✓ คัดลอกเลขเครื่องแล้ว');
                                      }}
                                      className="p-1 rounded-md text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 cursor-pointer transition-colors"
                                      title="คัดลอกเลขเครื่อง"
                                    >
                                      <ClipboardCopy className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      setBarcodeScannerState({ caseId: detailCase.id, target: 'engine' });
                                    }}
                                    className="px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/70 dark:hover:bg-teal-900/70 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800/70 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    title="สแกนบาร์โค้ดเลขเครื่อง"
                                  >
                                    <ScanLine className="w-3 h-3" />
                                    <span>สแกน</span>
                                  </button>
                                </div>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={detailCase.engineNumber || ''}
                                  onChange={(e) =>
                                    handleSaveVehicleNumbers(detailCase.id, {
                                      engineNumber: normalizeVehicleSerial(e.target.value),
                                    })
                                  }
                                  placeholder="เช่น JC75E-1234567"
                                  autoCapitalize="characters"
                                  spellCheck={false}
                                  className="w-full pl-2.5 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none font-mono font-extrabold text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 uppercase tracking-wide tabular-nums"
                                />
                                {detailCase.engineNumber && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSaveVehicleNumbers(
                                        detailCase.id,
                                        { engineNumber: '' },
                                        'ล้างเลขเครื่องแล้ว'
                                      )
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 text-xs cursor-pointer p-0.5"
                                    title="ล้างเลขเครื่อง"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="p-2 rounded-lg bg-white/95 dark:bg-slate-900/90 border border-cyan-200/70 dark:border-cyan-800/50 space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10.5px] font-extrabold text-cyan-900 dark:text-cyan-200">
                                  เลขตัวถัง (Chassis / VIN)
                                </span>
                                <div className="flex items-center gap-1">
                                  {detailCase.chassisNumber && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard?.writeText(detailCase.chassisNumber || '');
                                        triggerHaptic('success');
                                        showToast('✓ คัดลอกเลขตัวถังแล้ว');
                                      }}
                                      className="p-1 rounded-md text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 cursor-pointer transition-colors"
                                      title="คัดลอกเลขตัวถัง"
                                    >
                                      <ClipboardCopy className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic('light');
                                      setBarcodeScannerState({ caseId: detailCase.id, target: 'chassis' });
                                    }}
                                    className="px-2 py-0.5 rounded-md bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/70 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800/70 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                    title="สแกนบาร์โค้ดเลขตัวถัง"
                                  >
                                    <ScanLine className="w-3 h-3" />
                                    <span>สแกน</span>
                                  </button>
                                </div>
                              </div>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={detailCase.chassisNumber || ''}
                                  onChange={(e) =>
                                    handleSaveVehicleNumbers(detailCase.id, {
                                      chassisNumber: normalizeVehicleSerial(e.target.value),
                                    })
                                  }
                                  placeholder="เช่น MLHJC7500R5001234"
                                  autoCapitalize="characters"
                                  spellCheck={false}
                                  className="w-full pl-2.5 pr-7 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none font-mono font-extrabold text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 uppercase tracking-wide tabular-nums"
                                />
                                {detailCase.chassisNumber && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSaveVehicleNumbers(
                                        detailCase.id,
                                        { chassisNumber: '' },
                                        'ล้างเลขตัวถังแล้ว'
                                      )
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 text-xs cursor-pointer p-0.5"
                                    title="ล้างเลขตัวถัง"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cross-Month Accounting Notice Banner */}
                      {detailCase.deliveryStatus === 'delivered' && (() => {
                        const approvalYM = getCaseApprovalYM(detailCase);
                        const deliveryYM = getCaseDeliveryYM(detailCase);
                        if (approvalYM && deliveryYM && approvalYM !== deliveryYM) {
                          const isCarried = approvalYM < deliveryYM;
                          return (
                            <div className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/70 text-teal-950 dark:text-teal-100 text-xs flex items-start gap-2.5">
                              <BadgePercent className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-teal-900 dark:text-teal-200 flex flex-wrap items-center gap-x-1.5">
                                  <span>{isCarried ? 'เคสยกยอดมารับรถข้ามเดือน' : 'การนับยอดข้ามเดือน'}</span>
                                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
                                    · อนุมัติ {formatYearMonthLabel(approvalYM)} ➔ รับรถ {formatYearMonthLabel(deliveryYM)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-teal-800 dark:text-teal-200/90 leading-relaxed font-medium">
                                  ลูกค้ารับรถในเดือน <strong>{formatYearMonthLabel(deliveryYM)}</strong> ระบบจึงนับเป็น<strong>ยอดรับรถของเดือน {formatYearMonthLabel(deliveryYM)}</strong> แต่<strong>ผลอนุมัติยังเป็นยอดของเดือน {formatYearMonthLabel(approvalYM)}</strong> ตามเกณฑ์บันทึกข้อมูล
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Notice Banner: เคสที่อนุมัติเดือนก่อนและยังรอรับรถ */}
                      {detailCase.approvalStatus === 'approved' && detailCase.deliveryStatus !== 'delivered' && (() => {
                        const approvalYM = getCaseApprovalYM(detailCase);
                        const currentYM = getCurrentYearMonthKey();
                        const targetYM = selectedMonthKey !== 'all' ? selectedMonthKey : currentYM;
                        if (approvalYM && approvalYM < targetYM) {
                          return (
                            <div className="p-3 rounded-xl bg-amber-50/85 dark:bg-amber-950/45 border border-amber-300/80 dark:border-amber-800/70 text-amber-950 dark:text-amber-100 text-xs flex items-start gap-2.5">
                              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-x-1.5">
                                  <span>เคสยกยอดรอรับรถจากเดือนก่อน</span>
                                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                    · อนุมัติ {formatYearMonthLabel(approvalYM)} ({formatThaiDateOnly(detailCase.approvalDate)})
                                  </span>
                                </div>
                                <p className="text-[11px] text-amber-800 dark:text-amber-200/90 leading-relaxed font-medium">
                                  เคสนี้ผ่านการอนุมัติตั้งแต่เดือน <strong>{formatYearMonthLabel(approvalYM)}</strong> แต่ยังไม่ได้รับรถ ระบบจึงยกยอดมารอรับรถในงวดปัจจุบัน เมื่อลูกค้ามารับรถแล้วสามารถกดเลือก <strong>&ldquo;รับรถแล้ว&rdquo;</strong> และระบุวันรับรถได้ทันที
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('medium');
                          setApprovalModalCase(detailCase);
                        }}
                        className="w-full py-2.5 px-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm shadow-emerald-600/25 active:scale-[0.98] transition-all cursor-pointer border border-emerald-400/30"
                      >
                        <FileCheck className="w-4 h-4 text-emerald-100 shrink-0" />
                        <span className="whitespace-nowrap">ดู / พิมพ์ / โหลดภาพ ใบอนุมัติผลชั่วคราว</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. FINANCIAL & INSTALLMENT SHOWCASE CARD */}
              <section
                className="case-detail-surface rounded-2xl overflow-hidden animate-case-detail-rise"
                style={{ animationDelay: '75ms' }}
              >
                {/* Gradient Hero Financial Strip with Specular Sheen */}
                <div className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-700 dark:from-sky-900 dark:via-slate-900 dark:to-indigo-950 p-4 sm:p-5 text-white">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-case-hero-sheen"
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-sky-100/90 flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        ค่างวดต่อเดือน
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
                        <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                          {formatBaht(detailCase.snapshot.monthlyInstallment)}
                        </span>
                        <span className="text-xs font-semibold text-sky-100/80">/ งวด</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <span className="text-[11px] font-bold text-sky-100/80 block">
                        ระยะเวลาผ่อน
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-white leading-tight block mt-0.5">
                        {detailCase.term} <span className="text-xs font-semibold text-sky-100/80">งวด</span>
                      </span>
                    </div>
                  </div>

                  <div className="relative mt-3 pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-sky-100/90">
                    <span className="font-bold truncate">
                      {detailCase.snapshot.proposalCode}
                      {detailCase.snapshot.proposalName ? ` · ${detailCase.snapshot.proposalName}` : ''}
                    </span>
                    <span className="font-extrabold text-white tabular-nums shrink-0">
                      {detailCase.snapshot.rateDisplayText}
                    </span>
                  </div>
                </div>

                {/* 3-Column Unified Key Metrics Strip */}
                <div className="grid grid-cols-3 divide-x divide-slate-200/80 dark:divide-slate-800 border-b border-slate-200/80 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 text-center tabular-nums">
                  <div className="p-2.5 sm:p-3">
                    <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block">
                      ราคารถเงินสด
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {formatBaht(detailCase.vehiclePrice)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3">
                    <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block">
                      เงินดาวน์ ({detailCase.snapshot.downPercent.toFixed(1)}%)
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {formatBaht(detailCase.snapshot.downAmount)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3">
                    <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 block">
                      ยอดจัดไฟแนนซ์
                    </span>
                    <span className="text-xs sm:text-sm font-black text-sky-700 dark:text-sky-300 mt-0.5 block">
                      {formatBaht(detailCase.snapshot.financeAmount, true)}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                      ถอด VAT {formatBaht(detailCase.snapshot.financeAmount / 1.07)}
                    </span>
                  </div>
                </div>

                {/* Complete Hairline Breakdown Rows */}
                <div className="px-4 py-1 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs tabular-nums">
                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      รวมเงินค่างวดทั้งสิ้น
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      {formatBaht(detailCase.snapshot.totalWithVat)}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      ดอกเบี้ยรวมทั้งสัญญา
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      {formatBaht(detailCase.snapshot.totalInterest)}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                      อัตราดอกเบี้ยแท้จริง (EIR) & โหมดดอกเบี้ย
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-right">
                      {detailCase.snapshot.eirAnnualPercent.toFixed(2)}% /ปี ·{' '}
                      {detailCase.isCustomRateEnabled
                        ? `กำหนดเอง (${detailCase.customRateInput || '—'}% ${detailCase.customRateType === 'annual' ? 'ต่อปี' : 'ต่อเดือน'})`
                        : 'ตามตารางแคมเปญ'}
                      {detailCase.enforceEirCap ? ' · คุมเพดาน 23%' : ''}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                      ค่าทะเบียน / ประกันรถหาย
                    </span>
                    <div className="text-right">
                      {hasDeliveryFees ? (
                        <>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                            ทะเบียน {formatBaht(detailCase.registrationFee || 0)} · รถหาย {formatBaht(detailCase.theftInsuranceFee || 0)}
                          </span>
                          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                            {detailCase.includeDeliveryFees ? 'รวมในวันออกรถแล้ว' : 'ไม่ได้รวมในยอดจัด'} · รวมออกรถ {formatBaht(driveAwayTotal)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-slate-500 dark:text-slate-400">
                          ไม่รวมค่าใช้จ่ายเพิ่มเติม
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      ประกันภัยกลุ่ม PA
                    </span>
                    <span className={`font-extrabold ${detailCase.insurancePlan && detailCase.insurancePlan !== 'none' ? 'text-teal-800 dark:text-teal-300' : 'text-slate-500 dark:text-slate-400 font-semibold'}`}>
                      {detailCase.insurancePlan && detailCase.insurancePlan !== 'none'
                        ? `${detailCase.insurancePlan.toUpperCase()} (${detailCase.insuranceYears} ปี)`
                        : 'ไม่ทำประกัน PA'}
                    </span>
                  </div>

                  {/* 9-Installment Payment Summary (if recorded) */}
                  {installmentEntries.length > 0 && (
                    <div className="py-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                          ประวัติการติดตามค่างวด (1–9)
                        </span>
                        <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                          ชำระแล้ว {paidInstallmentCount}/{installmentEntries.length} งวด
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {installmentEntries.map((item) => {
                          const isPaid = item.status === 'paid';
                          return (
                            <div
                              key={item.num}
                              className={`px-2 py-1.5 rounded-lg border text-[10.5px] font-bold flex items-center justify-between gap-1 ${
                                isPaid
                                  ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              <span>งวด {item.num}</span>
                              <span>{isPaid ? '✓' : 'ค้าง'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 3. CUSTOMER PROFILE & THAI ID KYC CARD */}
              <section
                className="case-detail-surface rounded-2xl p-4 sm:p-5 space-y-3 animate-case-detail-rise"
                style={{ animationDelay: '130ms' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    ข้อมูลลูกค้าและเอกสารยืนยันตัวตน
                  </h4>
                </div>

                {/* Hairline 2-Col Profile Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y sm:divide-y-0 sm:gap-px bg-slate-200/60 dark:bg-slate-800/70 overflow-hidden text-xs">
                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                      ชื่อ-นามสกุล
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 block">
                      {detailCase.customerName || 'ไม่ระบุชื่อ'}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                        เบอร์โทรศัพท์
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5 block">
                        {detailCase.customerPhone || 'ไม่ระบุเบอร์'}
                      </span>
                    </div>
                    {detailCase.customerPhone && (
                      <a
                        href={`tel:${detailCase.customerPhone}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800/70 inline-flex items-center gap-1 transition-colors shrink-0 active:scale-95"
                      >
                        <Phone className="w-3 h-3" />
                        <span>โทรออก</span>
                      </a>
                    )}
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-slate-400" />
                      อาชีพ
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
                      {detailCase.customerOccupation?.trim() || '—'}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90 tabular-nums">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                      รายได้ต่อเดือน
                    </span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 block">
                      {formatMonthlyIncomeThai(detailCase.customerIncome)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90 tabular-nums">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                      อายุงาน
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
                      {formatMonthsToThaiDuration(detailCase.customerWorkMonths)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90 tabular-nums">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <Home className="w-3 h-3 text-slate-400" />
                      ระยะเวลาพักอาศัย
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
                      {formatMonthsToThaiDuration(detailCase.customerResidenceMonths)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                      ประเภทลูกค้า ACE
                    </span>
                    <span className={`font-extrabold mt-0.5 block ${detailCase.isAceCustomer ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {detailCase.isAceCustomer ? 'ลูกค้า ACE' : 'ลูกค้าทั่วไป'}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-900/90 tabular-nums">
                    <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                      อายุ / วันเดือนปีเกิด
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 block">
                      {detailCase.customerAge || detailCase.customerBirthDate ? (
                        <>
                          {detailCase.customerAge ? `อายุ ${detailCase.customerAge} ปี` : ''}
                          {detailCase.customerAge && detailCase.customerBirthDate ? ' · ' : ''}
                          {detailCase.customerBirthDate
                            ? `เกิด ${formatThaiDateFromIso(detailCase.customerBirthDate)}`
                            : ''}
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>

                {/* Thai ID Card KYC Sub-panel */}
                {(detailCase.customerIdCard ||
                  detailCase.customerAddress ||
                  detailCase.customerBirthDate ||
                  detailCase.customerAge) && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>ข้อมูลบัตรประชาชน</span>
                      </span>
                      <span className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                        เก็บในเคสเท่านั้น
                      </span>
                    </div>

                    {detailCase.customerIdCard && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-emerald-800/50">
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                            เลขประจำตัวประชาชน 13 หลัก
                          </span>
                          <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm tracking-wider tabular-nums">
                            {showFullIdCard
                              ? formatThaiIdDisplay(detailCase.customerIdCard)
                              : maskThaiIdDisplay(detailCase.customerIdCard)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setShowFullIdCard((v) => !v);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                            title={showFullIdCard ? 'ซ่อนบางหลัก' : 'แสดงเลขครบ 13 หลัก'}
                          >
                            {showFullIdCard ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(detailCase.customerIdCard || '');
                              triggerHaptic('success');
                              showToast('คัดลอกเลขบัตรประชาชนแล้ว');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/70 dark:hover:bg-emerald-800/70 text-emerald-800 dark:text-emerald-200 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <ClipboardCopy className="w-3 h-3" />
                            <span>คัดลอก</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {detailCase.customerAddress && (
                      <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-emerald-800/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            ที่อยู่ตามบัตรประชาชน
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(detailCase.customerAddress || '');
                              triggerHaptic('success');
                              showToast('คัดลอกที่อยู่ตามบัตรแล้ว');
                            }}
                            className="text-[10.5px] font-bold text-sky-700 dark:text-sky-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ClipboardCopy className="w-3 h-3" />
                            <span>คัดลอกที่อยู่</span>
                          </button>
                        </div>
                        <p className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                          {detailCase.customerAddress}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 4. MOTORCYCLE, DEALER & OFFICER CARD */}
              <section
                className="case-detail-surface rounded-2xl p-4 sm:p-5 space-y-3 animate-case-detail-rise"
                style={{ animationDelay: '185ms' }}
              >
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Bike className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  ข้อมูลรถ ร้านตัวแทน และเจ้าหน้าที่
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  <div className="pb-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                        ยี่ห้อ / รุ่นรถมอเตอร์ไซค์
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm mt-0.5 block">
                        {detailCase.bikeBrand ? `${detailCase.bikeBrand} · ` : ''}
                        {detailCase.bikeModelName || 'ไม่ระบุรุ่น'}
                      </span>
                      {detailCase.bikeModelCode && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                          รหัสรุ่น: {detailCase.bikeModelCode}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block">
                        ราคารถเงินสด
                      </span>
                      <span className="font-black text-slate-900 dark:text-slate-100 text-sm mt-0.5 block">
                        {formatBaht(detailCase.vehiclePrice)}
                      </span>
                    </div>
                  </div>

                  <div className="py-2.5 flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      ร้านตัวแทนจำหน่าย (Dealer)
                    </span>
                    <span className="font-extrabold text-sky-900 dark:text-sky-300 text-right">
                      {detailCase.dealerName || '—'}
                    </span>
                  </div>

                  <div className="pt-2.5 flex items-start justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 shrink-0">
                      <BadgeCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                      เจ้าหน้าที่ผู้ดูแล
                    </span>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                        {detailCase.officerName || '—'}
                      </span>
                      {(detailCase.officerCode || detailCase.officerLicense) && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums block">
                          {detailCase.officerCode ? `รหัส ${detailCase.officerCode}` : ''}
                          {detailCase.officerCode && detailCase.officerLicense ? ' · ' : ''}
                          {detailCase.officerLicense ? `ใบอนุญาต ${detailCase.officerLicense}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* 5. GOOGLE MAPS LOCATION & NAVIGATION CARD */}
              <section
                className="case-detail-surface rounded-2xl p-4 sm:p-5 space-y-2.5 animate-case-detail-rise"
                style={{ animationDelay: '240ms' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                    <MapPin className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
                    <span>ตำแหน่งที่อยู่ปัจจุบัน (Google Maps)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePasteLocation(detailCase.id)}
                    className="text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800/70 flex items-center gap-1 cursor-pointer transition-colors shrink-0 active:scale-95"
                  >
                    <ClipboardCopy className="w-3 h-3" />
                    <span>วางที่อยู่/ลิงก์</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={detailCase.googleMapsLocation || ''}
                    onChange={(e) => handleSaveLocation(detailCase.id, e.target.value)}
                    placeholder="วางลิงก์ Google Maps, พิกัด GPS หรือที่อยู่ลูกค้า..."
                    className="w-full pl-3 pr-8 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-400 font-medium"
                  />
                  {detailCase.googleMapsLocation && (
                    <button
                      type="button"
                      onClick={() => handleSaveLocation(detailCase.id, '')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                      title="ล้างที่อยู่"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenGoogleMaps(detailCase.googleMapsLocation)}
                  disabled={!detailCase.googleMapsLocation?.trim()}
                  className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                    detailCase.googleMapsLocation?.trim()
                      ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white active:scale-[0.98]'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <Navigation className="w-4 h-4 shrink-0" />
                  <span>
                    {detailCase.googleMapsLocation?.trim()
                      ? 'เปิด Google Maps เพื่อนำทางไปยังที่อยู่นี้'
                      : 'กรุณากรอกหรือวางที่อยู่ Google Maps เพื่อเปิดนำทาง'}
                  </span>
                  {detailCase.googleMapsLocation?.trim() && (
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  )}
                </button>
              </section>

              {/* 6. NOTES & APPROVAL PDF DOCUMENT CARD */}
              {(detailCase.customerNote || detailCase.approvalStatus === 'approved') && (
                <section
                  className="case-detail-surface rounded-2xl p-4 sm:p-5 space-y-3.5 animate-case-detail-rise"
                  style={{ animationDelay: '295ms' }}
                >
                  {detailCase.customerNote && (
                    <div className="p-3 rounded-xl bg-amber-50/75 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs space-y-1">
                      <span className="font-extrabold text-amber-900 dark:text-amber-200 block">
                        บันทึกเพิ่มเติม
                      </span>
                      <p className="text-amber-800 dark:text-amber-200/90 leading-relaxed whitespace-pre-wrap">
                        {detailCase.customerNote}
                      </p>
                    </div>
                  )}

                  {detailCase.approvalStatus === 'approved' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-rose-950 dark:text-rose-200">
                          <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>เอกสารการอนุมัติ (PDF)</span>
                        </div>
                        <span
                          className={`text-[11px] font-bold ${
                            detailCase.approvalDoc
                              ? 'text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {detailCase.approvalDoc ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>แนบเอกสารแล้ว</span>
                            </>
                          ) : (
                            <span>ยังไม่ได้แนบเอกสาร</span>
                          )}
                        </span>
                      </div>

                      <input
                        ref={pdfFileInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handlePdfUpload(detailCase.id, file);
                          }
                        }}
                        className="hidden"
                      />

                      {detailCase.approvalDoc ? (
                        <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/90 border border-rose-200/70 dark:border-rose-800/50 space-y-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1" title={detailCase.approvalDoc.name}>
                              <MarqueeText className="text-xs font-black text-slate-900 dark:text-slate-100">
                                {detailCase.approvalDoc.name}
                              </MarqueeText>
                              <MarqueeText className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                {formatFileSize(detailCase.approvalDoc.size)} · อัปโหลดเมื่อ {formatThaiDateTime(detailCase.approvalDoc.uploadedAt)}
                              </MarqueeText>
                            </div>
                          </div>

                          {inlinePdfDataUrl ? (
                            <div className="space-y-1 pt-1">
                              <PdfCanvasViewer
                                dataUrl={inlinePdfDataUrl}
                                fileName={detailCase.approvalDoc.name}
                                mode="inline"
                                onOpenExternal={() => handleOpenExternalPdf(detailCase)}
                              />
                            </div>
                          ) : isLoadingInlinePdf ? (
                            <div className="py-8 bg-slate-900 rounded-xl text-center text-xs text-white flex flex-col items-center justify-center gap-2">
                              <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-[11px] text-slate-300">กำลังแสดงตัวอย่างเอกสาร...</span>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenExternalPdf(detailCase)}
                              disabled={isLoadingPdf}
                              className="w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm shadow-rose-500/20 bg-gradient-to-r from-rose-600 via-red-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white active:scale-[0.98] transition-all cursor-pointer"
                              title="เปิดดูเอกสารด้วยแอพภายนอกของเครื่อง"
                            >
                              <ExternalLink className="w-4 h-4 shrink-0" />
                              <span>เปิดดูเอกสารจากแอพภายนอก</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (!detailCase) return;
                                const data = await getApprovalDocData(detailCase.id);
                                if (data?.dataUrl) {
                                  downloadPdfFile(
                                    data.dataUrl,
                                    data.name || detailCase.approvalDoc?.name || 'เอกสารการอนุมัติ.pdf'
                                  );
                                  triggerHaptic('success');
                                  showToast('✓ ดาวน์โหลดไฟล์ PDF เรียบร้อย');
                                }
                              }}
                              className="w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 active:scale-[0.98] transition-all cursor-pointer"
                              title="ดาวน์โหลดไฟล์ PDF เก็บไว้ในอุปกรณ์"
                            >
                              <Download className="w-4 h-4 shrink-0 text-slate-600 dark:text-slate-300" />
                              <span>ดาวน์โหลด PDF</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => pdfFileInputRef.current?.click()}
                              disabled={isUploadingPdf}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                              title="เลือกไฟล์ PDF ใหม่เพื่อแทนที่ไฟล์เดิม"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>เปลี่ยนไฟล์</span>
                            </button>

                            {deleteDocConfirmId === detailCase.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 px-2 py-0.5 rounded-lg">
                                <span className="text-[10px] text-rose-800 dark:text-rose-200 font-bold">ยืนยันลบไฟล์?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePdfDoc(detailCase.id)}
                                  className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  ลบ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteDocConfirmId(null)}
                                  className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-[10px] cursor-pointer"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteDocConfirmId(detailCase.id)}
                                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="ลบเอกสารออกจากเคสนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>ลบเอกสาร</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => pdfFileInputRef.current?.click()}
                          className="p-4 rounded-xl border-2 border-dashed border-rose-300 dark:border-rose-800/70 hover:border-rose-400 dark:hover:border-rose-600 bg-rose-50/30 dark:bg-slate-900/70 hover:bg-rose-50/70 dark:hover:bg-rose-950/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group text-center"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors shadow-2xs">
                            <UploadCloud className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-700 dark:group-hover:text-rose-300 block">
                              {isUploadingPdf ? 'กำลังอัปโหลดไฟล์...' : 'คลิกเพื่ออัปโหลดไฟล์ PDF เอกสารการอนุมัติ'}
                            </span>
                            <span className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                              รองรับไฟล์ .PDF (เช่น เอกสารอนุมัติสินเชื่อ, ใบแจ้งผลการพิจารณา)
                            </span>
                          </div>
                          <div className="mt-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 group-hover:bg-rose-600 text-rose-700 dark:text-rose-300 group-hover:text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 pointer-events-none">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>เลือกไฟล์ PDF จากอุปกรณ์</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Sticky Frosted Action Footer */}
            <div className="p-3 sm:px-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              {deleteConfirmId === detailCase.id ? (
                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800/70 px-2 py-1 rounded-xl shadow-2xs">
                  <span className="text-[10px] text-rose-800 dark:text-rose-200 font-bold">ลบเคสนี้?</span>
                  <button
                    type="button"
                    onClick={() => executeDelete(detailCase.id)}
                    className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
                  >
                    ลบเลย
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(detailCase.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                  title="ลบเคสนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2">
                {detailCase.approvalStatus === 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setApprovalModalCase(detailCase);
                    }}
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
                    title="เปิดดูใบอนุมัติผลชั่วคราว (Provisional Approval Certificate)"
                  >
                    <FileCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">ใบอนุมัติผล</span>
                  </button>
                )}

                {onEditCase && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onEditCase(detailCase);
                      setDetailCase(null);
                      onClose();
                    }}
                    className="px-2.5 sm:px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm shadow-amber-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
                    title="ดึงเคสนี้กลับมาแก้ไขในโปรแกรมคำนวณ"
                  >
                    <Pencil className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">แก้ไขเคส</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    onLoadCase(detailCase);
                    setDetailCase(null);
                    onClose();
                  }}
                  className="px-2.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 text-white font-black text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-sm shadow-sky-500/25 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
                  title="นำตัวเลขในเคสนี้มาใช้งานเป็นเคสใหม่"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">นำมาใช้งาน</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

        {/* Provisional Approval Certificate Modal */}
        {approvalModalCase && (
          <ProvisionalApprovalModal
            isOpen={Boolean(approvalModalCase)}
            onClose={() => setApprovalModalCase(null)}
            data={{
              customerName: approvalModalCase.customerName || 'คุณลูกค้า',
              customerPhone: approvalModalCase.customerPhone || '',
              bikeModelName: approvalModalCase.bikeModelName || 'รถจักรยานยนต์',
              bikeModelCode: approvalModalCase.bikeModelCode || '',
              vehiclePrice: approvalModalCase.vehiclePrice || 0,
              downAmount: approvalModalCase.snapshot?.downAmount ?? 0,
              downPercent: approvalModalCase.snapshot?.downPercent ?? 0,
              financeAmount: approvalModalCase.snapshot?.financeAmount ?? 0,
              term: approvalModalCase.term,
              monthlyInstallment: approvalModalCase.snapshot?.monthlyInstallment ?? 0,
              interestRateText: approvalModalCase.snapshot?.rateDisplayText || '',
              proposalCode: approvalModalCase.snapshot?.proposalCode || '',
              proposalName: approvalModalCase.snapshot?.proposalName || '',
              insurancePlanName: approvalModalCase.insurancePlan || 'none',
              insuranceYears: approvalModalCase.insuranceYears || 0,
              approvalDate: approvalModalCase.approvalDate,
              deliveryDate: approvalModalCase.deliveryDate,
              deliveryStatus: approvalModalCase.deliveryStatus,
              dealerName: approvalModalCase.dealerName,
              officerInfo: approvalModalCase.officerName && approvalModalCase.officerCode
                ? `${approvalModalCase.officerName} (${approvalModalCase.officerCode})`
                : approvalModalCase.officerName || undefined,
            }}
            onUpdateCustomer={(name, phone) => {
              if (approvalModalCase) {
                updateCaseTitle(approvalModalCase.id, name);
                setCases((prev) =>
                  prev.map((c) =>
                    c.id === approvalModalCase.id
                      ? { ...c, customerName: name, customerPhone: phone }
                      : c
                  )
                );
                if (detailCase?.id === approvalModalCase.id) {
                  setDetailCase((prev) =>
                    prev ? { ...prev, customerName: name, customerPhone: phone } : null
                  );
                }
              }
            }}
            onUpdateDealer={(dealer) => {
              if (approvalModalCase) {
                const updatedList = updateCaseDealerName(approvalModalCase.id, dealer);
                setCases(updatedList);
                if (detailCase?.id === approvalModalCase.id) {
                  setDetailCase((prev) =>
                    prev ? { ...prev, dealerName: dealer.trim() || undefined } : null
                  );
                }
              }
            }}
          />
        )}

        {/* Vehicle Engine & Chassis Barcode Scanner Modal */}
        {barcodeScannerState && (() => {
          const targetCase = cases.find((c) => c.id === barcodeScannerState.caseId);
          return (
            <VehicleBarcodeScannerModal
              isOpen={Boolean(barcodeScannerState)}
              onClose={() => setBarcodeScannerState(null)}
              initialTarget={barcodeScannerState.target}
              initialEngineNumber={targetCase?.engineNumber}
              initialChassisNumber={targetCase?.chassisNumber}
              customerName={targetCase ? getCustomerDisplayName(targetCase) : undefined}
              onApply={(data) => {
                handleSaveVehicleNumbers(
                  barcodeScannerState.caseId,
                  data,
                  '✓ บันทึกเลขเครื่อง/เลขตัวถังเรียบร้อยแล้ว'
                );
                setBarcodeScannerState(null);
              }}
            />
          );
        })()}
      </div>
    </div>,
    document.body
  );
};
