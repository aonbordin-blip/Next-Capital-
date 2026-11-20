import React, { useMemo, useState, useEffect } from 'react';
import {
  Check,
  X,
  Search,
  Plus,
  Bike,
  User,
  Tag,
  Calendar,
  CalendarDays,
  LayoutGrid,
  Table2,
  Pencil,
  Copy,
  FolderArchive,
  RotateCcw,
  Phone,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Banknote,
  MapPin,
  ExternalLink,
  ClipboardCopy,
} from 'lucide-react';
import { SavedCaseRecord } from '../types';
import {
  getSavedCases,
  saveCaseRecord,
  updateCaseTrackingDetails,
  resolveBikeBrand,
  calculateFirstPaymentDueDate,
  getNineInstallmentSchedule,
  formatThaiMonthYearLabel,
  getCustomerDisplayName,
  isCaseDeliveredAndApproved,
  getLocalTodayDateStr,
  getGoogleMapsNavigationUrl,
  InstallmentDueSlot,
} from '../utils/savedCasesStorage';
import { findModelByCode, getAllMotorcycleModels } from '../data/motorcycleModels';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import { CardModalOverlay } from './CardModalOverlay';
import { MarqueeText } from './MarqueeText';

interface Props {
  refreshTrigger: number;
  officerName: string;
  officerCode: string;
  officerDisplay: string;
  onDataChanged: () => void;
  onOpenSavedCases: () => void;
  onNotify: (msg: string) => void;
}

type ViewStyle = 'cards' | 'table';

const BRAND_SUGGESTIONS = ['HONDA', 'YAMAHA', 'VESPA', 'LAMBRETTA', 'SUZUKI', 'GPX', 'อื่นๆ'];

const THAI_MONTH_SHORTS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

function getBrandBadgeStyle(brand: string): string {
  const upper = brand.toUpperCase();
  if (upper.includes('HONDA')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800/70';
  }
  if (upper.includes('YAMAHA')) {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800/70';
  }
  if (upper.includes('VESPA') || upper.includes('LAMBRETTA')) {
    return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-800/70';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
}

function parseDateSafe(input?: string | number): Date | null {
  if (!input) return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(input);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatThaiShortDate(input?: string | number): string {
  const d = parseDateSafe(input);
  if (!d) return '-';
  const day = d.getDate();
  const monthShort = THAI_MONTH_SHORTS[d.getMonth()] || '';
  const thaiShortYear = ((d.getFullYear() + 543) % 100).toString().padStart(2, '0');
  return `${day} ${monthShort} ${thaiShortYear}`;
}

function toLocalDateInputValue(input?: string | number): string {
  const d = parseDateSafe(input);
  if (!d) return getLocalTodayDateStr();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface EnrichedCustomerItem {
  record: SavedCaseRecord;
  customerName: string;
  brand: string;
  modelName: string;
  modelCode: string;
  deliveryDateInput: string | number;
  deliveryDateShort: string;
  deliveryTimestamp: number;
  firstDueMonthKey: string;
  firstDueLabelShort: string;
  firstDueLabelLong: string;
  cycleRangeText: string;
  schedule: InstallmentDueSlot[];
  mapsUrl: string;
}

interface FirstDueMonthGroup {
  monthKey: string;
  monthShort: string;
  monthLong: string;
  firstDueLabelShort: string;
  firstDueLabelLong: string;
  cycleRangeText: string;
  items: EnrichedCustomerItem[];
  totalMonthlyAmount: number;
}

export const InstallmentTrackingPage: React.FC<Props> = ({
  refreshTrigger,
  officerName,
  officerCode,
  onDataChanged,
  onOpenSavedCases,
  onNotify,
}) => {
  const [cases, setCases] = useState<SavedCaseRecord[]>(() => getSavedCases());
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const [selectedFirstDueMonth, setSelectedFirstDueMonth] = useState<string>('ALL');
  const [viewStyle, setViewStyle] = useState<ViewStyle>('cards');
  const [copiedCaseId, setCopiedCaseId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Record<string, boolean>>({});

  // Add / Edit Customer Info Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formBrand, setFormBrand] = useState('HONDA');
  const [formModelName, setFormModelName] = useState('');
  const [formModelCode, setFormModelCode] = useState('');
  const [formDeliveryDate, setFormDeliveryDate] = useState(() => getLocalTodayDateStr());
  const [formDueDay, setFormDueDay] = useState('2');
  const [formMonthlyInstallment, setFormMonthlyInstallment] = useState('');
  const [formGoogleMapsLocation, setFormGoogleMapsLocation] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setCases(getSavedCases());
  }, [refreshTrigger]);

  useEffect(() => {
    const syncCases = () => setCases(getSavedCases());
    window.addEventListener('focus', syncCases);
    window.addEventListener('storage', syncCases);
    window.addEventListener('ncap-cases-synced', syncCases);
    return () => {
      window.removeEventListener('focus', syncCases);
      window.removeEventListener('storage', syncCases);
      window.removeEventListener('ncap-cases-synced', syncCases);
    };
  }, []);

  const allDbModels = useMemo(() => getAllMotorcycleModels(), []);

  // Split saved cases strictly: ONLY approved + delivered cases have a confirmed กำหนดชำระงวดแรก
  const { eligibleCases, pendingDeliveryCount, otherStatusCount } = useMemo(() => {
    const eligible: SavedCaseRecord[] = [];
    let pendingDel = 0;
    let others = 0;

    cases.forEach((c) => {
      if (isCaseDeliveredAndApproved(c)) {
        eligible.push(c);
      } else if (c.approvalStatus === 'approved') {
        pendingDel++;
      } else {
        others++;
      }
    });

    return {
      eligibleCases: eligible,
      pendingDeliveryCount: pendingDel,
      otherStatusCount: others,
    };
  }, [cases]);

  // Enrich each eligible customer using the exact same deliveryDate || createdAt rule as SavedCasesModal
  const enrichedList: EnrichedCustomerItem[] = useMemo(() => {
    return eligibleCases
      .map((record) => {
        const customerName = getCustomerDisplayName(record);
        const brand = resolveBikeBrand(record);
        const modelName =
          record.bikeModelName ||
          (record.bikeModelCode ? `รุ่นรหัส ${record.bikeModelCode}` : 'รถจักรยานยนต์');
        const modelCode = record.bikeModelCode || '-';
        const deliverySource = record.deliveryDate || record.createdAt;
        const parsedDelivery = parseDateSafe(deliverySource);
        const deliveryTimestamp = parsedDelivery ? parsedDelivery.getTime() : record.createdAt;
        const deliveryDateShort = formatThaiShortDate(deliverySource);

        const firstDue = calculateFirstPaymentDueDate(deliverySource);
        const schedule = getNineInstallmentSchedule(record);
        const firstSlot = schedule[0];
        const firstDueMonthKey = firstSlot?.monthKey || `${firstDue.year}-${firstDue.month.toString().padStart(2, '0')}`;
        const firstDueLabelShort = firstSlot?.formattedShort || `2 ${firstDue.monthShort} ${firstDue.thaiShortYear}`;
        const firstDueLabelLong = `${firstSlot?.dueDate.getDate() || 2} ${firstDue.monthName} ${firstDue.thaiYear}`;

        return {
          record,
          customerName,
          brand,
          modelName,
          modelCode,
          deliveryDateInput: deliverySource,
          deliveryDateShort,
          deliveryTimestamp,
          firstDueMonthKey,
          firstDueLabelShort,
          firstDueLabelLong,
          cycleRangeText: firstDue.cycleRangeText,
          schedule,
          mapsUrl: getGoogleMapsNavigationUrl(record.googleMapsLocation),
        };
      })
      .sort((a, b) => {
        if (a.firstDueMonthKey !== b.firstDueMonthKey) {
          return a.firstDueMonthKey.localeCompare(b.firstDueMonthKey);
        }
        if (a.deliveryTimestamp !== b.deliveryTimestamp) {
          return a.deliveryTimestamp - b.deliveryTimestamp;
        }
        return a.customerName.localeCompare(b.customerName, 'th');
      });
  }, [eligibleCases]);

  // Build available First Payment Due Month groups (unfiltered except all eligible) for month selector
  const monthOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        short: string;
        long: string;
        firstDueLabelShort: string;
        cycleRangeText: string;
        count: number;
      }
    >();

    enrichedList.forEach((item) => {
      if (!map.has(item.firstDueMonthKey)) {
        const labels = formatThaiMonthYearLabel(item.firstDueMonthKey);
        map.set(item.firstDueMonthKey, {
          monthKey: item.firstDueMonthKey,
          short: labels.short,
          long: labels.long,
          firstDueLabelShort: item.firstDueLabelShort,
          cycleRangeText: item.cycleRangeText,
          count: 0,
        });
      }
      map.get(item.firstDueMonthKey)!.count += 1;
    });

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [enrichedList]);

  // Keep selectedFirstDueMonth valid if data changes
  useEffect(() => {
    if (
      selectedFirstDueMonth !== 'ALL' &&
      !monthOptions.some((m) => m.monthKey === selectedFirstDueMonth)
    ) {
      setSelectedFirstDueMonth('ALL');
    }
  }, [monthOptions, selectedFirstDueMonth]);

  const activeMonthMeta = useMemo(() => {
    if (selectedFirstDueMonth === 'ALL') return null;
    return monthOptions.find((m) => m.monthKey === selectedFirstDueMonth) || null;
  }, [monthOptions, selectedFirstDueMonth]);

  // Available brands dynamically extracted
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    enrichedList.forEach((item) => {
      if (item.brand && item.brand !== '-') set.add(item.brand);
    });
    return ['ALL', ...Array.from(set)];
  }, [enrichedList]);

  // Apply First Payment Due Month + brand + search filters
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedList.filter((item) => {
      if (selectedFirstDueMonth !== 'ALL' && item.firstDueMonthKey !== selectedFirstDueMonth) {
        return false;
      }
      if (brandFilter !== 'ALL' && item.brand !== brandFilter) {
        return false;
      }
      if (q) {
        const haystack = [
          item.customerName,
          item.record.customerPhone,
          item.brand,
          item.modelName,
          item.modelCode,
          item.deliveryDateShort,
          item.firstDueLabelShort,
          item.firstDueLabelLong,
          item.cycleRangeText,
          item.record.dealerName,
          item.record.googleMapsLocation,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [enrichedList, selectedFirstDueMonth, brandFilter, searchQuery]);

  // Group filtered customers strictly by First Payment Due Month
  const groupedByFirstDue: FirstDueMonthGroup[] = useMemo(() => {
    const map = new Map<string, FirstDueMonthGroup>();

    filteredList.forEach((item) => {
      if (!map.has(item.firstDueMonthKey)) {
        const labels = formatThaiMonthYearLabel(item.firstDueMonthKey);
        map.set(item.firstDueMonthKey, {
          monthKey: item.firstDueMonthKey,
          monthShort: labels.short,
          monthLong: labels.long,
          firstDueLabelShort: item.firstDueLabelShort,
          firstDueLabelLong: item.firstDueLabelLong,
          cycleRangeText: item.cycleRangeText,
          items: [],
          totalMonthlyAmount: 0,
        });
      }
      const group = map.get(item.firstDueMonthKey)!;
      group.items.push(item);
      group.totalMonthlyAmount += item.record.snapshot?.monthlyInstallment || 0;
    });

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredList]);

  // Summary KPIs (clean metrics without ✓ / ✗ counters)
  const summaryStats = useMemo(() => {
    const totalMonthlySum = filteredList.reduce(
      (sum, item) => sum + (item.record.snapshot?.monthlyInstallment || 0),
      0
    );
    return {
      customerCount: filteredList.length,
      groupCount: groupedByFirstDue.length,
      totalMonthlySum,
      pendingCount: pendingDeliveryCount,
    };
  }, [filteredList, groupedByFirstDue, pendingDeliveryCount]);

  // Live preview inside Add/Edit modal for automatic first due date calculation
  const formDuePreview = useMemo(() => {
    const info = calculateFirstPaymentDueDate(formDeliveryDate);
    const parsedDay = Math.min(31, Math.max(1, parseInt(formDueDay, 10) || 2));
    return {
      day: parsedDay,
      monthName: info.monthName,
      thaiYear: info.thaiYear,
      cycleRangeText: info.cycleRangeText,
    };
  }, [formDeliveryDate, formDueDay]);

  const handleSelectFirstDueMonth = (nextMonth: string) => {
    triggerHaptic('selection');
    setSelectedFirstDueMonth(nextMonth);
  };

  const handleStepFirstDueMonth = (delta: -1 | 1) => {
    if (monthOptions.length === 0) return;
    triggerHaptic('selection');
    if (selectedFirstDueMonth === 'ALL') {
      setSelectedFirstDueMonth(
        delta > 0 ? monthOptions[0].monthKey : monthOptions[monthOptions.length - 1].monthKey
      );
      return;
    }
    const idx = monthOptions.findIndex((m) => m.monthKey === selectedFirstDueMonth);
    if (idx < 0) {
      setSelectedFirstDueMonth('ALL');
      return;
    }
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= monthOptions.length) {
      setSelectedFirstDueMonth('ALL');
    } else {
      setSelectedFirstDueMonth(monthOptions[nextIdx].monthKey);
    }
  };

  const handleOpenAddModal = () => {
    triggerHaptic('light');
    setEditingRecordId(null);
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormBrand('HONDA');
    setFormModelName('');
    setFormModelCode('');
    setFormDeliveryDate(getLocalTodayDateStr());
    setFormDueDay('2');
    setFormMonthlyInstallment('');
    setFormGoogleMapsLocation('');
    setFormError('');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: EnrichedCustomerItem) => {
    triggerHaptic('light');
    const r = item.record;
    setEditingRecordId(r.id);
    setFormCustomerName(item.customerName);
    setFormCustomerPhone(r.customerPhone || '');
    setFormBrand(item.brand !== '-' ? item.brand : 'HONDA');
    setFormModelName(r.bikeModelName || '');
    setFormModelCode(r.bikeModelCode || '');
    setFormDeliveryDate(toLocalDateInputValue(r.deliveryDate || r.createdAt));
    setFormDueDay(String(r.paymentDueDay || 2));
    setFormMonthlyInstallment(
      r.snapshot?.monthlyInstallment ? String(r.snapshot.monthlyInstallment) : ''
    );
    setFormGoogleMapsLocation(r.googleMapsLocation || '');
    setFormError('');
    setIsFormModalOpen(true);
  };

  const handlePasteFormLocation = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          triggerHaptic('success');
          setFormGoogleMapsLocation(text.trim());
          onNotify('✓ วางที่อยู่/ลิงก์ตำแหน่งเรียบร้อยแล้ว');
          return;
        }
      }
    } catch {
      // Clipboard API might require permission
    }
    onNotify('💡 แตะค้างที่ช่องแล้วเลือก "วาง" (Paste) ได้เลย');
  };

  const handleFormModelCodeChange = (rawVal: string) => {
    const upper = rawVal.toUpperCase();
    setFormModelCode(upper);
    if (upper.trim().length >= 3) {
      const matched = findModelByCode(upper);
      if (matched) {
        if (matched.brand) setFormBrand(matched.brand.toUpperCase());
        if (!formModelName.trim() || allDbModels.some((m) => m.name === formModelName)) {
          setFormModelName(matched.name);
        }
      }
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formCustomerName.trim();
    if (!cleanName) {
      setFormError('กรุณากรอกชื่อลูกค้า');
      return;
    }
    const cleanBrand = formBrand.trim().toUpperCase() || 'HONDA';
    const cleanModel = formModelName.trim();
    const cleanCode = formModelCode.trim().toUpperCase();
    const cleanLocation = formGoogleMapsLocation.trim();
    const parsedDueDay = Math.min(31, Math.max(1, parseInt(formDueDay, 10) || 2));
    const parsedInstallment = parseFloat(formMonthlyInstallment.replace(/[^0-9.]/g, '')) || 0;

    if (editingRecordId) {
      const updated = updateCaseTrackingDetails(editingRecordId, {
        customerName: cleanName,
        customerPhone: formCustomerPhone,
        bikeBrand: cleanBrand,
        bikeModelName: cleanModel || undefined,
        bikeModelCode: cleanCode || undefined,
        deliveryDate: formDeliveryDate || undefined,
        paymentDueDay: parsedDueDay,
        googleMapsLocation: cleanLocation,
        ...(parsedInstallment > 0 ? { monthlyInstallment: parsedInstallment } : {}),
      });
      setCases(updated);
      const editedItem = updated.find((c) => c.id === editingRecordId);
      if (editedItem && selectedFirstDueMonth !== 'ALL') {
        const firstSlot = getNineInstallmentSchedule(editedItem)[0];
        if (firstSlot) {
          setSelectedFirstDueMonth(firstSlot.monthKey);
        }
      }
      onDataChanged();
      triggerHaptic('success');
      onNotify(`✓ อัปเดตข้อมูล "${cleanName}" เรียบร้อยแล้ว`);
    } else {
      const matchedModel = cleanCode ? findModelByCode(cleanCode) : undefined;
      const vehiclePrice = matchedModel?.price || 65000;
      const monthlyInst = parsedInstallment > 0 ? parsedInstallment : 2500;
      const created = saveCaseRecord({
        caseTitle: cleanName,
        officerName,
        officerCode,
        customerName: cleanName,
        customerPhone: formCustomerPhone.trim() || undefined,
        proposalKey: 'small_bike',
        vehiclePrice,
        bikeBrand: cleanBrand,
        bikeModelName:
          cleanModel ||
          matchedModel?.name ||
          (cleanCode ? `รุ่นรหัส ${cleanCode}` : 'รถจักรยานยนต์'),
        bikeModelCode: cleanCode || undefined,
        downMode: 'amount',
        downValue: 0,
        term: 36,
        includeDeliveryFees: false,
        registrationFee: 0,
        theftInsuranceFee: 0,
        isCustomRateEnabled: false,
        customRateInput: '',
        customRateType: 'monthly',
        enforceEirCap: false,
        insurancePlan: 'none',
        insuranceYears: 1,
        approvalStatus: 'approved',
        deliveryStatus: 'delivered',
        approvalDate: formDeliveryDate,
        deliveryDate: formDeliveryDate,
        paymentDueDay: parsedDueDay,
        googleMapsLocation: cleanLocation || undefined,
        snapshot: {
          monthlyInstallment: monthlyInst,
          financeAmount: vehiclePrice,
          downAmount: 0,
          downPercent: 0,
          totalInterest: 0,
          totalWithVat: monthlyInst * 36,
          effectiveMonthlyRate: 0.015,
          eirAnnualPercent: 22.9,
          proposalCode: 'TRACKING',
          proposalName: 'กำหนดชำระงวด 1-9',
          rateDisplayText: '-',
        },
      });
      setCases(getSavedCases());
      if (selectedFirstDueMonth !== 'ALL') {
        const firstSlot = getNineInstallmentSchedule(created)[0];
        if (firstSlot) {
          setSelectedFirstDueMonth(firstSlot.monthKey);
        }
      }
      onDataChanged();
      triggerHaptic('success');
      onNotify(`✓ เพิ่มรายชื่อ "${cleanName}" เข้ารายการกำหนดชำระงวดแรกแล้ว`);
    }
    setIsFormModalOpen(false);
  };

  // Copy schedule 1-9 for single customer (no ✓/✗ checkmarks)
  const handleCopyCustomerSummary = async (item: EnrichedCustomerItem) => {
    triggerHaptic('selection');
    const lines: string[] = [
      `📅 กำหนดชำระค่างวด (งวดที่ 1 - 9)`,
      `👤 ลูกค้า: ${item.customerName}${item.record.customerPhone ? ` (${item.record.customerPhone})` : ''}`,
      `🏍️ ยี่ห้อ: ${item.brand} | รุ่น: ${item.modelName}`,
      `🏷️ รหัสรถ: ${item.modelCode}`,
      `📦 วันรับรถ: ${item.deliveryDateShort} (${item.cycleRangeText})`,
      `⭐ กำหนดชำระงวดแรก: ${item.firstDueLabelLong}`,
      item.record.snapshot?.monthlyInstallment
        ? `💰 ค่างวด: ${formatBaht(item.record.snapshot.monthlyInstallment)} บ./เดือน`
        : '',
      `━━━━━━━━━━━━━━━`,
      ...item.schedule.map(
        (slot) => `งวดที่ ${slot.installmentNo} : ${slot.formattedShort}`
      ),
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedCaseId(item.record.id);
      setTimeout(() => setCopiedCaseId(null), 2000);
      onNotify('✓ คัดลอกกำหนดชำระงวด 1-9 ของลูกค้าแล้ว');
    } catch {
      onNotify('ไม่สามารถคัดลอกข้อความได้');
    }
  };

  // Copy grouped list by First Payment Due Month for LINE
  const handleCopyAllSummary = async () => {
    if (groupedByFirstDue.length === 0) return;
    triggerHaptic('selection');

    const lines: string[] = [
      selectedFirstDueMonth !== 'ALL' && activeMonthMeta
        ? `📅 รายชื่อลูกค้ากำหนดชำระงวดแรก เดือน ${activeMonthMeta.long} (${filteredList.length} ราย)`
        : `📅 รายชื่อลูกค้าจัดกลุ่มตามกำหนดชำระงวดแรก (รวม ${filteredList.length} ราย)`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ];

    groupedByFirstDue.forEach((group) => {
      lines.push(
        `\n🗓️ งวดแรก: ${group.firstDueLabelLong} (${group.items.length} ราย • ${group.cycleRangeText})`
      );
      group.items.forEach((item, idx) => {
        const instStr = item.record.snapshot?.monthlyInstallment
          ? ` | ${formatBaht(item.record.snapshot.monthlyInstallment)} บ./ด.`
          : '';
        lines.push(
          `${idx + 1}. ${item.customerName}${instStr}\n   ${item.brand} ${item.modelName} | รหัส: ${item.modelCode} | รับรถ ${item.deliveryDateShort}\n   งวด 1-9: ${item.schedule[0]?.formattedShort} → ${item.schedule[8]?.formattedShort}`
        );
      });
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      onNotify(
        selectedFirstDueMonth !== 'ALL' && activeMonthMeta
          ? `✓ คัดลอกกลุ่มงวดแรก ${activeMonthMeta.short} แล้ว`
          : '✓ คัดลอกรายชื่อแบ่งตามกำหนดงวดแรกทั้งหมดแล้ว'
      );
    } catch {
      onNotify('ไม่สามารถคัดลอกข้อความได้');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-3.5 animate-tab-fade">
      {/* Step Header Badge */}
      <div className="flex items-center justify-between px-1 text-xs gap-2">
        <span className="font-extrabold text-sky-950 dark:text-slate-100 flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs shrink-0">
            5
          </span>
          <MarqueeText className="font-extrabold text-sky-950 dark:text-slate-100">
            รายชื่อลูกค้าจัดกลุ่มตามกำหนดชำระเดือนแรก (งวด 1 - 9)
          </MarqueeText>
        </span>
        <span className="text-[10px] text-sky-800 bg-sky-50 dark:text-sky-200 dark:bg-sky-950/70 px-2.5 py-0.5 rounded-full font-bold border border-sky-200 dark:border-sky-800/70 shrink-0 whitespace-nowrap">
          กลุ่มงวดแรก
        </span>
      </div>

      {/* ==============================================================
          FIRST PAYMENT DUE MONTH SELECTOR PANEL
          จัดกลุ่มตาม "กำหนดชำระงวดแรก" (เฉพาะเคสที่อนุมัติและรับรถแล้ว)
          ============================================================== */}
      <div className="glass-card-primary rounded-2xl p-3 sm:p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-xl bg-sky-100/90 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 flex items-center justify-center shrink-0 shadow-2xs">
              <CalendarDays className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs sm:text-[13px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight truncate">
              เลือกกลุ่มเดือนกำหนดชำระงวดแรก
            </h4>
          </div>

          <button
            type="button"
            onClick={() => handleSelectFirstDueMonth('ALL')}
            className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-all cursor-pointer shrink-0 whitespace-nowrap tabular-nums ${
              selectedFirstDueMonth === 'ALL'
                ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white border-sky-500 shadow-2xs'
                : 'bg-white/75 hover:bg-white text-sky-800 border-white/90 dark:bg-slate-800/90 dark:hover:bg-slate-700 dark:text-sky-200 dark:border-slate-700 shadow-2xs'
            }`}
          >
            ทั้งหมด ({enrichedList.length})
          </button>
        </div>

        {/* Stepper Prev / Select Cohort / Next */}
        {monthOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepFirstDueMonth(-1)}
              className="w-10 h-10 rounded-xl bg-white/75 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 backdrop-blur-sm border border-white/90 dark:border-slate-700 text-slate-700 hover:text-sky-700 dark:text-slate-200 dark:hover:text-sky-300 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
              title="กลุ่มเดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex-1 min-w-0">
              <select
                aria-label="เลือกกลุ่มเดือนกำหนดชำระงวดแรก"
                value={selectedFirstDueMonth}
                onChange={(e) => handleSelectFirstDueMonth(e.target.value)}
                className="w-full h-10 appearance-none rounded-xl bg-white/75 dark:bg-slate-900/90 backdrop-blur-md border border-white/95 dark:border-slate-700 focus:border-sky-500 pl-3 pr-8 text-xs sm:text-sm font-bold text-sky-950 dark:text-slate-100 dark:[color-scheme:dark] text-center truncate outline-none cursor-pointer shadow-2xs transition-colors"
              >
                <option value="ALL">
                  ทุกกลุ่มเดือนงวดแรก ({enrichedList.length} ราย)
                </option>
                {monthOptions.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    งวดแรก {m.firstDueLabelShort} ({m.count} ราย)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-sky-600 dark:text-sky-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => handleStepFirstDueMonth(1)}
              className="w-10 h-10 rounded-xl bg-white/75 hover:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-700 backdrop-blur-sm border border-white/90 dark:border-slate-700 text-slate-700 hover:text-sky-700 dark:text-slate-200 dark:hover:text-sky-300 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
              title="กลุ่มเดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Cohort Month Pill Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => handleSelectFirstDueMonth('ALL')}
            className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold border whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 tabular-nums ${
              selectedFirstDueMonth === 'ALL'
                ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white border-sky-500 shadow-xs'
                : 'bg-white/55 hover:bg-white/80 text-slate-700 border-white/85 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            <span>ทุกกลุ่มเดือน</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                selectedFirstDueMonth === 'ALL'
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {enrichedList.length}
            </span>
          </button>

          {monthOptions.map((m) => {
            const isSelected = selectedFirstDueMonth === m.monthKey;
            return (
              <button
                key={m.monthKey}
                type="button"
                onClick={() => handleSelectFirstDueMonth(m.monthKey)}
                className={`px-2.5 py-1.5 rounded-xl text-[10.5px] font-bold border whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 tabular-nums ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white border-sky-600 shadow-sm shadow-sky-500/20'
                    : 'bg-white hover:bg-sky-50 text-slate-800 border-sky-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
                }`}
              >
                <span>งวดแรก {m.short}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/70 dark:text-sky-200'
                  }`}
                >
                  {m.count} ราย
                </span>
              </button>
            );
          })}
        </div>

        {/* Verification Info Note */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-sky-100 dark:border-slate-700/70 text-[10px] text-slate-600 dark:text-slate-300 flex-wrap">
          <span className="flex items-center gap-1 min-w-0">
            <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>
              แสดงเฉพาะเคสที่ <strong className="dark:text-slate-100">อนุมัติและรับรถแล้ว</strong> (รับรถ 1-10 จ่าย 2 เดือนถัดไป • รับรถ 11+ จ่าย 2 อีก 2 เดือนถัดไป)
            </span>
          </span>
          {(pendingDeliveryCount > 0 || otherStatusCount > 0) && (
            <button
              type="button"
              onClick={onOpenSavedCases}
              className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 dark:text-sky-300 dark:hover:text-sky-200 dark:bg-sky-950/70 dark:hover:bg-sky-900/80 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800/70 cursor-pointer shrink-0 whitespace-nowrap"
            >
              เคสอื่นยังไม่รับรถ {pendingDeliveryCount + otherStatusCount} ราย →
            </button>
          )}
        </div>
      </div>

      {/* Clean KPI Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="glass-card-primary rounded-2xl p-2.5 sm:p-3 border border-sky-200/80 dark:border-sky-800/60 min-w-0">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 min-w-0">
            <User className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
            <MarqueeText>
              {activeMonthMeta ? `ลูกค้างวดแรก (${activeMonthMeta.short})` : 'ลูกค้าที่มีกำหนดงวดแรก'}
            </MarqueeText>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
              {summaryStats.customerCount}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">ราย</span>
          </div>
        </div>

        <div className="glass-card-primary rounded-2xl p-2.5 sm:p-3 border border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-800/60 dark:bg-indigo-950/35 min-w-0">
          <div className="text-[10px] font-semibold text-indigo-800 dark:text-indigo-200 flex items-center gap-1 min-w-0">
            <CalendarDays className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <MarqueeText>จำนวนกลุ่มเดือนงวดแรก</MarqueeText>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
              {summaryStats.groupCount}
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">เดือน</span>
          </div>
        </div>

        <div className="glass-card-primary rounded-2xl p-2.5 sm:p-3 border border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/35 min-w-0">
          <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-1 min-w-0">
            <Banknote className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <MarqueeText>รวมยอดค่างวด/เดือน</MarqueeText>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 truncate tabular-nums">
              {formatBaht(summaryStats.totalMonthlySum)}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">บ.</span>
          </div>
        </div>

        <div className="glass-card-primary rounded-2xl p-2.5 sm:p-3 border border-amber-200/80 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/35 min-w-0">
          <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1 min-w-0">
            <Bike className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <MarqueeText>อนุมัติ/รอรับรถ</MarqueeText>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 tabular-nums">
              {summaryStats.pendingCount}
            </span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">ราย</span>
          </div>
        </div>
      </div>

      {/* Search, Brand Filter & View Switcher Toolbar */}
      <div className="glass-card-primary rounded-2xl p-3 space-y-2.5 border border-sky-200/80 dark:border-slate-700/80">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า, ยี่ห้อ, รุ่นรถ, รหัสรถ, วันงวดแรก..."
              className="w-full glass-input-field rounded-xl pl-8 pr-7 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-semibold outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 dark:hover:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-sky-500/20 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มลูกค้า</span>
          </button>
        </div>

        {/* Brand Filter Chips + Copy & View Switcher */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 flex-1">
            {availableBrands.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setBrandFilter(b);
                }}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  brandFilter === b
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-white/80 hover:bg-white text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {b === 'ALL' ? 'ทุกยี่ห้อ' : b}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {filteredList.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAllSummary}
                className={`px-2.5 py-1 rounded-xl border text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                  copiedAll
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
                }`}
                title="คัดลอกสรุปกลุ่มงวดแรกส่ง LINE"
              >
                {copiedAll ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                )}
                <span>{copiedAll ? 'คัดลอกแล้ว' : 'คัดลอกสรุป'}</span>
              </button>
            )}

            <div className="flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setViewStyle('cards');
                }}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewStyle === 'cards'
                    ? 'bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
                title="มุมมองการ์ดแบ่งกลุ่ม"
              >
                <LayoutGrid className="w-3 h-3" />
                <span>การ์ด</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setViewStyle('table');
                }}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  viewStyle === 'table'
                    ? 'bg-white text-sky-700 dark:bg-slate-900 dark:text-sky-300 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
                title="มุมมองตารางแบ่งกลุ่ม"
              >
                <Table2 className="w-3 h-3" />
                <span>ตาราง</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {groupedByFirstDue.length === 0 ? (
        <div className="glass-card-primary rounded-2xl p-6 text-center space-y-3 border border-sky-200/80 dark:border-slate-700/80">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950/80 dark:text-sky-300 flex items-center justify-center mx-auto shadow-2xs">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              {cases.length === 0
                ? 'ยังไม่มีรายชื่อลูกค้าที่บันทึกไว้'
                : eligibleCases.length === 0
                ? `มีเคสที่บันทึก ${cases.length} ราย แต่ยังไม่มีเคสที่รับรถแล้ว`
                : 'ไม่พบรายชื่อลูกค้าที่ตรงกับตัวกรอง'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {cases.length === 0
                ? 'กดเพิ่มลูกค้า หรือบันทึกเคสแล้วอัปเดตสถานะ "อนุมัติและรับรถแล้ว" ระบบจะจัดกลุ่มตามกำหนดชำระงวดแรกให้อัตโนมัติ'
                : eligibleCases.length === 0
                ? 'เข้าไปที่ "เคสที่บันทึก" เพื่อเปลี่ยนสถานะเคสเป็น อนุมัติ + รับรถแล้ว และระบุวันรับรถเพื่อคำนวณงวดแรก'
                : 'ลองล้างตัวกรองหรือเลือกกลุ่มเดือนงวดแรกอื่น'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มลูกค้า (รับรถแล้ว)</span>
            </button>
            {(searchQuery || brandFilter !== 'ALL' || selectedFirstDueMonth !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setBrandFilter('ALL');
                  setSelectedFirstDueMonth('ALL');
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSavedCases}
              className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center gap-1.5 border border-sky-200 dark:bg-sky-950/70 dark:hover:bg-sky-900/80 dark:text-sky-200 dark:border-sky-800/70 cursor-pointer"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>เปิดเคสที่บันทึก</span>
            </button>
          </div>
        </div>
      ) : viewStyle === 'cards' ? (
        /* ==============================================================
           GROUPED CARD VIEW: แบ่งกลุ่มตามกำหนดชำระงวดแรก (ไม่มีช่องติ๊ก ✓/✗)
           ============================================================== */
        <div className="space-y-4">
          {groupedByFirstDue.map((group) => (
            <section key={group.monthKey} className="space-y-2.5">
              {/* Group Section Header */}
              <div className="rounded-2xl bg-gradient-to-r from-sky-600 via-sky-700 to-cyan-600 text-white px-3.5 py-2.5 shadow-sm border border-white/30 dark:border-sky-400/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <MarqueeText className="text-xs sm:text-sm font-black tracking-tight">
                      กำหนดชำระงวดแรก: {group.firstDueLabelLong}
                    </MarqueeText>
                    <MarqueeText className="text-[10px] text-sky-100 font-medium">
                      {group.cycleRangeText} • ยอดค่างวดรวม {formatBaht(group.totalMonthlyAmount)} บ./ด.
                    </MarqueeText>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white text-sky-800 dark:bg-slate-900 dark:text-sky-200 font-black text-[11px] shrink-0 shadow-2xs whitespace-nowrap tabular-nums">
                  {group.items.length} ราย
                </span>
              </div>

              {/* Customers in this First-Due Cohort */}
              <div className="space-y-2.5">
                {group.items.map((item, idx) => {
                  const {
                    record,
                    customerName,
                    brand,
                    modelName,
                    modelCode,
                    deliveryDateShort,
                    firstDueLabelShort,
                    cycleRangeText,
                    schedule,
                  } = item;
                  const isCopied = copiedCaseId === record.id;
                  const isExpanded = Boolean(expandedScheduleIds[record.id]);
                  const ninthSlot = schedule[8];

                  return (
                    <div
                      key={record.id}
                      className="glass-card-primary rounded-2xl p-3 sm:p-3.5 border border-sky-200/80 dark:border-slate-700/80 shadow-xs space-y-2.5 relative overflow-hidden"
                    >
                      {/* Customer Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white font-black text-[11px] flex items-center justify-center shrink-0 shadow-2xs mt-0.5 tabular-nums">
                            {idx + 1}
                          </span>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MarqueeText fitContent className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                                {customerName}
                              </MarqueeText>
                              <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-full bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-800/70 shrink-0 whitespace-nowrap">
                                รับรถ {deliveryDateShort}
                              </span>
                            </div>

                            {/* Brand & Model */}
                            <div className="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                              <span
                                className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-md border shrink-0 ${getBrandBadgeStyle(
                                  brand
                                )}`}
                              >
                                ยี่ห้อ: {brand}
                              </span>
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <Bike className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                <MarqueeText fitContent className="font-bold text-slate-800 dark:text-slate-200">
                                  {modelName}
                                </MarqueeText>
                              </div>
                            </div>

                            {/* Model Code, Phone, Monthly Amount */}
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                              <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-900 bg-blue-50/90 border border-blue-200/80 dark:text-blue-200 dark:bg-blue-950/70 dark:border-blue-800/70 px-2 py-0.5 rounded-md max-w-full">
                                <Tag className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <MarqueeText fitContent>รหัสรถ: {modelCode}</MarqueeText>
                              </span>

                              {record.customerPhone && (
                                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                                  <Phone className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                  {record.customerPhone}
                                </span>
                              )}

                              {record.snapshot?.monthlyInstallment > 0 && (
                                <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 dark:text-emerald-200 dark:bg-emerald-950/70 dark:border-emerald-800/70 px-2 py-0.5 rounded-md tabular-nums">
                                  {formatBaht(record.snapshot.monthlyInstallment)} บ./ด.
                                </span>
                              )}

                              {/* Open Saved Customer Location Link Button */}
                              {item.mapsUrl ? (
                                <a
                                  href={item.mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => triggerHaptic('selection')}
                                  className="inline-flex items-center gap-1 font-extrabold text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 px-2.5 py-0.5 rounded-md border border-rose-400/50 shadow-xs transition-all active:scale-95"
                                  title={`เปิดดูที่อยู่บน Google Maps: ${record.googleMapsLocation}`}
                                >
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>ดูที่อยู่</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-90 shrink-0" />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    onNotify('ยังไม่มีลิงก์ที่อยู่ในเคสที่บันทึก กรุณาวางลิงก์ในช่องด้านล่าง');
                                    handleOpenEditModal(item);
                                  }}
                                  className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-sky-700 bg-slate-100/90 hover:bg-sky-50 border border-slate-200/90 dark:text-slate-300 dark:hover:text-sky-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                                  title="ยังไม่มีลิงก์ที่อยู่ แตะเพื่อเพิ่มลิงก์ Google Maps"
                                >
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>เพิ่มที่อยู่</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Card Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyCustomerSummary(item)}
                            className={`p-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white/90 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-sky-300 dark:border-slate-700'
                            }`}
                            title="คัดลอกกำหนดชำระงวด 1-9 ส่ง LINE"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-xl bg-white/90 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-amber-950/60 dark:text-slate-300 dark:hover:text-amber-300 dark:border-slate-700 transition-all cursor-pointer"
                            title="แก้ไขข้อมูลลูกค้า / วันรับรถ / วันกำหนดชำระ / ตำแหน่งที่อยู่"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Clean Read-Only First Payment Highlight Strip */}
                      <div className="rounded-xl bg-gradient-to-r from-sky-50/90 via-white to-cyan-50/80 dark:from-sky-950/60 dark:via-slate-900 dark:to-cyan-950/50 border border-sky-200/90 dark:border-sky-800/60 px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-black text-[10px] shrink-0">
                            งวดแรก
                          </span>
                          <span className="font-extrabold text-sky-950 dark:text-sky-100 whitespace-nowrap">
                            {firstDueLabelShort}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            ({cycleRangeText})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {ninthSlot && (
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              ถึงงวด 9: <strong className="text-slate-800 dark:text-slate-200">{ninthSlot.formattedShort}</strong>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedScheduleIds((prev) => ({
                                ...prev,
                                [record.id]: !prev[record.id],
                              }))
                            }
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-sky-300 dark:border-sky-700/70 font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>{isExpanded ? 'ซ่อนงวด 1-9' : 'ดูงวด 1-9'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Read-Only 9-Installment Due Dates Grid */}
                      {isExpanded && (
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5 animate-fade-in">
                          {schedule.map((slot) => (
                            <div
                              key={slot.installmentNo}
                              className={`rounded-xl px-2.5 py-2 border flex flex-col gap-0.5 ${
                                slot.installmentNo === 1
                                  ? 'bg-sky-50/90 border-sky-300 dark:bg-sky-950/70 dark:border-sky-700'
                                  : 'bg-white/85 border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700'
                              }`}
                            >
                              <span
                                className={`text-[9.5px] font-extrabold ${
                                  slot.installmentNo === 1 ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                งวดที่ {slot.installmentNo}
                                {slot.installmentNo === 1 ? ' (แรก)' : ''}
                              </span>
                              <span
                                className={`text-[11px] font-extrabold tracking-tight ${
                                  slot.installmentNo === 1 ? 'text-sky-950 dark:text-sky-100' : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {slot.formattedShort}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* ==============================================================
           GROUPED TABLE VIEW: แบ่งกลุ่มตามกำหนดชำระงวดแรก (ไม่มีช่องติ๊ก ✓/✗)
           ============================================================== */
        <div className="space-y-4">
          {groupedByFirstDue.map((group) => (
            <div
              key={group.monthKey}
              className="glass-card-primary rounded-2xl border border-sky-200/80 dark:border-slate-700/80 overflow-hidden shadow-xs"
            >
              {/* Cohort Table Header Banner */}
              <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-cyan-600 text-white px-3.5 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-black truncate">
                    กำหนดชำระงวดแรก: {group.firstDueLabelLong}
                  </span>
                  <span className="text-[10px] text-sky-100 hidden sm:inline">
                    ({group.cycleRangeText})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900/90 text-sky-800 dark:text-sky-300 font-black text-[10px] shrink-0 tabular-nums">
                  {group.items.length} ราย
                </span>
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[1080px]">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-800/95 border-b border-slate-200 dark:border-slate-700 text-[10.5px] font-extrabold text-slate-700 dark:text-slate-200">
                      <th className="sticky left-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm py-2.5 px-3 border-r border-slate-200 dark:border-slate-700 min-w-[150px]">
                        รายชื่อลูกค้า
                      </th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap">ยี่ห้อ</th>
                      <th className="py-2.5 px-2.5 min-w-[135px]">รุ่นรถ</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap">รหัสรถ</th>
                      <th className="py-2.5 px-2.5 whitespace-nowrap text-center">วันรับรถ</th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <th
                          key={n}
                          className={`py-2.5 px-2 text-center whitespace-nowrap min-w-[82px] ${
                            n === 1 ? 'bg-sky-50/90 dark:bg-sky-950/70 text-sky-800 dark:text-sky-200' : ''
                          }`}
                        >
                          งวดที่ {n}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/70 text-[11px] bg-white/75 dark:bg-slate-900/80">
                    {group.items.map((item, idx) => {
                      const {
                        record,
                        customerName,
                        brand,
                        modelName,
                        modelCode,
                        deliveryDateShort,
                        schedule,
                      } = item;
                      return (
                        <tr key={record.id} className="hover:bg-sky-50/40 dark:hover:bg-sky-950/40 transition-colors">
                          <td className="sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm py-2.5 px-3 border-r border-slate-200/80 dark:border-slate-700/80 max-w-[170px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                                {idx + 1}.
                              </span>
                              <MarqueeText className="font-bold text-slate-900 dark:text-slate-100">
                                {customerName}
                              </MarqueeText>
                            </div>
                            {record.snapshot?.monthlyInstallment > 0 && (
                              <div className="text-[9.5px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 tabular-nums">
                                {formatBaht(record.snapshot.monthlyInstallment)} บ./ด.
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <span
                              className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-md border ${getBrandBadgeStyle(
                                brand
                              )}`}
                            >
                              {brand}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 max-w-[160px]">
                            <MarqueeText className="font-semibold text-slate-800 dark:text-slate-200">
                              {modelName}
                            </MarqueeText>
                          </td>

                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <span className="font-mono text-[10px] font-bold text-blue-900 dark:text-blue-200 bg-blue-50 dark:bg-blue-950/70 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/70">
                              {modelCode}
                            </span>
                          </td>

                          <td className="py-2.5 px-2.5 whitespace-nowrap text-center text-[10.5px] font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                            {deliveryDateShort}
                          </td>

                          {schedule.map((slot) => (
                            <td
                              key={slot.installmentNo}
                              className={`py-2 px-1.5 text-center whitespace-nowrap font-bold tabular-nums ${
                                slot.installmentNo === 1
                                  ? 'bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="text-[10px]">{slot.formattedShort}</span>
                            </td>
                          ))}

                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {item.mapsUrl ? (
                                <a
                                  href={item.mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => triggerHaptic('selection')}
                                  className="px-2 py-1 rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-[10px] shadow-2xs inline-flex items-center justify-center gap-1"
                                  title={`เปิดดูที่อยู่บน Google Maps: ${record.googleMapsLocation}`}
                                >
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>ดูที่อยู่</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    onNotify('ยังไม่ได้บันทึกลิงก์ที่อยู่ของลูกค้ารายนี้ สามารถเพิ่มได้ที่ช่องด้านล่าง');
                                    handleOpenEditModal(item);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 font-semibold text-[10px] cursor-pointer inline-flex items-center justify-center gap-1"
                                  title="ยังไม่มีลิงก์ที่อยู่ (กดเพื่อเพิ่ม)"
                                >
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>เพิ่มที่อยู่</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-900/50 text-slate-600 hover:text-amber-800 dark:text-slate-300 dark:hover:text-amber-300 cursor-pointer"
                                title="แก้ไขข้อมูล"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyCustomerSummary(item)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 dark:bg-slate-800 dark:hover:bg-sky-900/50 text-slate-600 hover:text-sky-800 dark:text-slate-300 dark:hover:text-sky-300 cursor-pointer"
                                title="คัดลอก"
                              >
                                <Copy className="w-3.5 h-3.5" />
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
          ))}
        </div>
      )}

      {/* Popup Modal: Add or Edit Customer & Delivery Info */}
      <CardModalOverlay
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        accentBarClass="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500"
      >
        <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-2 bg-gradient-to-br from-sky-500 to-cyan-600 text-white rounded-2xl shadow-sm shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
                <MarqueeText>
                  {editingRecordId
                    ? 'แก้ไขข้อมูลลูกค้าและวันรับรถ'
                    : 'เพิ่มรายชื่อลูกค้าตามกำหนดชำระงวดแรก'}
                </MarqueeText>
              </h2>
              <MarqueeText className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                ระบุชื่อลูกค้า ยี่ห้อ รุ่น รหัสรถ และวันรับรถ เพื่อจัดกลุ่มตามกำหนดชำระงวดแรกอัตโนมัติ
              </MarqueeText>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFormModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSaveForm}
          className="overflow-y-auto flex-1 overscroll-contain p-4 sm:p-5 bg-slate-50/60 dark:bg-slate-950/75 space-y-3 text-xs"
        >
          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800/70 dark:text-rose-200 font-bold text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                ชื่อลูกค้า *
              </label>
              <input
                type="text"
                value={formCustomerName}
                onChange={(e) => setFormCustomerName(e.target.value)}
                placeholder="เช่น คุณสมชาย ใจดี"
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-3 py-2 font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                value={formCustomerPhone}
                onChange={(e) => setFormCustomerPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-3 py-2 font-bold font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          {/* Brand Quick Pills + Custom Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
              ยี่ห้อรถ *
            </label>
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {BRAND_SUGGESTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setFormBrand(b === 'อื่นๆ' ? '' : b)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border cursor-pointer transition-all ${
                    formBrand.toUpperCase() === b
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={formBrand}
              onChange={(e) => setFormBrand(e.target.value)}
              placeholder="ระบุยี่ห้อ เช่น HONDA, YAMAHA, VESPA"
              className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-3 py-2 font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 uppercase outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                รหัสรถ (Model Code)
              </label>
              <input
                type="text"
                value={formModelCode}
                onChange={(e) => handleFormModelCodeChange(e.target.value)}
                placeholder="เช่น ACF125CAT TH"
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-3 py-2 font-bold font-mono uppercase text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                ชื่อรุ่นรถ
              </label>
              <input
                type="text"
                value={formModelName}
                onChange={(e) => setFormModelName(e.target.value)}
                placeholder="เช่น HONDA GIORNO+ ABS"
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-3 py-2 font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                วันที่รับรถ
              </label>
              <input
                type="date"
                value={formDeliveryDate}
                onChange={(e) => setFormDeliveryDate(e.target.value)}
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-2.5 py-2 font-semibold text-slate-900 dark:text-slate-100 dark:[color-scheme:dark] outline-none text-[11px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                ชำระทุกวันที่
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={formDueDay}
                onChange={(e) => setFormDueDay(e.target.value)}
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-2.5 py-2 font-bold text-slate-900 dark:text-slate-100 text-center outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                ค่างวด (บาท)
              </label>
              <input
                type="number"
                min={0}
                value={formMonthlyInstallment}
                onChange={(e) => setFormMonthlyInstallment(e.target.value)}
                placeholder="2500"
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 px-2.5 py-2 font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-center outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Customer Location Link (Google Maps) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                <span>ลิงก์ตำแหน่งที่อยู่ลูกค้า (Google Maps)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteFormLocation}
                  className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 dark:text-sky-300 dark:hover:text-sky-200 dark:bg-sky-950/70 dark:hover:bg-sky-900/80 dark:border-sky-800/70 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardCopy className="w-3 h-3" />
                  <span>วางลิงก์</span>
                </button>
                {formGoogleMapsLocation.trim() && (
                  <a
                    href={getGoogleMapsNavigationUrl(formGoogleMapsLocation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-300 dark:hover:text-rose-200 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 dark:border-rose-800/70 px-2 py-0.5 rounded-md flex items-center gap-1"
                  >
                    <span>เปิดดู</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formGoogleMapsLocation}
                onChange={(e) => setFormGoogleMapsLocation(e.target.value)}
                placeholder="วางลิงก์ Google Maps, พิกัด GPS หรือที่อยู่ลูกค้า..."
                className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-sky-500 pl-3 pr-8 py-2 font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none text-xs"
              />
              {formGoogleMapsLocation && (
                <button
                  type="button"
                  onClick={() => setFormGoogleMapsLocation('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Live Calculated First Due Date Cohort Preview */}
          <div className="p-2.5 rounded-xl bg-sky-50/90 border border-sky-200/80 text-sky-900 dark:bg-sky-950/60 dark:border-sky-800/70 dark:text-sky-200 text-[10.5px] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>
              จัดกลุ่มงวดแรกอัตโนมัติ:{' '}
              <strong>
                วันที่ {formDuePreview.day} {formDuePreview.monthName} {formDuePreview.thaiYear}
              </strong>{' '}
              ({formDuePreview.cycleRangeText})
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 font-bold text-xs cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-xs shadow-sm cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{editingRecordId ? 'บันทึกการแก้ไข' : 'เพิ่มรายชื่อลูกค้า'}</span>
            </button>
          </div>
        </form>
      </CardModalOverlay>
    </div>
  );
};
