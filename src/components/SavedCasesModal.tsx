import React, { useState, useMemo, useEffect } from 'react';
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
  Phone,
  ShieldCheck,
  Percent,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { SavedCaseRecord, CaseApprovalStatus, VehicleDeliveryStatus } from '../types';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import {
  getSavedCases,
  deleteCaseRecord,
  updateCaseTitle,
  updateCaseApprovalStatus,
  updateCaseDeliveryStatus,
  updateCaseDates,
  updateCasePaymentDueDay,
  updateCaseGoogleMapsLocation,
  getGoogleMapsNavigationUrl,
  calculateFirstPaymentDueDate,
  clearAllCaseRecords,
  exportCasesAsJson,
  importCasesFromJson,
} from '../utils/savedCasesStorage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadCase: (record: SavedCaseRecord) => void;
  onEditCase?: (record: SavedCaseRecord) => void;
  onSaveCurrentCase?: () => void;
  onDeleteCase?: (deletedId?: string) => void;
  activeEditingId?: string | null;
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

export const SavedCasesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLoadCase,
  onEditCase,
  onSaveCurrentCase,
  onDeleteCase,
  activeEditingId,
}) => {
  const [cases, setCases] = useState<SavedCaseRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CaseApprovalStatus>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | VehicleDeliveryStatus>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all'); // 'all' or '2569'
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 'all' or '1'..'12'
  const [selectedDueMonth, setSelectedDueMonth] = useState<string>('all'); // 'all' or '2569-11'
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list'); // 'list' = รายการชื่อลูกค้า (แนะนำ), 'cards' = การ์ดเต็ม
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

  // Load cases when modal opens
  useEffect(() => {
    if (isOpen) {
      setCases(getSavedCases());
      setSearchQuery('');
      setStatusFilter('all');
      setDeliveryFilter('all');
      setSelectedYear('all');
      setSelectedMonth('all');
      setSelectedDueMonth('all');
      setEditingId(null);
      setDetailCase(null);
      setDeleteConfirmId(null);
      setShowClearAllConfirm(false);
      setShowTransferGuide(false);
    }
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Extract available Thai years (พ.ศ.) from cases
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentThaiYear = new Date().getFullYear() + 543;
    years.add(currentThaiYear);

    cases.forEach((c) => {
      const d = new Date(c.createdAt);
      if (!isNaN(d.getTime())) years.add(d.getFullYear() + 543);
      if (c.approvalDate) {
        const ad = new Date(c.approvalDate);
        if (!isNaN(ad.getTime())) years.add(ad.getFullYear() + 543);
      }
      if (c.deliveryDate) {
        const dd = new Date(c.deliveryDate);
        if (!isNaN(dd.getTime())) years.add(dd.getFullYear() + 543);
      }
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [cases]);

  // Count cases per month for the chosen year
  const monthStats = useMemo(() => {
    const counts: Record<number, number> = {};
    cases.forEach((c) => {
      const d = new Date(c.createdAt);
      const yr = d.getFullYear() + 543;
      if (selectedYear === 'all' || yr.toString() === selectedYear) {
        const mo = d.getMonth() + 1;
        counts[mo] = (counts[mo] || 0) + 1;
      }
    });
    return counts;
  }, [cases, selectedYear]);

  // Status statistics and counters
  const statusCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let cancelled = 0;
    let pendingDelivery = 0;
    let delivered = 0;

    cases.forEach((c) => {
      const st = c.approvalStatus || 'pending';
      if (st === 'approved') {
        approved++;
        if (c.deliveryStatus === 'delivered') {
          delivered++;
        } else {
          pendingDelivery++;
        }
      } else if (st === 'rejected') {
        rejected++;
      } else if (st === 'cancelled') {
        cancelled++;
      } else {
        pending++;
      }
    });

    return {
      all: cases.length,
      pending,
      approved,
      rejected,
      cancelled,
      pendingDelivery,
      delivered,
    };
  }, [cases]);

  // สถิติและตัวนับกำหนดชำระงวดแรก
  const dueMonthStats = useMemo(() => {
    const counts: Record<string, { key: string; label: string; shortLabel: string; thaiYear: number; month: number; count: number }> = {};
    let totalDelivered = 0;

    cases.forEach((c) => {
      const d = new Date(c.createdAt);
      const caseYear = (d.getFullYear() + 543).toString();
      const caseMonth = (d.getMonth() + 1).toString();
      if (selectedYear !== 'all' && caseYear !== selectedYear) return;
      if (selectedMonth !== 'all' && caseMonth !== selectedMonth) return;

      if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
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
      }
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
  }, [cases, selectedYear, selectedMonth]);

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Year & Month filter
      const d = new Date(c.createdAt);
      const caseYear = (d.getFullYear() + 543).toString();
      const caseMonth = (d.getMonth() + 1).toString();

      if (selectedYear !== 'all' && caseYear !== selectedYear) {
        return false;
      }
      if (selectedMonth !== 'all' && caseMonth !== selectedMonth) {
        return false;
      }

      // Delivery filter
      if (deliveryFilter !== 'all') {
        const isApproved = c.approvalStatus === 'approved';
        const caseDelivery = c.deliveryStatus || 'pending_delivery';
        if (!isApproved || caseDelivery !== deliveryFilter) {
          return false;
        }
      }

      // First Installment Due Month filter
      if (selectedDueMonth !== 'all') {
        if (c.approvalStatus !== 'approved' || c.deliveryStatus !== 'delivered') {
          return false;
        }
        const dueInfo = calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt);
        if (dueInfo.key !== selectedDueMonth) {
          return false;
        }
      }

      // Status filter
      const caseStatus = c.approvalStatus || 'pending';
      if (statusFilter !== 'all' && caseStatus !== statusFilter) {
        return false;
      }

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = c.caseTitle.toLowerCase().includes(q);
        const custMatch = c.customerName.toLowerCase().includes(q);
        const phoneMatch = c.customerPhone?.toLowerCase().includes(q);
        const bikeMatch = c.bikeModelName?.toLowerCase().includes(q);
        const codeMatch = c.bikeModelCode?.toLowerCase().includes(q);
        const proposalMatch = c.snapshot.proposalCode.toLowerCase().includes(q);
        const locationMatch = c.googleMapsLocation?.toLowerCase().includes(q);
        let dueMatch = false;
        if (c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered') {
          const dueInfo = calculateFirstPaymentDueDate(c.deliveryDate || c.createdAt);
          dueMatch =
            dueInfo.formattedShort.toLowerCase().includes(q) ||
            dueInfo.formattedLong.toLowerCase().includes(q) ||
            dueInfo.cycleRangeText.toLowerCase().includes(q) ||
            `ชำระ 2 ${dueInfo.monthName}`.toLowerCase().includes(q);
        }
        return titleMatch || custMatch || phoneMatch || bikeMatch || codeMatch || proposalMatch || Boolean(locationMatch) || dueMatch;
      }

      return true;
    });
  }, [cases, searchQuery, statusFilter, deliveryFilter, selectedYear, selectedMonth, selectedDueMonth]);

  // Group filtered cases by Year and Month
  const groupedCases = useMemo(() => {
    const map = new Map<string, SavedCaseRecord[]>();
    filteredCases.forEach((c) => {
      const d = new Date(c.createdAt);
      const yr = d.getFullYear() + 543;
      const mo = d.getMonth() + 1;
      const key = `${yr}-${mo.toString().padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(c);
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
        const yr = parseInt(yrStr, 10);
        const mo = parseInt(moStr, 10);
        const monthObj = THAI_MONTHS.find((m) => m.id === mo);

        const monthCases = cases.filter((c) => {
          const d = new Date(c.createdAt);
          const cYr = d.getFullYear() + 543;
          const cMo = d.getMonth() + 1;
          return cYr === yr && cMo === mo;
        });

        const deliveredCount = monthCases.filter(
          (c) => c.approvalStatus === 'approved' && c.deliveryStatus === 'delivered'
        ).length;
        const pendingDeliveryCount = monthCases.filter(
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
  }, [filteredCases, cases]);

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
          setCases(getSavedCases());
          showToast(`นำเข้าข้อมูลสำเร็จ ${res.count} รายการ`);
        } else {
          triggerHaptic('warning');
          showToast(res.error || 'เกิดข้อผิดพลาดในการนำเข้าไฟล์');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasActiveAdvancedFilter = selectedYear !== 'all' || selectedMonth !== 'all' || selectedDueMonth !== 'all';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 animate-fade-in">
      <div className="bg-white rounded-[28px] sm:rounded-[32px] w-full max-w-2xl max-h-[94vh] sm:max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Top Specular Accent Sheen */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-600 opacity-95" />

        {/* =========================================================================
            PANEL 1: SAVED CASES LIST / CARDS VIEW (หน้ารวมเคสทั้งหมด)
            ========================================================================= */}
        <div className={`flex-1 flex flex-col min-h-0 ${detailCase ? 'hidden' : 'flex'}`}>
          {/* Modal Header */}
        <div className="p-3.5 sm:p-5 pb-3 border-b border-sky-100 flex items-center justify-between gap-3 bg-gradient-to-b from-sky-50/80 to-transparent shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <FolderArchive className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight truncate">
                  เคสที่บันทึกไว้ในอุปกรณ์
                </h2>
              </div>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                บันทึกลงในเครื่อง เรียกดูหรือนำกลับมาใช้งานได้ตลอดเวลา
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Mode Switcher: รายชื่อ (แนะนำ) vs การ์ด */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-colors duration-150 cursor-pointer select-none touch-manipulation ${
                  viewMode === 'list'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="มุมมองรายชื่อลูกค้า (แตะเพื่อเปิดดูรายละเอียด)"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">รายชื่อ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition-colors duration-150 cursor-pointer select-none touch-manipulation ${
                  viewMode === 'cards'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
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
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="ปิดหน้าต่าง"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Action & Search Bar */}
        <div className="p-2.5 sm:p-4 pb-2.5 space-y-2 bg-slate-50/70 border-b border-slate-200/60 shrink-0">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, รุ่นรถ, รหัสรุ่น หรือ Proposal..."
                className="w-full pl-9 pr-7 py-1.5 sm:py-2 rounded-xl text-xs bg-white border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
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

              {/* ส่งออก */}
              <button
                type="button"
                onClick={handleExport}
                disabled={cases.length === 0}
                className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-sky-50 disabled:opacity-50 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="ส่งออก / แชร์ไฟล์เคส"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden sm:inline text-[11px]">ส่งออก</span>
              </button>

              {/* นำเข้า */}
              <label
                className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-teal-50 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="นำเข้าไฟล์เคสจากอีกเครื่อง"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
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
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/90'
                }`}
                title="วิธีย้ายข้อมูลเคสข้ามเครื่อง"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              </button>

              {cases.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-1.5 sm:p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                  title="ล้างรายการทั้งหมด"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

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
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>ทั้งหมด</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
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
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>อนุมัติ</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'approved' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
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
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                      statusFilter === 'pending'
                        ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300'
                        : 'bg-white text-sky-800 hover:bg-sky-50 border border-sky-200'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>รอผล</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'pending' ? 'bg-sky-700 text-white' : 'bg-sky-100 text-sky-800'
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
                    className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                      statusFilter === 'rejected'
                        ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                        : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                    }`}
                  >
                    <XCircle className="w-3 h-3" />
                    <span>ไม่อนุมัติ</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      statusFilter === 'rejected' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
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
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs font-extrabold'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title="ตัวกรองเพิ่มเติม (เดือน/ปี, กำหนดชำระงวดแรก)"
                >
                  <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
                  <span>ตัวกรองงวด/เดือน</span>
                  {hasActiveAdvancedFilter && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
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
                <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-600 animate-fade-in flex-wrap">
                  <span className="font-bold text-slate-400 text-[10px]">การรับรถ:</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDeliveryFilter('all');
                    }}
                    className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer transition-all ${
                      deliveryFilter === 'all'
                        ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
                        ? 'bg-teal-100 text-teal-900 font-bold border border-teal-300'
                        : 'bg-white text-teal-800 border border-slate-200 hover:bg-teal-50'
                    }`}
                  >
                    <Check className="w-3 h-3 text-teal-600" />
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
                        ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                        : 'bg-white text-amber-800 border border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>รอรับรถ ({statusCounts.pendingDelivery})</span>
                  </button>
                </div>
              )}

              {/* Expandable Advanced Filters (Month/Year & Payment Due Month) */}
              {showAdvancedFilters && (
                <div className="pt-2 mt-1 border-t border-slate-200/80 space-y-2 animate-fade-in bg-white/70 p-2.5 rounded-2xl border border-indigo-100">
                  {/* Row 1: Month/Year */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-600 shrink-0">
                      <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                      <span>เดือน/ปี:</span>
                    </div>

                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setSelectedYear(e.target.value);
                      }}
                      className="px-2 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="all">ทุกปี</option>
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr.toString()}>
                          พ.ศ. {yr}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedMonth}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setSelectedMonth(e.target.value);
                      }}
                      className="px-2 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <option value="all">ทุกเดือน</option>
                      {THAI_MONTHS.map((m) => {
                        const count = monthStats[m.id] || 0;
                        return (
                          <option key={m.id} value={m.id.toString()}>
                            {m.name} {count > 0 ? `(${count})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Row 2: First Due Month */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-indigo-700 shrink-0">
                      <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>งวดแรกชำระ:</span>
                    </div>

                    <select
                      value={selectedDueMonth}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setSelectedDueMonth(e.target.value);
                      }}
                      className={`px-2 py-1 rounded-xl text-xs font-bold border cursor-pointer shadow-2xs ${
                        selectedDueMonth !== 'all'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-extrabold'
                          : 'bg-white border-slate-200 text-slate-800'
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
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 cursor-pointer"
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
            <div className="mt-2 p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold text-rose-950">
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
                  className="px-2.5 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {/* Transfer Guide Dialog */}
          {showTransferGuide && (
            <div className="mt-2 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 via-sky-50 to-white border border-amber-300 text-slate-800 text-xs space-y-2 animate-fade-in shadow-xs relative">
              <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-1.5">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-extrabold text-xs text-slate-900">
                    วิธีย้ายข้อมูลเคสจากเครื่องหนึ่งไปอีกเครื่อง
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransferGuide(false)}
                  className="p-1 rounded-lg hover:bg-amber-100 text-slate-500 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5 text-slate-700 text-[11px]">
                <p>
                  1. <strong>เครื่องเดิม:</strong> กดปุ่ม <span className="text-sky-700 font-bold">"ส่งออก"</span> ด้านบน แล้วส่งไฟล์ <span className="font-mono bg-slate-100 px-1 rounded">.json</span> เข้า LINE หรือ AirDrop ส่งไปอีกเครื่อง
                </p>
                <p>
                  2. <strong>เครื่องใหม่:</strong> เปิดแอป เข้าหน้านี้แล้วกดปุ่ม <span className="text-teal-700 font-bold">"นำเข้า"</span> แล้วเลือกไฟล์ที่ได้รับ ข้อมูลจะเข้ามาครบถ้วนทันที
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="absolute top-16 inset-x-4 mx-auto max-w-sm z-40 p-2.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold text-center shadow-xl backdrop-blur-md animate-fade-in flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-3">
          {filteredCases.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto border border-sky-100 shadow-inner">
                <FolderArchive className="w-7 h-7 opacity-70" />
              </div>
              <div className="max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-slate-700">
                  {searchQuery ? 'ไม่พบเคสที่ตรงกับการค้นหา' : 'ยังไม่มีเคสที่บันทึกไว้ในอุปกรณ์'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
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
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-100/90 via-sky-50 to-white border border-sky-200/80 text-slate-800 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {group.monthName} พ.ศ. {group.year}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold">
                      <span className="bg-sky-500 text-white px-2 py-0.2 rounded-full">
                        {group.items.length} รายการ
                      </span>
                      {group.deliveredCount > 0 && (
                        <span className="bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded-full">
                          รับรถ {group.deliveredCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Records: LIST VIEW (รายการชื่อลูกค้า - แนะนำ) */}
                  <div className={viewMode === 'list' ? 'block' : 'hidden'}>
                    <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                      {group.items.map((record) => {
                        const isCurrentEditing = activeEditingId === record.id;
                        const isApproved = record.approvalStatus === 'approved';
                        const isDelivered = record.deliveryStatus === 'delivered';
                        const firstDue = isDelivered
                          ? calculateFirstPaymentDueDate(record.deliveryDate || record.createdAt)
                          : null;
                        const custName = getCustomerDisplayName(record);
                        const firstLetter = custName.slice(0, 1) || 'ค';

                        return (
                          <div
                            key={record.id}
                            onClick={() => setDetailCase(record)}
                            className={`p-3 sm:p-3.5 flex items-center justify-between gap-2.5 hover:bg-sky-50/60 transition-colors duration-150 cursor-pointer group active:bg-sky-100/60 ${
                              isCurrentEditing ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {/* Left: Avatar initial */}
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs border ${
                                  isApproved
                                    ? isDelivered
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : record.approvalStatus === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : record.approvalStatus === 'cancelled'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-sky-50 text-sky-700 border-sky-200'
                                }`}
                              >
                                {firstLetter}
                              </div>

                              {/* Center: Customer Name, Badges, Bike, Payment */}
                              <div className="min-w-0 flex-1 space-y-0.5">
                                {/* Row 1: Customer Name + Status Badges */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-sky-700 transition-colors truncate max-w-[170px] sm:max-w-[260px]">
                                    {custName}
                                  </span>

                                  {isCurrentEditing && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                      กำลังแก้ไข
                                    </span>
                                  )}

                                  {/* Approval Status Badge */}
                                  {(!record.approvalStatus || record.approvalStatus === 'pending') && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5 text-sky-500" />
                                      <span>รอผล</span>
                                    </span>
                                  )}
                                  {isApproved && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-0.5">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>อนุมัติ</span>
                                    </span>
                                  )}
                                  {record.approvalStatus === 'rejected' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5">
                                      <XCircle className="w-2.5 h-2.5 text-rose-600" />
                                      <span>ไม่อนุมัติ</span>
                                    </span>
                                  )}
                                  {record.approvalStatus === 'cancelled' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-0.5">
                                      <Ban className="w-2.5 h-2.5 text-slate-500" />
                                      <span>ยกเลิก</span>
                                    </span>
                                  )}

                                  {/* Delivery Badge if approved */}
                                  {isApproved && (
                                    <>
                                      {isDelivered ? (
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-0.5">
                                          <PackageCheck className="w-2.5 h-2.5 text-teal-600" />
                                          <span>รับรถแล้ว ✓</span>
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-900 border border-amber-200 inline-flex items-center gap-0.5">
                                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                                          <span>รอรับรถ</span>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Row 2: Phone + Bike Model */}
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-500 truncate">
                                  {record.customerPhone && (
                                    <span className="text-slate-600 font-medium inline-flex items-center gap-0.5">
                                      <Phone className="w-2.5 h-2.5 text-slate-400" />
                                      {record.customerPhone}
                                    </span>
                                  )}
                                  {record.customerPhone && record.bikeModelName && (
                                    <span className="text-slate-300">•</span>
                                  )}
                                  {record.bikeModelName && (
                                    <span className="truncate text-slate-700 font-medium inline-flex items-center gap-0.5">
                                      <Bike className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{record.bikeModelName}</span>
                                    </span>
                                  )}
                                </div>

                                {/* Row 3: First Due Date badge or Installment preview */}
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-0.5">
                                  {firstDue && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-bold inline-flex items-center gap-0.5">
                                      <CalendarClock className="w-2.5 h-2.5 text-indigo-600" />
                                      <span>งวดแรก: 2 {firstDue.monthShort} {firstDue.thaiShortYear}</span>
                                    </span>
                                  )}
                                  <span className="text-slate-600 font-medium">
                                    ค่างวด <strong className="text-sky-700 font-bold">{formatBaht(record.snapshot.monthlyInstallment)}</strong>/ด. ({record.term} งวด)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right: View Detail Indicator Button */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="hidden xs:inline text-[11px] font-bold text-sky-600 group-hover:text-sky-700">
                                ดูข้อมูล
                              </span>
                              <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-sky-500 group-hover:text-white text-slate-400 flex items-center justify-center transition-colors duration-150 shadow-2xs">
                                <ChevronRight className="w-4 h-4" />
                              </div>
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
                            className={`p-3 sm:p-4 rounded-2xl bg-white border shadow-2xs hover:shadow-md transition-colors duration-150 cursor-pointer space-y-2 relative group ${
                              isCurrentEditing
                                ? 'border-amber-400 ring-2 ring-amber-300/60 bg-amber-50/20'
                                : 'border-slate-200/80 hover:border-sky-300'
                            }`}
                          >
                            {/* Card Top: Customer Name & Badges */}
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-extrabold text-sm text-slate-800 group-hover:text-sky-700 transition-colors">
                                  {custName}
                                </h3>
                                {record.customerPhone && (
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    ({record.customerPhone})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {isApproved ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                                    อนุมัติ
                                  </span>
                                ) : record.approvalStatus === 'rejected' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300">
                                    ไม่อนุมัติ
                                  </span>
                                ) : record.approvalStatus === 'cancelled' ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                                    ยกเลิก
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                    รอผล
                                  </span>
                                )}

                                {isApproved && (
                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      isDelivered
                                        ? 'bg-teal-50 text-teal-800 border-teal-300'
                                        : 'bg-amber-50 text-amber-900 border-amber-300'
                                    }`}
                                  >
                                    {isDelivered ? 'รับรถแล้ว ✓' : 'รอรับรถ ⏳'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Bike & Proposal row */}
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                              {record.bikeModelName && (
                                <span className="font-medium text-slate-700 flex items-center gap-1">
                                  <Bike className="w-3.5 h-3.5 text-slate-400" />
                                  {record.bikeModelName}
                                </span>
                              )}
                              <span>•</span>
                              <span className="text-[10px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                {record.snapshot.proposalCode}
                              </span>
                              {firstDue && (
                                <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                  งวดแรก: 2 {firstDue.monthShort} {firstDue.thaiShortYear}
                                </span>
                              )}
                            </div>

                            {/* Financial 4 stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                              <div>
                                <span className="text-[9.5px] text-slate-400 block">ค่างวดต่อเดือน:</span>
                                <span className="font-black text-sky-700 text-xs sm:text-sm">
                                  {formatBaht(record.snapshot.monthlyInstallment)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9.5px] text-slate-400 block">ระยะเวลา:</span>
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {record.term} งวด
                                </span>
                              </div>
                              <div>
                                <span className="text-[9.5px] text-slate-400 block">เงินดาวน์:</span>
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {formatBaht(record.snapshot.downAmount)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9.5px] text-slate-400 block">ยอดจัด:</span>
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {formatBaht(record.snapshot.financeAmount, true)}
                                </span>
                              </div>
                            </div>

                            {/* Card Footer: Tap to open popup prompt */}
                            <div className="flex items-center justify-between text-[11px] text-sky-600 font-bold pt-0.5">
                              <span className="text-slate-400 text-[10px]">
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
        <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="text-[11px] truncate pr-2">
            บันทึกลงในเครื่อง (LocalStorage) ปลอดภัย เป็นส่วนตัว
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold cursor-pointer transition-colors shrink-0"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* =========================================================================
          PANEL 2: DEDICATED CASE DETAIL VIEW (หน้ารายละเอียดเคสที่เลือก)
          ========================================================================= */}
      {detailCase && (
        <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
          {/* Popup Header */}
          <div className="p-3.5 sm:p-5 pb-3 border-b border-sky-100 flex items-center justify-between gap-2.5 bg-gradient-to-b from-sky-50/90 to-white shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* ปุ่มย้อนกลับไปหน้ารายการเคส */}
              <button
                type="button"
                onClick={() => setDetailCase(null)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 font-bold text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer transition-colors duration-150 shrink-0 active:scale-95 select-none touch-manipulation"
                title="กลับไปยังหน้ารายการเคสทั้งหมด"
              >
                <ChevronLeft className="w-4 h-4 text-sky-600" />
                <span className="text-[11px]">รายการ</span>
              </button>

              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                {editingId === detailCase.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editTitleInput}
                      onChange={(e) => setEditTitleInput(e.target.value)}
                      autoFocus
                      className="px-2.5 py-1 text-xs font-bold text-slate-800 bg-sky-50 border border-sky-300 rounded-lg focus:outline-none w-full"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveTitle(detailCase.id)}
                      className="p-1.5 rounded-lg bg-emerald-600 text-white text-xs cursor-pointer hover:bg-emerald-700 shrink-0"
                      title="บันทึกชื่อ"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg bg-slate-200 text-slate-600 text-xs cursor-pointer hover:bg-slate-300 shrink-0"
                      title="ยกเลิก"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">
                      {getCustomerDisplayName(detailCase)}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleStartEditTitle(detailCase)}
                      className="p-1 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                      title="แก้ไขชื่อลูกค้า"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 truncate">
                  บันทึกเมื่อ {formatThaiDateTime(detailCase.createdAt)} • {detailCase.snapshot.proposalCode}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDetailCase(null);
                onClose();
              }}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Popup Scrollable Body with smooth touch scrolling and overscroll contain */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
              {/* SECTION 1: Status & Delivery Management */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-sky-50/30 to-white border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                    สถานะการพิจารณาเคส
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    (แตะเพื่อเปลี่ยนสถานะ)
                  </span>
                </div>

                {/* Status Switcher Buttons */}
                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-200/80 text-xs font-bold">
                  {/* รอผล */}
                  <button
                    type="button"
                    onClick={() => handleSetApprovalStatus(detailCase.id, 'pending')}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                      (!detailCase.approvalStatus || detailCase.approvalStatus === 'pending')
                        ? 'bg-white text-sky-800 shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-sky-500" />
                    <span>รอผล</span>
                  </button>

                  {/* อนุมัติ */}
                  <button
                    type="button"
                    onClick={() => handleSetApprovalStatus(detailCase.id, 'approved')}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                      detailCase.approvalStatus === 'approved'
                        ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>อนุมัติ</span>
                  </button>

                  {/* ไม่อนุมัติ */}
                  <button
                    type="button"
                    onClick={() => handleSetApprovalStatus(detailCase.id, 'rejected')}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                      detailCase.approvalStatus === 'rejected'
                        ? 'bg-rose-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    <XCircle className="w-3 h-3" />
                    <span>ไม่อนุมัติ</span>
                  </button>

                  {/* ยกเลิก */}
                  <button
                    type="button"
                    onClick={() => handleSetApprovalStatus(detailCase.id, 'cancelled')}
                    className={`py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] ${
                      detailCase.approvalStatus === 'cancelled'
                        ? 'bg-slate-700 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Ban className="w-3 h-3" />
                    <span>ยกเลิก</span>
                  </button>
                </div>

                {/* If Approved: Delivery Status Toggle & Dates */}
                {detailCase.approvalStatus === 'approved' && (
                  <div className="space-y-3 pt-1 animate-fade-in border-t border-slate-200/80">
                    {/* Delivery Status Switch */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Bike className="w-4 h-4 text-teal-600" />
                        การรับมอบรถ:
                      </span>
                      <div className="inline-flex rounded-xl p-0.5 bg-slate-200/80 text-xs font-bold gap-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleSetDeliveryStatus(detailCase.id, 'pending_delivery')}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                            (!detailCase.deliveryStatus || detailCase.deliveryStatus === 'pending_delivery')
                              ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                              : 'text-slate-600 hover:text-amber-800'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>รอรับรถ ⏳</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetDeliveryStatus(detailCase.id, 'delivered')}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                            detailCase.deliveryStatus === 'delivered'
                              ? 'bg-teal-600 text-white shadow-xs font-extrabold'
                              : 'text-slate-600 hover:text-teal-800'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>รับรถแล้ว ✓</span>
                        </button>
                      </div>
                    </div>

                    {/* Date Pickers for วันอนุมัติ and วันรับรถ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {/* วันอนุมัติ */}
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>วันอนุมัติ:</span>
                        </div>
                        <input
                          type="date"
                          value={detailCase.approvalDate || toInputDateStr(detailCase.createdAt)}
                          onChange={(e) => handleSetDates(detailCase.id, { approvalDate: e.target.value })}
                          className="text-xs font-bold text-slate-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 focus:outline-none cursor-pointer"
                        />
                      </div>

                      {/* วันรับรถ */}
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800">
                          <PackageCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            {detailCase.deliveryStatus === 'delivered' ? 'วันรับรถ:' : 'วันนัดรับ:'}
                          </span>
                        </div>
                        <input
                          type="date"
                          value={detailCase.deliveryDate || (detailCase.deliveryStatus === 'delivered' ? toInputDateStr(detailCase.createdAt) : '')}
                          onChange={(e) => handleSetDates(detailCase.id, { deliveryDate: e.target.value })}
                          className="text-xs font-bold text-slate-800 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200 focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* AUTOMATIC FIRST PAYMENT DUE CARD (คำนวณอัตโนมัติ ชำระทุกวันที่ 2 ของเดือน) */}
                    {detailCase.deliveryStatus === 'delivered' && (() => {
                      const firstDue = calculateFirstPaymentDueDate(detailCase.deliveryDate || detailCase.createdAt);
                      return (
                        <div className="bg-gradient-to-r from-indigo-50 via-white to-sky-50/60 p-3 sm:p-3.5 rounded-2xl border border-indigo-200 space-y-2 shadow-2xs animate-fade-in">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                <CalendarClock className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-indigo-950 block">
                                  กำหนดชำระงวดแรก (ขึ้นอัตโนมัติ)
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ชำระทุกวันที่ 2 ของทุกเดือนทุกราย
                                </span>
                              </div>
                            </div>
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                              คำนวณอัตโนมัติ
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-1">
                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-slate-500">
                                วันครบกำหนดชำระงวดแรก:
                              </span>
                              <span className="text-sm sm:text-base font-black text-indigo-900 tracking-tight">
                                {firstDue.formattedLong}
                              </span>
                            </div>
                            <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-2 text-[10.5px] text-slate-600 flex-wrap">
                              <span>
                                {firstDue.cycleRangeText} ➔ ชำระงวดแรก 2 {firstDue.monthName}
                              </span>
                              <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 px-2 py-0.2 rounded-md">
                                งวดถัดไป: ทุกวันที่ 2 ของทุกเดือน
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* SECTION 2: Google Maps Location & Navigation */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-sky-200/90 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>ตำแหน่งที่อยู่ปัจจุบัน (คัดลอกจาก Google Maps):</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePasteLocation(detailCase.id)}
                    className="text-[10.5px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200 flex items-center gap-1 cursor-pointer transition-colors"
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
                    className="w-full pl-3 pr-8 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-white focus:border-sky-400 font-medium"
                  />
                  {detailCase.googleMapsLocation && (
                    <button
                      type="button"
                      onClick={() => handleSaveLocation(detailCase.id, '')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
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
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
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
              </div>

              {/* SECTION 3: Customer & Motorcycle Info */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                <span className="font-black text-slate-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-sky-600" />
                  ข้อมูลลูกค้าและรุ่นรถ
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div className="p-2 rounded-xl bg-white border border-slate-200/70">
                    <span className="text-[10px] text-slate-400 block">ชื่อลูกค้า:</span>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                      {detailCase.customerName || 'ไม่ระบุชื่อ'}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">เบอร์โทรศัพท์:</span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                        {detailCase.customerPhone || 'ไม่ระบุเบอร์'}
                      </span>
                    </div>
                    {detailCase.customerPhone && (
                      <a
                        href={`tel:${detailCase.customerPhone}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10.5px] border border-emerald-200 inline-flex items-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>โทรออก</span>
                      </a>
                    )}
                  </div>

                  <div className="p-2 rounded-xl bg-white border border-slate-200/70 sm:col-span-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">รุ่นรถมอเตอร์ไซค์:</span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1">
                        <Bike className="w-4 h-4 text-sky-600 shrink-0" />
                        {detailCase.bikeModelName || 'ไม่ระบุรุ่น'}
                        {detailCase.bikeModelCode && (
                          <span className="text-[10.5px] text-slate-500 font-normal">
                            ({detailCase.bikeModelCode})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block">ราคารถเงินสด:</span>
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                        {formatBaht(detailCase.vehiclePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Financial & Installment Breakdown */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 space-y-3 shadow-2xs">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  สรุปข้อมูลทางการเงินและค่างวด
                </span>

                {/* 4 Large Highlight Stat Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-50 to-cyan-50/50 border border-sky-200">
                    <span className="text-[10.5px] font-bold text-sky-800 block">ค่างวดต่อเดือน:</span>
                    <span className="text-lg sm:text-xl font-black text-sky-800 tracking-tight block">
                      {formatBaht(detailCase.snapshot.monthlyInstallment)}
                      <span className="text-xs font-normal text-slate-500"> /งวด</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10.5px] font-bold text-slate-600 block">ระยะเวลาผ่อน:</span>
                    <span className="text-lg sm:text-xl font-black text-slate-800 block">
                      {detailCase.term}
                      <span className="text-xs font-normal text-slate-500"> งวด</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {detailCase.snapshot.rateDisplayText}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10.5px] font-bold text-slate-600 block">เงินดาวน์:</span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-800 block">
                      {formatBaht(detailCase.snapshot.downAmount)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      ({detailCase.snapshot.downPercent.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10.5px] font-bold text-slate-600 block">ยอดจัดไฟแนนซ์:</span>
                    <span className="text-sm sm:text-base font-extrabold text-slate-800 block">
                      {formatBaht(detailCase.snapshot.financeAmount, true)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      ถอด VAT: {formatBaht(detailCase.snapshot.financeAmount / 1.07)}
                    </span>
                  </div>
                </div>

                {/* Additional Detailed Numbers */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] space-y-1.5 text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>รวมเงินค่างวดทั้งสิ้น:</span>
                    <span className="font-extrabold text-slate-900">
                      {formatBaht(detailCase.snapshot.totalWithVat)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>ดอกเบี้ยรวมทั้งสัญญา:</span>
                    <span className="font-extrabold text-slate-900">
                      {formatBaht(detailCase.snapshot.totalInterest)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>อัตราดอกเบี้ยแท้จริง (EIR):</span>
                    <span className="font-bold text-slate-800">
                      {detailCase.snapshot.eirAnnualPercent.toFixed(2)}% ต่อปี
                    </span>
                  </div>
                  {detailCase.insurancePlan && detailCase.insurancePlan !== 'none' && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="flex items-center gap-1 text-teal-800 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                        ประกันภัยกลุ่ม PA:
                      </span>
                      <span className="font-extrabold text-teal-900">
                        {detailCase.insurancePlan.toUpperCase()} ({detailCase.insuranceYears} ปี)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 5: Notes & Proposal Info */}
              {detailCase.customerNote && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
                  <span className="font-bold text-amber-900">บันทึกเพิ่มเติม:</span>
                  <p className="text-amber-800 leading-relaxed">{detailCase.customerNote}</p>
                </div>
              )}
            </div>

            {/* Popup Action Footer */}
            <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
              {/* Delete button with confirm */}
              {deleteConfirmId === detailCase.id ? (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-1 rounded-xl shadow-2xs">
                  <span className="text-[10px] text-rose-800 font-bold">ลบเคสนี้?</span>
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
                    className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-[10px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(detailCase.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="ลบเคสนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-center gap-2">
                {/* ปุ่มแก้ไขเคส */}
                {onEditCase && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onEditCase(detailCase);
                      setDetailCase(null);
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                    title="ดึงเคสนี้กลับมาแก้ไขในโปรแกรมคำนวณ"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>แก้ไขเคส</span>
                  </button>
                )}

                {/* ปุ่มนำมาใช้งาน */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('success');
                    onLoadCase(detailCase);
                    setDetailCase(null);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-sky-500/25 active:scale-95 transition-all cursor-pointer"
                  title="นำตัวเลขในเคสนี้มาใช้งานเป็นเคสใหม่"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>นำมาใช้งาน</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
