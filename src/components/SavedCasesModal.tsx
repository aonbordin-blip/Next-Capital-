import React, { useState, useMemo } from 'react';
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
  FileCheck2,
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
  CheckCheck,
  Filter,
  CalendarDays,
  CalendarClock,
  Layers,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  HelpCircle,
  Smartphone,
  MapPin,
  Navigation,
  ClipboardCopy,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [previewCase, setPreviewCase] = useState<SavedCaseRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const [expandedStatusId, setExpandedStatusId] = useState<string | null>(null);
  const [showTransferGuide, setShowTransferGuide] = useState<boolean>(false);

  // Load cases when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCases(getSavedCases());
      setSearchQuery('');
      setStatusFilter('all');
      setDeliveryFilter('all');
      setSelectedYear('all');
      setSelectedMonth('all');
      setSelectedDueMonth('all');
      setEditingId(null);
      setPreviewCase(null);
      setDeleteConfirmId(null);
      setShowClearAllConfirm(false);
      setExpandedStatusId(null);
      setShowTransferGuide(false);
    }
  }, [isOpen]);

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

  // สถิติและตัวนับกำหนดชำระงวดแรก สำหรับคัดกรองรายชื่อลูกค้าตามงวดที่ต้องชำระ
  const dueMonthStats = useMemo(() => {
    const counts: Record<string, { key: string; label: string; shortLabel: string; thaiYear: number; month: number; count: number }> = {};
    let totalDelivered = 0;

    cases.forEach((c) => {
      // Scope by selected year and month if filtered
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
      // Year & Month filter (based on case creation date / active date)
      const d = new Date(c.createdAt);
      const caseYear = (d.getFullYear() + 543).toString();
      const caseMonth = (d.getMonth() + 1).toString();

      if (selectedYear !== 'all' && caseYear !== selectedYear) {
        return false;
      }
      if (selectedMonth !== 'all' && caseMonth !== selectedMonth) {
        return false;
      }

      // Delivery filter (เมื่อเลือกดูเฉพาะ รับรถ หรือ รอรับ)
      if (deliveryFilter !== 'all') {
        const isApproved = c.approvalStatus === 'approved';
        const caseDelivery = c.deliveryStatus || 'pending_delivery';
        if (!isApproved || caseDelivery !== deliveryFilter) {
          return false;
        }
      }

      // First Installment Due Month filter (กำหนดชำระงวดแรกตามที่เลือก)
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

  // Group filtered cases by Year and Month for clean separation
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

        // Calculate delivery counts for this month
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

  const handleSetPaymentDueDay = (id: string, dueDay: number | undefined) => {
    triggerHaptic('success');
    const updated = updateCasePaymentDueDay(id, dueDay);
    setCases(updated);
    if (dueDay) {
      showToast(`✓ กำหนดวันชำระ: ทุกวันที่ ${dueDay} ของทุกเดือน`);
    } else {
      showToast('ยกเลิกวันกำหนดชำระแล้ว');
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
          showToast('✓ วางลิงก์/ที่อยู่ Google Maps เรียบร้อย');
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

  // แสดงเฉพาะชื่อลูกค้าในส่วนหัวข้อเคสตามที่ผู้ใช้ต้องการ
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
    if (previewCase?.id === id) setPreviewCase(null);
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
    setPreviewCase(null);
    setShowClearAllConfirm(false);
    onDeleteCase?.();
    showToast('ล้างรายการทั้งหมดแล้ว');
  };

  const handleExport = async () => {
    triggerHaptic('success');
    const jsonStr = exportCasesAsJson();
    const fileName = `MotoLease_Saved_Cases_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([jsonStr], { type: 'application/json' });

    // Support Web Share API (share directly via LINE, AirDrop, Chat, etc.)
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

  const formatThaiDate = (timestamp: number) => {
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white/95 backdrop-blur-2xl rounded-[32px] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-white/80 overflow-hidden relative">
        {/* Top Specular Accent Sheen */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-600 opacity-95" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-sky-100 flex items-center justify-between gap-3 bg-gradient-to-b from-sky-50/70 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 shrink-0">
              <FolderArchive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                เคสที่บันทึกไว้ในอุปกรณ์
              </h2>
              <p className="text-[11px] text-slate-500">
                ข้อมูลถูกเก็บไว้ในเครื่องของคุณ สามารถดึงกลับมาคำนวณหรือดูได้ทุกเมื่อโดยไม่ต้องต่อเน็ต
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className="p-3 sm:px-5 space-y-2.5 bg-slate-50/60 border-b border-slate-200/60">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า, รุ่นรถ, รหัสรุ่น หรือ Proposal..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-0.5">
              {onSaveCurrentCase && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveCurrentCase();
                    setCases(getSavedCases());
                    showToast('บันทึกเคสปัจจุบันลงเครื่องเรียบร้อยแล้ว!');
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shadow-sky-500/20 hover:opacity-95 cursor-pointer whitespace-nowrap"
                  title="บันทึกข้อมูลหน้าจอปัจจุบันเป็นเคสใหม่"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>บันทึกเคสนี้</span>
                </button>
              )}

              {/* ส่งออก / แชร์ไฟล์ */}
              <button
                type="button"
                onClick={handleExport}
                disabled={cases.length === 0}
                className="px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-sky-50 disabled:opacity-50 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="ส่งออก / แชร์ไฟล์ข้อมูลเคสเพื่อส่งต่อไปอีกเครื่อง"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-[11px]">ส่งออก</span>
              </button>

              {/* นำเข้าไฟล์ */}
              <label
                className="px-2.5 py-1.5 sm:py-2 rounded-xl bg-white hover:bg-teal-50 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all"
                title="นำเข้าไฟล์ข้อมูลเคสจากอีกเครื่อง"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-[11px]">นำเข้า</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>

              {/* ปุ่มช่วยเหลือวิธีย้ายเครื่อง */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowTransferGuide((prev) => !prev);
                }}
                className={`px-2 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1 border shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 transition-all ${
                  showTransferGuide
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/90'
                }`}
                title="วิธีย้ายข้อมูลเคสจากเครื่องหนึ่งไปอีกเครื่อง"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline text-[11px]">วิธีย้ายเครื่อง</span>
              </button>

              {cases.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                  title="ล้างรายการทั้งหมด"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Chips Bar */}
          {cases.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {/* ทั้งหมด */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setStatusFilter('all');
                    setDeliveryFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                    statusFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>ทั้งหมด</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] ${
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
                  className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                    statusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                      : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>อนุมัติ</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] ${
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
                  className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                    statusFilter === 'pending'
                      ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300'
                      : 'bg-white text-sky-800 hover:bg-sky-50 border border-sky-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>รอผล</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] ${
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
                  className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                    statusFilter === 'rejected'
                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                      : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>ไม่อนุมัติ</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] ${
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
                  className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                    statusFilter === 'cancelled'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>ยกเลิก</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9.5px] ${
                    statusFilter === 'cancelled' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {statusCounts.cancelled}
                  </span>
                </button>
              </div>

              {/* Sub-filter for Delivery Status when "อนุมัติ" is active */}
              {statusFilter === 'approved' && (
                <div className="flex items-center gap-1.5 pt-1 pl-1 text-[11px] text-slate-600 animate-fade-in flex-wrap">
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
                </div>
              )}

              {/* Month & Year Filter Bar (แบ่งแยกเดือนและปี ให้เลือกได้) */}
              <div className="pt-2 mt-1 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-600 shrink-0">
                    <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                    <span>เลือกเดือน/ปี:</span>
                  </div>

                  {/* Year Select (พ.ศ.) */}
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setSelectedYear(e.target.value);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer shadow-2xs"
                  >
                    <option value="all">ทุกปี</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr.toString()}>
                        พ.ศ. {yr}
                      </option>
                    ))}
                  </select>

                  {/* Month Select */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setSelectedMonth(e.target.value);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer shadow-2xs"
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

                  {/* Quick Month Filter Chips for months with cases */}
                  <div className="hidden sm:flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
                    {THAI_MONTHS.filter((m) => (monthStats[m.id] || 0) > 0).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedMonth(selectedMonth === m.id.toString() ? 'all' : m.id.toString());
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedMonth === m.id.toString()
                            ? 'bg-sky-600 text-white shadow-2xs ring-1 ring-sky-300'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span>{m.short}</span>
                        <span className="ml-0.5 text-[9px] opacity-80">({monthStats[m.id] || 0})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment First Due Month Filter Bar (แสดงรายชื่อข้อมูลลูกค้าตามงวดแรกที่กำหนดชำระ ชำระทุกวันที่ 2) */}
              <div className="pt-2 mt-1 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[10.5px] font-bold text-indigo-700 shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>กำหนดชำระงวดแรก:</span>
                  </div>

                  {/* Due Month Select */}
                  <select
                    value={selectedDueMonth}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setSelectedDueMonth(e.target.value);
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                      selectedDueMonth !== 'all'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900 ring-1 ring-indigo-300'
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

                  {/* Quick Due Month Filter Chips for months with active cases */}
                  <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
                    {dueMonthStats.activeDueMonths.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedDueMonth(selectedDueMonth === item.key ? 'all' : item.key);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                          selectedDueMonth === item.key
                            ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-300'
                            : 'bg-indigo-50/70 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                        }`}
                        title={`แสดงเฉพาะลูกค้าที่ครบกำหนดชำระงวดแรก ${item.label}`}
                      >
                        <span>{item.shortLabel}</span>
                        <span className="ml-0.5 text-[9px] opacity-80">({item.count})</span>
                      </button>
                    ))}

                    {selectedDueMonth !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedDueMonth('all');
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer whitespace-nowrap transition-colors"
                        title="ล้างตัวกรองกำหนดชำระงวดแรก"
                      >
                        ✕ ล้างตัวกรองงวด
                      </button>
                    )}
                  </div>
                </div>

                {dueMonthStats.totalDelivered > 0 && (
                  <div className="text-[10px] text-slate-500 font-medium shrink-0">
                    รับรถแล้ว <span className="font-bold text-teal-700">{dueMonthStats.totalDelivered}</span> คน
                    {selectedDueMonth !== 'all' && (
                      <span className="text-indigo-700 font-bold ml-1">
                        (งวดนี้ {dueMonthStats.counts[selectedDueMonth]?.count || 0} คน)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clear All In-App Confirmation Banner */}
          {showClearAllConfirm && (
            <div className="mt-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in shadow-xs">
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

          {/* Transfer Guide Dialog (วิธีย้ายข้อมูลเคสข้ามเครื่อง) */}
          {showTransferGuide && (
            <div className="mt-2.5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-50 via-sky-50 to-white border border-amber-300 text-slate-800 text-xs space-y-2.5 animate-fade-in shadow-xs relative">
              <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                    วิธีย้ายข้อมูลเคสจากเครื่องหนึ่งไปอีกเครื่อง
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransferGuide(false)}
                  className="p-1 rounded-lg hover:bg-amber-100 text-slate-500 hover:text-slate-800 cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-slate-700 leading-relaxed text-[11px] sm:text-xs">
                <div className="p-2.5 rounded-xl bg-white/90 border border-sky-200 shadow-2xs space-y-1">
                  <div className="font-extrabold text-sky-800 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>ขั้นตอนที่ 1: เครื่องต้นทาง (เครื่องเดิมที่มีข้อมูล)</span>
                  </div>
                  <p className="text-slate-600 pl-5">
                    1. กดปุ่ม <strong className="text-sky-700">"ส่งออก"</strong> ด้านบน<br />
                    2. เลือกว่าจะส่งไฟล์เข้า <strong className="text-emerald-700">LINE / ส่งต่อให้อีกเครื่อง</strong> หรือ บันทึกลงในเครื่อง (ไฟล์จะมีนามสกุล <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded">.json</span>)
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white/90 border border-teal-200 shadow-2xs space-y-1">
                  <div className="font-extrabold text-teal-800 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-teal-600" />
                    <span>ขั้นตอนที่ 2: เครื่องปลายทาง (เครื่องใหม่ที่ต้องการรับเคส)</span>
                  </div>
                  <p className="text-slate-600 pl-5">
                    1. ในเครื่องใหม่ เปิดแอปแล้วกดเข้ามาที่หน้านี้ ("เคสที่บันทึกไว้ในอุปกรณ์")<br />
                    2. กดปุ่ม <strong className="text-teal-700">"นำเข้า"</strong> ด้านบน แล้วเลือกไฟล์ <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded">.json</span> ที่ได้รับมา<br />
                    3. ระบบจะดึงเคสทั้งหมดเข้ามาในเครื่องใหม่ทันที โดยไม่ทับข้อมูลเก่า
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowTransferGuide(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  เข้าใจแล้ว ปิดหน้าต่างนี้
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="absolute top-20 inset-x-4 mx-auto max-w-sm z-30 p-2.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold text-center shadow-xl backdrop-blur-md animate-fade-in flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {filteredCases.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto border border-sky-100 shadow-inner">
                <FolderArchive className="w-8 h-8 opacity-70" />
              </div>
              <div className="max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-slate-700">
                  {searchQuery ? 'ไม่พบเคสที่ตรงกับการค้นหา' : 'ยังไม่มีเคสที่บันทึกไว้ในอุปกรณ์'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {searchQuery
                    ? 'ลองเปลี่ยนคำค้นหาเป็นชื่อลูกค้า หรือรุ่นรถมอเตอร์ไซค์'
                    : 'เมื่อคุณกรอกข้อมูลคำนวณค่างวด สามารถกดปุ่ม "บันทึกเคสนี้" เพื่อเก็บประวัติไว้เรียกดูหรือนำกลับมาใช้งานต่อได้ตลอดเวลา'}
                </p>
                {onSaveCurrentCase && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveCurrentCase();
                      setCases(getSavedCases());
                      showToast('บันทึกเคสปัจจุบันลงเครื่องเรียบร้อยแล้ว!');
                    }}
                    className="mt-4 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs shadow-md shadow-sky-500/20 hover:opacity-95 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>บันทึกเคสที่กำลังเปิดอยู่นี้ทันที</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCases.map((group) => (
                <div key={group.key} className="space-y-2.5">
                  {/* Sticky Month & Year Header Banner */}
                  <div className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-sky-100/90 via-sky-50 to-white border border-sky-200/80 text-slate-800 shadow-2xs">
                    <CalendarDays className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      {group.monthName} พ.ศ. {group.year}
                    </span>
                  </div>

                  {/* Cards for this Month Group */}
                  <div className="grid grid-cols-1 gap-3">
                    {group.items.map((record) => {
                      const isEditing = editingId === record.id;
                      const isCurrentEditing = activeEditingId === record.id;
                      const isStatusExpanded = expandedStatusId === record.id;
                      return (
                        <div
                          key={record.id}
                          onClick={() => {
                            triggerHaptic('light');
                            setExpandedStatusId((prev) => (prev === record.id ? null : record.id));
                          }}
                          className={`p-3.5 sm:p-4 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all duration-200 space-y-2.5 relative group cursor-pointer ${
                            isStatusExpanded
                              ? 'border-sky-400 ring-2 ring-sky-300/40 shadow-sm'
                              : isCurrentEditing
                              ? 'border-amber-400 ring-2 ring-amber-300/60 bg-amber-50/20'
                              : 'border-slate-200/80 hover:border-sky-300'
                          }`}
                        >
                          {/* Card Top: Title, Date, Customer & Badges */}
                          <div className="space-y-1.5">
                            {/* Case Title Row */}
                            {isEditing ? (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5"
                              >
                                <input
                                  type="text"
                                  value={editTitleInput}
                                  onChange={(e) => setEditTitleInput(e.target.value)}
                                  autoFocus
                                  className="w-full px-2 py-1 text-xs font-bold text-slate-800 bg-sky-50 border border-sky-300 rounded-lg focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveTitle(record.id);
                                  }}
                                  className="p-1 rounded-lg bg-emerald-600 text-white text-xs cursor-pointer hover:bg-emerald-700"
                                  title="บันทึกชื่อ"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingId(null);
                                  }}
                                  className="p-1 rounded-lg bg-slate-200 text-slate-600 text-xs cursor-pointer hover:bg-slate-300"
                                  title="ยกเลิก"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className="font-extrabold text-sm text-slate-800">
                                    {getCustomerDisplayName(record)}
                                  </h3>
                                  {isCurrentEditing && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                      <Pencil className="w-2.5 h-2.5 text-amber-700" />
                                      กำลังแก้ไข
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditTitle(record);
                                    }}
                                    className="text-slate-400 hover:text-sky-600 transition-colors p-0.5 cursor-pointer opacity-70 group-hover:opacity-100"
                                    title="แก้ไขชื่อลูกค้า"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Approval & Delivery Status Indicators (สัญลักษณ์สถานะ) */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {/* Case Approval Status Badge */}
                                  {(!record.approvalStatus || record.approvalStatus === 'pending') && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-1 shadow-2xs">
                                      <Clock className="w-3 h-3 text-sky-500" />
                                      <span>รอผล</span>
                                    </span>
                                  )}
                                  {record.approvalStatus === 'approved' && (
                                    <>
                                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>อนุมัติ</span>
                                      </span>
                                      {/* Vehicle Delivery Status Badge (ถ้าอนุมัติ ให้ดูได้ด้วย รับรถแล้ว หรือ รอรับรถ) */}
                                      {record.deliveryStatus === 'delivered' ? (
                                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-300 inline-flex items-center gap-1 shadow-2xs">
                                          <PackageCheck className="w-3.5 h-3.5 text-teal-600" />
                                          <span>รับรถแล้ว ✓</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
                                          <Clock className="w-3 h-3 text-amber-600" />
                                          <span>รอรับรถ ⏳</span>
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {record.approvalStatus === 'rejected' && (
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 inline-flex items-center gap-1 shadow-2xs">
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      <span>ไม่อนุมัติ</span>
                                    </span>
                                  )}
                                  {record.approvalStatus === 'cancelled' && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1 shadow-2xs">
                                      <Ban className="w-3 h-3 text-slate-500" />
                                      <span>ยกเลิก</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Row 1: วันที่และเวลา + ประเภทข้อเสนอ (ย้ายมาต่อจากวันที่และเวลา) */}
                            <div className="flex items-center gap-2 flex-wrap text-[10.5px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatThaiDate(record.createdAt)}
                              </span>
                              <span>•</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 inline-flex items-center">
                                {record.snapshot.proposalCode}
                              </span>
                            </div>

                            {/* Row 2: ชื่อลูกค้าและเบอร์โทร + รุ่นรถ (ย้ายมาต่อหลังเบอร์โทร) */}
                            <div className="flex items-center gap-2 flex-wrap text-[10.5px]">
                              <span className="flex items-center gap-1 text-slate-700 font-medium">
                                <User className="w-3.5 h-3.5 text-sky-600" />
                                {record.customerName}
                                {record.customerPhone && ` (${record.customerPhone})`}
                              </span>
                              {record.bikeModelName && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1 border border-slate-200/80 max-w-[280px] truncate">
                                    <Bike className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{record.bikeModelName}</span>
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Row 3: วันอนุมัติ และ วันรับรถ (แสดงข้อมูลวันที่ชัดเจน) */}
                            {record.approvalStatus === 'approved' && (
                              <div className="flex items-center gap-2 flex-wrap text-[10.5px] pt-0.5 animate-fade-in">
                                {/* วันอนุมัติ */}
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200/90 font-medium shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="text-emerald-700 font-bold">วันอนุมัติ:</span>
                                  <span className="font-extrabold text-emerald-950">
                                    {formatThaiDateOnly(record.approvalDate || record.createdAt)}
                                  </span>
                                </div>

                                {/* วันรับรถ */}
                                {record.deliveryStatus === 'delivered' ? (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200/90 font-medium shadow-2xs">
                                    <PackageCheck className="w-3 h-3 text-teal-600 shrink-0" />
                                    <span className="text-teal-700 font-bold">วันรับรถ:</span>
                                    <span className="font-extrabold text-teal-950">
                                      {formatThaiDateOnly(record.deliveryDate || record.createdAt)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 border border-amber-200/90 font-medium shadow-2xs">
                                    <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span className="text-amber-800 font-bold">
                                      {record.deliveryDate ? 'นัดรับรถ:' : 'การรับรถ:'}
                                    </span>
                                    <span className="font-extrabold text-amber-950">
                                      {record.deliveryDate ? formatThaiDateOnly(record.deliveryDate) : 'รอรับรถ ⏳'}
                                    </span>
                                  </div>
                                )}

                                {/* กำหนดชำระงวดแรก (ขึ้นสถานะอัตโนมัติเมื่อรับรถแล้ว ชำระทุกวันที่ 2 ของเดือน) */}
                                {record.deliveryStatus === 'delivered' && (() => {
                                  const firstDue = calculateFirstPaymentDueDate(record.deliveryDate || record.createdAt);
                                  return (
                                    <div
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200/90 font-medium shadow-2xs"
                                      title={`${firstDue.cycleRangeText} ➔ ชำระงวดแรก ${firstDue.formattedShort} (งวดถัดไปทุกวันที่ 2 ของทุกเดือน)`}
                                    >
                                      <CalendarClock className="w-3 h-3 text-indigo-600 shrink-0" />
                                      <span className="text-indigo-700 font-bold">กำหนดชำระงวดแรก:</span>
                                      <span className="font-extrabold text-indigo-950">
                                        {firstDue.formattedShort}
                                      </span>
                                    </div>
                                  );
                                })()}

                                {/* ปุ่มนำทาง Maps ด่วนบนการ์ด */}
                                {record.googleMapsLocation && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenGoogleMaps(record.googleMapsLocation);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold shadow-2xs cursor-pointer active:scale-95 transition-all"
                                    title="เปิด Google Maps เพื่อนำทางทันที"
                                  >
                                    <Navigation className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                    <span>นำทาง Maps</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Financial Summary Strip */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                            <div>
                              <div className="text-[10px] text-slate-400 font-medium">ค่างวดต่อเดือน:</div>
                              <div className="text-sm font-black text-sky-700">
                                {formatBaht(record.snapshot.monthlyInstallment)}
                                <span className="text-[9.5px] font-normal text-slate-500"> /งวด</span>
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-400 font-medium">ระยะเวลาผ่อน:</div>
                              <div className="font-bold text-slate-800 text-xs">
                                {record.term} งวด ({record.snapshot.rateDisplayText})
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-400 font-medium">เงินดาวน์:</div>
                              <div className="font-bold text-slate-800 text-xs">
                                {formatBaht(record.snapshot.downAmount)}
                                <span className="text-[10px] text-slate-500 font-normal">
                                  {' '}({record.snapshot.downPercent.toFixed(1)}%)
                                </span>
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-400 font-medium">ยอดจัดไฟแนนซ์:</div>
                              <div className="font-bold text-slate-800 text-xs">
                                {formatBaht(record.snapshot.financeAmount, true)}
                              </div>
                            </div>
                          </div>

                          {/* Expand/Collapse Toggle Strip (รูปที่ 3: แตะเพื่อเปิด/ปิด แผงสถานะและวันที่) */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              setExpandedStatusId((prev) => (prev === record.id ? null : record.id));
                            }}
                            className={`px-3 py-1.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border select-none ${
                              isStatusExpanded
                                ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-2xs'
                                : 'bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/80 text-slate-600 hover:text-slate-800'
                            }`}
                            title={isStatusExpanded ? 'คลิกเพื่อยุบซ่อน' : 'คลิกเพื่อเปิดเปลี่ยนสถานะและวันที่'}
                          >
                            <div className="flex items-center gap-1.5 text-[11px] font-bold">
                              <SlidersHorizontal className={`w-3.5 h-3.5 ${isStatusExpanded ? 'text-sky-600' : 'text-slate-500'}`} />
                              <span>{isStatusExpanded ? 'ซ่อนแผงปรับสถานะและวันที่' : 'แตะเพื่อเปลี่ยนสถานะเคส / วันที่'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                              <span>{isStatusExpanded ? 'ยุบ' : 'เปิด'}</span>
                              {isStatusExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-sky-600" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Status Selection & Vehicle Delivery Control Strip (รูปที่ 3: แสดงเมื่อกดเปิด และจะปิดอัตโนมัติเมื่อแตะกล่องข้อมูลอื่น) */}
                          {isStatusExpanded && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/95 border border-slate-200/80 space-y-2 text-xs animate-fade-in"
                            >
                              {/* Header label */}
                              <div className="text-[10px] sm:text-[10.5px] font-bold text-slate-500 text-center tracking-wide">
                                สถานะเคส:
                              </div>

                              {/* Status Switcher Buttons (Centered) */}
                              <div className="flex items-center justify-center w-full">
                                <div className="inline-flex items-center justify-center rounded-xl p-1 bg-slate-200/80 text-[10.5px] sm:text-xs font-bold gap-1 shadow-2xs max-w-full overflow-x-auto">
                                  {/* รอผล */}
                                  <button
                                    type="button"
                                    onClick={() => handleSetApprovalStatus(record.id, 'pending')}
                                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                      (!record.approvalStatus || record.approvalStatus === 'pending')
                                        ? 'bg-white text-sky-800 shadow-xs font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="เปลี่ยนเป็น รอผลพิจารณา"
                                  >
                                    <Clock className="w-3 h-3 text-sky-500 shrink-0" />
                                    <span>รอผล</span>
                                  </button>

                                  {/* อนุมัติ */}
                                  <button
                                    type="button"
                                    onClick={() => handleSetApprovalStatus(record.id, 'approved')}
                                    className={`px-3 sm:px-3.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                      record.approvalStatus === 'approved'
                                        ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                                        : 'text-slate-600 hover:text-emerald-700'
                                    }`}
                                    title="เปลี่ยนเป็น อนุมัติ"
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span>อนุมัติ</span>
                                  </button>

                                  {/* ไม่อนุมัติ */}
                                  <button
                                    type="button"
                                    onClick={() => handleSetApprovalStatus(record.id, 'rejected')}
                                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                      record.approvalStatus === 'rejected'
                                        ? 'bg-rose-600 text-white shadow-xs font-extrabold'
                                        : 'text-slate-600 hover:text-rose-700'
                                    }`}
                                    title="เปลี่ยนเป็น ไม่อนุมัติ"
                                  >
                                    <XCircle className="w-3 h-3 shrink-0" />
                                    <span>ไม่อนุมัติ</span>
                                  </button>

                                  {/* ยกเลิก */}
                                  <button
                                    type="button"
                                    onClick={() => handleSetApprovalStatus(record.id, 'cancelled')}
                                    className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                      record.approvalStatus === 'cancelled'
                                        ? 'bg-slate-700 text-white shadow-xs font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="เปลี่ยนเป็น ยกเลิก"
                                  >
                                    <Ban className="w-3 h-3 shrink-0" />
                                    <span>ยกเลิก</span>
                                  </button>
                                </div>
                              </div>

                              {/* If Approved: Vehicle Delivery Status & Dates (Centered) */}
                              {record.approvalStatus === 'approved' && (
                                <div className="space-y-2 pt-0.5 animate-fade-in w-full">
                                  {/* Centered Delivery Toggle Button */}
                                  <div className="flex items-center justify-center w-full">
                                    <div className="inline-flex items-center justify-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                                      <span className="text-[10.5px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
                                        <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        การรับรถ:
                                      </span>
                                      <div className="inline-flex rounded-lg p-0.5 bg-slate-100 text-[10.5px] font-bold gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleSetDeliveryStatus(record.id, 'pending_delivery')}
                                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                            (!record.deliveryStatus || record.deliveryStatus === 'pending_delivery')
                                              ? 'bg-amber-500 text-white shadow-xs font-extrabold'
                                              : 'text-slate-600 hover:text-amber-800'
                                          }`}
                                          title="ยังไม่ได้รับรถ (รอส่งมอบ)"
                                        >
                                          <Clock className="w-3 h-3 shrink-0" />
                                          <span>รอรับรถ</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleSetDeliveryStatus(record.id, 'delivered')}
                                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                                            record.deliveryStatus === 'delivered'
                                              ? 'bg-teal-600 text-white shadow-xs font-extrabold'
                                              : 'text-slate-600 hover:text-teal-800'
                                          }`}
                                          title="ลูกค้ารับมอบรถเรียบร้อยแล้ว"
                                        >
                                          <Check className="w-3 h-3 shrink-0" />
                                          <span>รับรถแล้ว</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Editable Date Pickers for วันอนุมัติ and วันรับรถ */}
                                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1.5 border-t border-slate-200/70 w-full">
                                    {/* วันอนุมัติ Picker */}
                                    <div className="inline-flex items-center justify-between gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto">
                                      <div className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 shrink-0">
                                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>วันอนุมัติ:</span>
                                      </div>
                                      <input
                                        type="date"
                                        value={record.approvalDate || toInputDateStr(record.createdAt)}
                                        onChange={(e) => handleSetDates(record.id, { approvalDate: e.target.value })}
                                        className="text-[11px] font-bold text-slate-800 bg-emerald-50/60 hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                        title="คลิกเพื่อเลือกวันอนุมัติ"
                                      />
                                    </div>

                                    {/* วันรับรถ / วันนัดรับรถ Picker */}
                                    <div className="inline-flex items-center justify-between gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs w-full sm:w-auto">
                                      <div className="flex items-center gap-1 text-[10.5px] font-bold text-teal-800 shrink-0">
                                        <Bike className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        <span>
                                          {record.deliveryStatus === 'delivered' ? 'วันรับรถ:' : 'วันนัดรับรถ:'}
                                        </span>
                                      </div>
                                      <input
                                        type="date"
                                        value={record.deliveryDate || (record.deliveryStatus === 'delivered' ? toInputDateStr(record.createdAt) : '')}
                                        onChange={(e) => handleSetDates(record.id, { deliveryDate: e.target.value })}
                                        className="text-[11px] font-bold text-slate-800 bg-teal-50/60 hover:bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                                        title={record.deliveryStatus === 'delivered' ? 'คลิกเพื่อเลือกวันรับรถ' : 'คลิกเพื่อระบุวันนัดรับรถ'}
                                      />
                                    </div>
                                  </div>

                                  {/* Payment Due Day & Google Maps Location (สำหรับลูกค้าอนุมัติ รับรถแล้ว) */}
                                  {record.deliveryStatus === 'delivered' && (
                                    <div className="pt-2.5 border-t border-slate-200/80 space-y-2.5 animate-fade-in w-full text-left">
                                      {/* กำหนดชำระงวดแรก (คำนวณอัตโนมัติจากวันรับรถ ทุกวันที่ 2 ของทุกเดือน) */}
                                      {(() => {
                                        const firstDue = calculateFirstPaymentDueDate(record.deliveryDate || record.createdAt);
                                        return (
                                          <div className="bg-gradient-to-r from-indigo-50/90 via-white to-sky-50/50 p-3 sm:p-3.5 rounded-2xl border border-indigo-200/90 space-y-2 shadow-2xs">
                                            <div className="flex items-center justify-between gap-1 flex-wrap">
                                              <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                                  <CalendarClock className="w-4 h-4" />
                                                </div>
                                                <div>
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-indigo-950">
                                                      กำหนดชำระงวดแรก
                                                    </span>
                                                    <span className="text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                      อัตโนมัติ
                                                    </span>
                                                  </div>
                                                  <p className="text-[10px] text-slate-500">
                                                    คำนวณอัตโนมัติจากวันรับรถ (ชำระทุกวันที่ 2 ของเดือนทุกราย)
                                                  </p>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Due Date & Cycle Info Display Box */}
                                            <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-2xs space-y-1.5">
                                              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                                <span className="text-[11px] font-bold text-slate-500">
                                                  วันครบกำหนดชำระงวดแรก:
                                                </span>
                                                <span className="text-sm sm:text-base font-black text-indigo-900 tracking-tight">
                                                  {firstDue.formattedLong}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[10.5px] text-slate-600 flex-wrap">
                                                <div className="flex items-center gap-1 text-slate-600">
                                                  <span className="font-bold text-indigo-800">{firstDue.cycleRangeText}</span>
                                                  <span className="text-slate-400">➔</span>
                                                  <span>ชำระงวดแรกวันที่ 2 ของรอบถัดไป</span>
                                                </div>
                                                <span className="text-[10px] text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                  งวดถัดไป: ทุกวันที่ 2 ของทุกเดือน
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      {/* ตำแหน่งที่อยู่ Google Maps & ปุ่มนำทาง */}
                                      <div className="bg-white p-3 rounded-xl border border-sky-200/90 space-y-2.5 shadow-2xs">
                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-900">
                                            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                                            <span>ตำแหน่งที่อยู่ปัจจุบัน (คัดลอกจาก Google Maps):</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handlePasteLocation(record.id)}
                                            className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer"
                                            title="วางลิงก์หรือที่อยู่จากคลิปบอร์ด"
                                          >
                                            <ClipboardCopy className="w-3 h-3" />
                                            <span>วางลิงก์/ที่อยู่</span>
                                          </button>
                                        </div>

                                        <div className="relative">
                                          <input
                                            type="text"
                                            value={record.googleMapsLocation || ''}
                                            onChange={(e) => handleSaveLocation(record.id, e.target.value)}
                                            placeholder="วางลิงก์ Google Maps, พิกัด GPS หรือที่อยู่ปัจจุบันที่คัดลอกมา..."
                                            className="w-full pl-3 pr-8 py-2 text-xs text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:bg-white focus:border-sky-400 font-medium"
                                          />
                                          {record.googleMapsLocation && (
                                            <button
                                              type="button"
                                              onClick={() => handleSaveLocation(record.id, '')}
                                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                                              title="ล้างข้อความ"
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>

                                        {/* Button to open and navigate via Google Maps */}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenGoogleMaps(record.googleMapsLocation)}
                                          disabled={!record.googleMapsLocation?.trim()}
                                          className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                                            record.googleMapsLocation?.trim()
                                              ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white active:scale-[0.98]'
                                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                          }`}
                                        >
                                          <Navigation className="w-4 h-4 shrink-0" />
                                          <span>
                                            {record.googleMapsLocation?.trim()
                                              ? 'เปิด Google Maps เพื่อนำทางไปยังที่อยู่นี้'
                                              : 'กรุณากรอกหรือวางที่อยู่ Google Maps เพื่อเปิดนำทาง'}
                                          </span>
                                          {record.googleMapsLocation?.trim() && (
                                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action Buttons Row */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-between gap-2 pt-1"
                          >
                            <div className="text-[10px] text-slate-500 truncate">
                              {record.officerName ? `ผู้เสนอ: ${record.officerName}` : 'บันทึกในอุปกรณ์'}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {deleteConfirmId === record.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-1 rounded-xl animate-fade-in shadow-2xs">
                                  <span className="text-[10px] text-rose-800 font-bold whitespace-nowrap">
                                    ลบเคสนี้?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      executeDelete(record.id);
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] cursor-pointer active:scale-95 shadow-2xs transition-all whitespace-nowrap"
                                  >
                                    ลบเลย
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(null);
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-[10.5px] cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                                  >
                                    ยกเลิก
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic('light');
                                    setDeleteConfirmId(record.id);
                                  }}
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="ลบเคสนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {onEditCase && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic('medium');
                                    onEditCase(record);
                                    onClose();
                                  }}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm ${
                                    isCurrentEditing
                                      ? 'bg-amber-600 text-white shadow-amber-600/30 ring-2 ring-amber-400'
                                      : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-amber-500/20'
                                  }`}
                                  title="ดึงเคสนี้กลับมาแก้ไขในโปรแกรมคำนวณ แล้วกดบันทึกการแก้ไขเพื่ออัปเดต"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>{isCurrentEditing ? 'กำลังแก้ไข' : 'แก้ไข'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('success');
                                  onLoadCase(record);
                                  onClose();
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-sky-500/25 active:scale-95 transition-all cursor-pointer"
                                title="นำตัวเลขในเคสนี้มาใช้งานเป็นเคสใหม่"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>นำมาใช้งาน</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500">
          <span>
            บันทึกลงในเครื่องผ่าน LocalStorage (ปลอดภัย เป็นส่วนตัว ไม่ส่งข้อมูลออกภายนอก)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold cursor-pointer transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
