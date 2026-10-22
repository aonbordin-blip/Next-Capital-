import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Copy,
  Check,
  Share2,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  BarChart3,
  ExternalLink,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  BadgeAlert,
  SlidersHorizontal,
  AlignLeft,
  Box,
  Code,
  Network,
  AlignJustify,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export interface FinanceItem {
  id: string;
  name: string;
  count: string;
}

export interface DealerReport {
  id: string;
  dealerName: string;
  finances: FinanceItem[];
}

export type ReportStyle = 'modern_dots' | 'tree' | 'spaced' | 'boxed' | 'simple_dots';

export interface ReportFormatOptions {
  style: ReportStyle;
  separator: '=' | ':';
  includeUnit: boolean;
  includeSubtotal: boolean;
  includeGrandTotal: boolean;
  includeDealerIcon: boolean;
  useCodeBlock: boolean;
  includeHeader: boolean;
}

export const FORMAT_PREFS_KEY = 'ncap_daily_report_format_options_v2';

export const DEFAULT_FORMAT_OPTIONS: ReportFormatOptions = {
  style: 'modern_dots',
  separator: '=',
  includeUnit: false,
  includeSubtotal: false,
  includeGrandTotal: true,
  includeDealerIcon: true,
  useCodeBlock: false,
  includeHeader: false,
};

// Strips zero-width Thai tone and vowel marks for precise visual alignment across fonts
export function getVisualWidth(str: string): number {
  if (!str) return 0;
  // Normalize and remove Thai non-spacing combining marks:
  // \u0E31: Mai Han-Akat
  // \u0E34-\u0E3A: Sara I, Ii, Ue, Uee, U, Uu, Phinthu
  // \u0E47-\u0E4E: Maitaikhu, Mai Ek, Mai Tho, Mai Tri, Mai Chattawa, Thanthakhat, Yamakkan
  const stripped = str.normalize('NFC').replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '');
  return stripped.length;
}

// Calculate character width in "LINE dot units" (where 1 dot '.' has width 1.0)
// Specifically calibrated for mobile LINE font (iOS Sukhumvit/SF Pro and Android Noto Sans Thai/Roboto)
export function getLineDotUnits(str: string): number {
  if (!str) return 0;
  // Normalize and remove Thai non-spacing combining marks (tones and upper/lower vowels)
  const stripped = str.normalize('NFC').replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '');

  let units = 0;
  for (const ch of stripped) {
    const code = ch.charCodeAt(0);

    // Thai characters:
    if (code >= 0x0e01 && code <= 0x0e2e) {
      // Thai consonants (ก-ฮ): typically 0.62em, dot is 0.28em -> ~2.2 dot units
      if (/[ญณฌฎฏฐฒ]/.test(ch)) {
        units += 2.5;
      } else if (/[ขชซ]/.test(ch)) {
        units += 2.0;
      } else {
        units += 2.2;
      }
    } else if ((code >= 0x0e40 && code <= 0x0e44) || code === 0x0e30 || code === 0x0e32 || code === 0x0e33) {
      // Thai spacing vowels (เ, แ, โ, ใ, ไ, ะ, า, ำ)
      if (ch === 'แ') {
        units += 3.6;
      } else {
        units += 2.1;
      }
    } else if (code >= 0x0e50 && code <= 0x0e59) {
      // Thai digits (๐-๙)
      units += 2.0;
    }
    // Latin Uppercase
    else if (ch === 'M' || ch === 'W') {
      units += 3.4;
    } else if (ch === 'C' || ch === 'G' || ch === 'O' || ch === 'Q') {
      units += 2.6;
    } else if (ch === 'I' || ch === 'J') {
      units += 1.2;
    } else if (/[A-Z]/.test(ch)) {
      units += 2.3;
    }
    // Latin Lowercase
    else if (ch === 'm' || ch === 'w') {
      units += 3.0;
    } else if (ch === 'i' || ch === 'l') {
      units += 0.9;
    } else if (ch === 'r' || ch === 't' || ch === 'f') {
      units += 1.2;
    } else if (ch === 's' || ch === 'k' || ch === 'c') {
      units += 1.7;
    } else if (/[a-z]/.test(ch)) {
      units += 1.9;
    }
    // Digits
    else if (/[0-9]/.test(ch)) {
      units += 1.9;
    }
    // Space
    else if (ch === ' ') {
      units += 1.1;
    }
    // Punctuation
    else if (ch === '.') {
      units += 1.0;
    } else if (ch === '-' || ch === '_') {
      units += 1.2;
    } else if (ch === '(' || ch === ')') {
      units += 1.2;
    } else {
      units += 2.0;
    }
  }

  return units;
}

export function padEndLineDots(str: string, targetUnits: number): string {
  const currentUnits = getLineDotUnits(str);
  const diff = Math.round(targetUnits - currentUnits);
  const dotCount = Math.max(2, diff);
  return str + '.'.repeat(dotCount);
}

export function padEndVisual(str: string, targetVisualLen: number, padChar = '.'): string {
  const currentVisual = getVisualWidth(str);
  const diff = targetVisualLen - currentVisual;
  if (diff <= 0) {
    return str + padChar;
  }
  return str + padChar.repeat(diff);
}

export function getDealerNumericTotal(dealer: DealerReport): number {
  let sum = 0;
  dealer.finances.forEach((f) => {
    const val = f.count.trim();
    const match = val.match(/\d+/);
    if (match) {
      sum += parseInt(match[0], 10);
    }
  });
  return sum;
}

export const STANDARD_FINANCES = [
  'NCAP',
  'SMT',
  'SL',
  'CT',
  'AY',
  'เสริม',
];

export const OTHER_FINANCES = [
  'SS',
  'CL',
  'TTB',
  'MTC',
  'SAWAD',
  'TIDLOR',
  'GL',
  'CK',
  'KL',
  'AEON',
  'ECL',
  'THANI',
];

export const FINANCE_DESCRIPTIONS: Record<string, string> = {
  'NCAP': 'Next Capital',
  'SMT': 'Summit Capital',
  'SL': 'S Leasing',
  'CT': 'Cathay Lease',
  'CL': 'Cathay Leaseplan',
  'AY': 'Krungsri Auto (อย.)',
  'เสริม': 'เสริมสร้าง / เสริมสุข',
  'SS': 'เสริมสร้าง (SS)',
  'TTB': 'ทีทีบี (TTB Drive)',
  'MTC': 'เมืองไทย แคปปิตอล',
  'SAWAD': 'ศรีสวัสดิ์',
  'TIDLOR': 'เงินติดล้อ',
  'GL': 'กรุ๊ปลีส',
  'CK': 'ชูเกียรติลิสซิ่ง',
  'KL': 'กสิกร ลิสซิ่ง',
  'AEON': 'อิออน ธนสินทรัพย์',
  'ECL': 'ตะวันออกพาณิชย์ลีสซิ่ง',
  'THANI': 'ราชธานีลิสซิ่ง',
};

export const FINANCE_NAME_TO_ABBREVIATION: Record<string, string> = {
  'next capital': 'NCAP',
  'nextcapital': 'NCAP',
  'next': 'NCAP',
  'summit': 'SMT',
  'summit capital': 'SMT',
  's leasing': 'SL',
  's-leasing': 'SL',
  's lease': 'SL',
  'sleasing': 'SL',
  'cathay': 'CT',
  'cathay lease': 'CT',
  'cathay leaseplan': 'CT',
  'เมืองไทย แคปปิตอล': 'MTC',
  'ศรีสวัสดิ์': 'SAWAD',
  'เงินติดล้อ': 'TIDLOR',
  'กรุ๊ปลีส': 'GL',
  'ชูเกียรติ': 'CK',
};

export function normalizeFinanceName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  return FINANCE_NAME_TO_ABBREVIATION[lower] || trimmed;
}

export const COMMON_DEALER_SUGGESTIONS = [
  'ป.ยานยนต์(สนญ.)',
  'ป.ยานยนต์ (สาขา)',
  'SS ศรีราชา',
  'แสงชัยพาณิชย์',
  'มิตรยนต์',
  'นิยมพานิช',
  'เตชอัมพร',
  'ศิริพงษ์มอเตอร์',
];

const STORAGE_KEY = 'ncap_daily_dealer_report_v1';

function createDefaultFinances(): FinanceItem[] {
  return [
    { id: 'f-1', name: 'NCAP', count: '1A' },
    { id: 'f-2', name: 'SMT', count: '1' },
    { id: 'f-3', name: 'SL', count: '0' },
    { id: 'f-4', name: 'CT', count: '1' },
    { id: 'f-5', name: 'AY', count: '1' },
    { id: 'f-6', name: 'เสริม', count: '0' },
  ];
}

function createEmptyFinances(): FinanceItem[] {
  return STANDARD_FINANCES.map((name, idx) => ({
    id: `f-${Date.now()}-${idx}`,
    name,
    count: '0',
  }));
}

function createInitialDealers(): DealerReport[] {
  return [
    {
      id: 'd-1',
      dealerName: 'ป.ยานยนต์(สนญ.)',
      finances: createDefaultFinances(),
    },
  ];
}

// Format date string YYYY-MM-DD to Thai short date DD/MM/YY (e.g. 22/10/69)
export function formatThaiShortDate(dateStr: string): string {
  try {
    if (!dateStr) return '';
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return dateStr;

    // Convert Gregorian year to Buddhist Era short year (e.g. 2026 -> 2569 -> 69)
    const buddhistYear = year > 2400 ? year : year + 543;
    const shortYear = String(buddhistYear).slice(-2);
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');

    return `${dd}/${mm}/${shortYear}`;
  } catch {
    return dateStr;
  }
}

interface DailyFinanceReportCardProps {
  officerName?: string;
  officerCode?: string;
  officerDisplay?: string;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function DailyFinanceReportCard({
  officerName,
  officerCode,
  officerDisplay,
  className = '',
  isExpanded = false,
  onToggleExpand,
}: DailyFinanceReportCardProps) {
  // Load saved dealers or default (auto-migrating any old full names to clean abbreviations)
  const [dealers, setDealers] = useState<DealerReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((dealer: DealerReport) => ({
            ...dealer,
            finances: Array.isArray(dealer.finances)
              ? dealer.finances.map((f: FinanceItem) => ({
                  ...f,
                  name: normalizeFinanceName(f.name),
                }))
              : createDefaultFinances(),
          }));
        }
      }
    } catch {
      // fallback
    }
    return createInitialDealers();
  });

  // Report Date (default to today YYYY-MM-DD)
  const [reportDate, setReportDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Format options state with localStorage persistence
  const [formatOptions, setFormatOptions] = useState<ReportFormatOptions>(() => {
    try {
      const saved = localStorage.getItem(FORMAT_PREFS_KEY);
      if (saved) {
        return { ...DEFAULT_FORMAT_OPTIONS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_FORMAT_OPTIONS;
  });

  // Save format options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FORMAT_PREFS_KEY, JSON.stringify(formatOptions));
    } catch {
      // ignore
    }
  }, [formatOptions]);

  // Copy & LINE state feedback
  const [isCopied, setIsCopied] = useState(false);
  const [lineSentFeedback, setLineSentFeedback] = useState(false);

  // Quick Finance Picker modal state for a specific dealer
  const [addingFinanceToDealerId, setAddingFinanceToDealerId] = useState<string | null>(null);
  const [customFinanceName, setCustomFinanceName] = useState('');

  // Save to localStorage when dealers change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dealers));
    } catch {
      // ignore
    }
  }, [dealers]);

  // Formatted Thai Date: short format DD/MM/YY (e.g. 22/10/69) to prevent line wrapping in LINE chat
  const thaiFormattedDate = useMemo(() => {
    return formatThaiShortDate(reportDate);
  }, [reportDate]);

  // Total cases summary calculation across all dealers
  const summary = useMemo(() => {
    let totalNumericCases = 0;
    const financeCountsMap: Record<string, string[]> = {};

    dealers.forEach((d) => {
      d.finances.forEach((f) => {
        const val = f.count.trim();
        if (val) {
          // Extract numeric part if present (e.g., "1A" -> 1, "2" -> 2, "0" -> 0)
          const match = val.match(/\d+/);
          if (match) {
            totalNumericCases += parseInt(match[0], 10);
          }
          if (!financeCountsMap[f.name]) {
            financeCountsMap[f.name] = [];
          }
          if (val !== '0' && val !== '') {
            financeCountsMap[f.name].push(val);
          }
        }
      });
    });

    return {
      dealersCount: dealers.length,
      totalNumericCases,
      financeCountsMap,
    };
  }, [dealers]);

  // Generate plain-text report with precise vertical alignment and professional styling
  // Generate plain-text report with precise vertical alignment and professional styling
  const generateReportText = (): string => {
    // 1. Calculate max LINE dot units across all dealers (for proportional fonts like LINE mobile)
    let maxLineUnits = 0;
    // 2. Also calculate max visual char width (for monospace code blocks and boxed tables)
    let maxFinanceVisualWidth = 0;

    dealers.forEach((d) => {
      d.finances.forEach((f) => {
        const u = getLineDotUnits(f.name.trim());
        if (u > maxLineUnits) {
          maxLineUnits = u;
        }
        const w = getVisualWidth(f.name.trim());
        if (w > maxFinanceVisualWidth) {
          maxFinanceVisualWidth = w;
        }
      });
    });

    // Target dot units for LINE proportional font:
    // Ensure at least 3-4 dots after the longest finance name (e.g. Next Capital)
    const targetDotUnits = Math.ceil(maxLineUnits + 3.5);
    // Target char width for monospace / code block
    const targetCharWidth = Math.max(14, maxFinanceVisualWidth + 3);

    const lines: string[] = [];

    // Optional Header
    if (formatOptions.includeHeader) {
      lines.push(`📊 รายงานยอดส่งเคสประจำวัน (${thaiFormattedDate})`);
      if (officerDisplay || officerName || officerCode) {
        lines.push(`👤 ผู้รายงาน: ${officerDisplay || `${officerName || ''} (${officerCode || ''})`}`);
      }
      lines.push('────────────────────────');
    }

    // Process each dealer
    dealers.forEach((d, dealerIdx) => {
      const rawDealerName = d.dealerName.trim() || `Dealer ${dealerIdx + 1}`;
      const dealerHeading = formatOptions.includeDealerIcon ? `📍 ${rawDealerName}` : rawDealerName;

      if (formatOptions.style === 'boxed') {
        const innerWidth = Math.max(targetCharWidth + 10, getVisualWidth(dealerHeading) + 2, 28);
        const topBorder = '┌' + '─'.repeat(innerWidth) + '┐';
        const midBorder = '├' + '─'.repeat(innerWidth) + '┤';
        const bottomBorder = '└' + '─'.repeat(innerWidth) + '┘';

        lines.push(topBorder);
        const headerPadded = dealerHeading + ' '.repeat(Math.max(1, innerWidth - getVisualWidth(dealerHeading) - 1));
        lines.push(`│ ${headerPadded}│`);
        lines.push(midBorder);

        d.finances.forEach((f) => {
          const name = f.name.trim();
          const count = f.count.trim() || '0';
          const sep = ` ${formatOptions.separator} `;
          const unit = formatOptions.includeUnit ? ' เคส' : '';
          const paddedName = padEndVisual(name, targetCharWidth, '.');
          const rowContent = `${paddedName}${sep}${count}${unit}`;
          const currentW = getVisualWidth(rowContent);
          const spaceNeeded = Math.max(1, innerWidth - currentW - 1);
          lines.push(`│ ${rowContent}${' '.repeat(spaceNeeded)}│`);
        });

        if (formatOptions.includeSubtotal) {
          const subtotal = getDealerNumericTotal(d);
          const subContent = `(รวม: ${subtotal} เคส)`;
          const currentW = getVisualWidth(subContent);
          const spaceNeeded = Math.max(1, innerWidth - currentW - 1);
          lines.push(`│ ${subContent}${' '.repeat(spaceNeeded)}│`);
        }

        lines.push(bottomBorder);
      } else if (formatOptions.style === 'tree') {
        lines.push(dealerHeading);
        d.finances.forEach((f, fIdx) => {
          const isLast = fIdx === d.finances.length - 1;
          const prefix = isLast ? '└── ' : '├── ';
          const fillChar = isLast ? '─' : '┈';
          const name = f.name.trim();
          const count = f.count.trim() || '0';
          const sep = ` ${formatOptions.separator} `;
          const unit = formatOptions.includeUnit ? ' เคส' : '';
          const paddedName = padEndVisual(name, targetCharWidth, fillChar);
          lines.push(`${prefix}${paddedName}${sep}${count}${unit}`);
        });
        if (formatOptions.includeSubtotal) {
          const subtotal = getDealerNumericTotal(d);
          lines.push(`    ↳ รวม: ${subtotal} เคส`);
        }
      } else if (formatOptions.style === 'spaced') {
        lines.push(dealerHeading);
        d.finances.forEach((f) => {
          const name = f.name.trim();
          const count = f.count.trim() || '0';
          const sep = `  ${formatOptions.separator}  `;
          const unit = formatOptions.includeUnit ? ' เคส' : '';
          const paddedName = padEndVisual(name, targetCharWidth, ' ');
          lines.push(`${paddedName}${sep}${count}${unit}`);
        });
        if (formatOptions.includeSubtotal) {
          const subtotal = getDealerNumericTotal(d);
          lines.push(`(รวม: ${subtotal} เคส)`);
        }
      } else if (formatOptions.style === 'simple_dots') {
        lines.push(dealerHeading);
        d.finances.forEach((f) => {
          const name = f.name.trim();
          const count = f.count.trim() || '0';
          const sep = ` ${formatOptions.separator} `;
          const unit = formatOptions.includeUnit ? ' เคส' : '';
          // If code block, use monospace character padding; if standard LINE message, use LINE-calibrated dot units
          const paddedName = formatOptions.useCodeBlock
            ? padEndVisual(name, targetCharWidth, '.')
            : padEndLineDots(name, targetDotUnits);
          lines.push(`${paddedName}${sep}${count}${unit}`);
        });
        if (formatOptions.includeSubtotal) {
          const subtotal = getDealerNumericTotal(d);
          lines.push(`(รวม: ${subtotal} เคส)`);
        }
      } else {
        // 'modern_dots' (Default & Recommended)
        lines.push(dealerHeading);
        d.finances.forEach((f) => {
          const name = f.name.trim();
          const count = f.count.trim() || '0';
          const sep = ` ${formatOptions.separator} `;
          const unit = formatOptions.includeUnit ? ' เคส' : '';
          // If code block, use monospace character padding; if standard LINE message, use LINE-calibrated dot units
          const paddedName = formatOptions.useCodeBlock
            ? padEndVisual(name, targetCharWidth, '.')
            : padEndLineDots(name, targetDotUnits);
          lines.push(`• ${paddedName}${sep}${count}${unit}`);
        });
        if (formatOptions.includeSubtotal) {
          const subtotal = getDealerNumericTotal(d);
          lines.push(`  ↳ รวม: ${subtotal} เคส`);
        }
      }

      // Blank line between dealers
      if (dealerIdx < dealers.length - 1) {
        lines.push('');
      }
    });

    // Grand total at bottom
    if (formatOptions.includeGrandTotal) {
      lines.push('');
      if (dealers.length > 1) {
        lines.push(`📊 รวมทุกดีลเลอร์: ${summary.totalNumericCases} เคส (${dealers.length} ดีลเลอร์)`);
      } else {
        lines.push(`📊 รวมทั้งหมด: ${summary.totalNumericCases} เคส`);
      }
    }

    let result = lines.join('\n');
    if (formatOptions.useCodeBlock) {
      result = '```\n' + result + '\n```';
    }
    return result;
  };

  const handleCopyText = async () => {
    triggerHaptic('success');
    const text = generateReportText();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2400);
    } catch {
      // fallback
    }
  };

  const handleSendLine = async () => {
    triggerHaptic('success');
    const text = generateReportText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setLineSentFeedback(true);
    setTimeout(() => setLineSentFeedback(false), 3000);

    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
  };

  const handleToggle = () => {
    triggerHaptic('light');
    if (onToggleExpand) {
      onToggleExpand();
    }
  };

  // Add a new dealer
  const handleAddDealer = (namePreset?: string) => {
    triggerHaptic('selection');
    const newDealer: DealerReport = {
      id: `d-${Date.now()}`,
      dealerName: namePreset || `ดีลเลอร์ใหม่ ${dealers.length + 1}`,
      finances: createEmptyFinances(),
    };
    setDealers((prev) => [...prev, newDealer]);
  };

  // Remove a dealer
  const handleRemoveDealer = (dealerId: string) => {
    triggerHaptic('warning');
    if (dealers.length <= 1) {
      // Don't remove last dealer, reset instead
      setDealers([
        {
          id: `d-${Date.now()}`,
          dealerName: 'ป.ยานยนต์(สนญ.)',
          finances: createEmptyFinances(),
        },
      ]);
      return;
    }
    setDealers((prev) => prev.filter((d) => d.id !== dealerId));
  };

  // Duplicate a dealer
  const handleDuplicateDealer = (dealer: DealerReport) => {
    triggerHaptic('selection');
    const duplicated: DealerReport = {
      id: `d-${Date.now()}`,
      dealerName: `${dealer.dealerName} (สาขา 2)`,
      finances: dealer.finances.map((f, i) => ({
        id: `f-${Date.now()}-${i}`,
        name: f.name,
        count: '0',
      })),
    };
    setDealers((prev) => [...prev, duplicated]);
  };

  // Update dealer name
  const handleUpdateDealerName = (dealerId: string, name: string) => {
    setDealers((prev) =>
      prev.map((d) => (d.id === dealerId ? { ...d, dealerName: name } : d))
    );
  };

  // Update finance count
  const handleUpdateFinanceCount = (
    dealerId: string,
    financeId: string,
    newCount: string
  ) => {
    setDealers((prev) =>
      prev.map((d) => {
        if (d.id !== dealerId) return d;
        return {
          ...d,
          finances: d.finances.map((f) =>
            f.id === financeId ? { ...f, count: newCount } : f
          ),
        };
      })
    );
  };

  // Add finance to dealer
  const handleAddFinance = (dealerId: string, name: string) => {
    triggerHaptic('selection');
    const normalized = normalizeFinanceName(name);
    if (!normalized) return;

    setDealers((prev) =>
      prev.map((d) => {
        if (d.id !== dealerId) return d;
        // Avoid duplicate name in same dealer if possible, or allow it
        if (d.finances.some((f) => f.name.toLowerCase() === normalized.toLowerCase())) {
          return d;
        }
        return {
          ...d,
          finances: [
            ...d.finances,
            { id: `f-${Date.now()}`, name: normalized, count: '0' },
          ],
        };
      })
    );
    setAddingFinanceToDealerId(null);
    setCustomFinanceName('');
  };

  // Remove finance row from dealer
  const handleRemoveFinance = (dealerId: string, financeId: string) => {
    triggerHaptic('light');
    setDealers((prev) =>
      prev.map((d) => {
        if (d.id !== dealerId) return d;
        return {
          ...d,
          finances: d.finances.filter((f) => f.id !== financeId),
        };
      })
    );
  };

  // Reset all counts to 0 for a new day
  const handleResetCountsToZero = () => {
    triggerHaptic('warning');
    if (!window.confirm('ต้องการรีเซ็ตยอดจำนวนเคสทุกไฟแนนซ์เป็น 0 หรือไม่?')) return;
    setDealers((prev) =>
      prev.map((d) => ({
        ...d,
        finances: d.finances.map((f) => ({ ...f, count: '0' })),
      }))
    );
  };

  // Restore default template (from user's original request)
  const handleRestoreDefaultTemplate = () => {
    triggerHaptic('warning');
    if (!window.confirm('ต้องการกู้คืนข้อมูลเริ่มต้นตามตัวอย่าง (ป.ยานยนต์) หรือไม่?')) return;
    setDealers(createInitialDealers());
  };

  return (
    <div
      id="daily-finance-report-section"
      data-card-id="daily_report"
      className={`glass-card-primary rounded-[26px] p-4 sm:p-5 relative overflow-hidden elevated-data-box border border-violet-200/80 shadow-md ${className}`}
    >
      {/* Top Gradient Header Accent Bar */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500 opacity-95" />

      {/* Header Row */}
      <div
        data-card-toggle="true"
        onClick={handleToggle}
        className={`flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
          isExpanded ? 'pb-3 border-b border-violet-100/80' : 'pb-0 border-b-0'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xs shadow-violet-500/30 shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-800 tracking-tight">
                รายงานประจำวันยอดเคสไฟแนนซ์
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100/90 text-violet-800 border border-violet-200/80">
                Daily Finance Report
              </span>
              {!isExpanded && (
                <span className="text-[9.5px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                  {dealers.length} Dealer • รวม {summary.totalNumericCases} เคส (คลิกเพื่อเปิด)
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium truncate">
              สรุปยอดแต่ละไฟแนนซ์แยกราย Dealer เพิ่ม-ลบได้ไม่จำกัด พร้อมคัดลอกส่งเข้า LINE ประจำวัน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isExpanded && (
            <button
              type="button"
              onClick={handleCopyText}
              className={`p-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                isCopied
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white/90 hover:bg-violet-50 text-slate-700 hover:text-violet-700 border-slate-200/80'
              }`}
              title="คัดลอกข้อความรายงาน"
            >
              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-violet-600" />}
              <span className="hidden sm:inline text-[10.5px]">
                {isCopied ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggle}
            className="p-1.5 rounded-xl bg-white/90 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer border border-slate-200/80 shadow-2xs"
            title={isExpanded ? 'ย่อกล่อง' : 'ขยายกล่อง'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Quick Date and Officer Subheader Bar */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-50/70 via-indigo-50/50 to-white border border-violet-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-violet-200/80 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-violet-600" />
                <span className="text-[11px] font-bold text-slate-700">วันที่:</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="text-xs font-semibold text-violet-950 bg-transparent outline-none cursor-pointer"
                />
                <span className="text-[10px] text-violet-700 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/60 whitespace-nowrap">
                  ({thaiFormattedDate})
                </span>
              </div>

              {officerDisplay && (
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-violet-200/80 shadow-2xs text-[11px] font-semibold text-slate-700">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เจ้าหน้าที่: <strong className="text-indigo-900">{officerDisplay}</strong></span>
                </div>
              )}
            </div>

            {/* Quick summary badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-violet-600 text-white shadow-2xs">
                {dealers.length} ดีลเลอร์
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
                รวม {summary.totalNumericCases} เคส
              </span>
              <button
                type="button"
                onClick={handleResetCountsToZero}
                className="text-[9.5px] font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                title="รีเซ็ตจำนวนเคสเป็น 0"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>รีเซ็ตยอดเป็น 0</span>
              </button>
            </div>
          </div>

          {/* List of Dealers Cards */}
          <div className="space-y-3.5">
            {dealers.map((dealer, dIdx) => {
              // Calculate dealer subtotal
              let dealerSubtotal = 0;
              dealer.finances.forEach((f) => {
                const match = f.count.trim().match(/\d+/);
                if (match) dealerSubtotal += parseInt(match[0], 10);
              });

              return (
                <div
                  key={dealer.id}
                  className="glass-panel-white p-3.5 sm:p-4 rounded-2xl elevated-data-box border border-violet-100/90 shadow-2xs space-y-3"
                >
                  {/* Dealer Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {dIdx + 1}
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <input
                          type="text"
                          value={dealer.dealerName}
                          onChange={(e) => handleUpdateDealerName(dealer.id, e.target.value)}
                          placeholder="ชื่อ Dealer (เช่น ป.ยานยนต์(สนญ.))"
                          className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-violet-300 focus:border-violet-500 outline-none px-1 py-0.5 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        รวม {dealerSubtotal} เคส
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDuplicateDealer(dealer)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="คัดลอกเป็นดีลเลอร์ใหม่"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      {dealers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDealer(dealer.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="ลบดีลเลอร์นี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dealer Suggestions Quick Pills */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] text-slate-400 font-medium">ชื่อแนะนำ:</span>
                    {COMMON_DEALER_SUGGESTIONS.slice(0, 4).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          handleUpdateDealerName(dealer.id, sug);
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded-md border transition-all ${
                          dealer.dealerName === sug
                            ? 'bg-violet-600 text-white border-violet-600 font-bold'
                            : 'bg-white hover:bg-violet-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>

                  {/* Finances Table / Rows inside this Dealer */}
                  <div className="space-y-1.5">
                    {dealer.finances.map((f, fIdx) => {
                      const isNextCapital =
                        f.name.toLowerCase().includes('next') ||
                        f.name.toLowerCase().includes('ncap');

                      return (
                        <div
                          key={f.id}
                          className={`flex items-center gap-2 p-1.5 sm:p-2 rounded-xl border transition-all ${
                            isNextCapital
                              ? 'bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-white border-sky-200/90 shadow-2xs'
                              : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70'
                          }`}
                        >
                          {/* Finance Name */}
                          <div className="w-[120px] sm:w-[150px] shrink-0 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isNextCapital
                                  ? 'bg-sky-500 ring-2 ring-sky-200'
                                  : 'bg-slate-400'
                              }`}
                            />
                            <input
                              type="text"
                              value={f.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setDealers((prev) =>
                                  prev.map((d) =>
                                    d.id === dealer.id
                                      ? {
                                          ...d,
                                          finances: d.finances.map((item) =>
                                            item.id === f.id
                                              ? { ...item, name: newName }
                                              : item
                                          ),
                                        }
                                      : d
                                  )
                                );
                              }}
                              className={`text-xs font-bold outline-none bg-transparent w-full ${
                                isNextCapital ? 'text-sky-900 font-extrabold' : 'text-slate-800'
                              }`}
                              placeholder="ชื่อไฟแนนซ์"
                            />
                          </div>

                          <span className="text-slate-300 font-semibold text-xs">=</span>

                          {/* Count Input */}
                          <div className="flex-1 max-w-[110px]">
                            <input
                              type="text"
                              value={f.count}
                              onChange={(e) =>
                                handleUpdateFinanceCount(dealer.id, f.id, e.target.value)
                              }
                              placeholder="0 หรือ 1A"
                              className={`w-full text-center px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                                f.count !== '0' && f.count !== ''
                                  ? 'bg-white text-indigo-950 border-indigo-300 shadow-2xs ring-1 ring-indigo-200/50'
                                  : 'bg-white/80 text-slate-500 border-slate-200'
                              }`}
                            />
                          </div>

                          {/* Quick shortcuts for fast mobile input: 0, 1, 1A, 2 */}
                          <div className="hidden sm:flex items-center gap-1">
                            {['0', '1', '1A', '2'].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  handleUpdateFinanceCount(dealer.id, f.id, val);
                                }}
                                className={`text-[9.5px] px-1.5 py-0.5 rounded border transition-colors ${
                                  f.count === val
                                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>

                          {/* Delete finance row */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFinance(dealer.id, f.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-auto"
                            title="ลบแถวไฟแนนซ์นี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Finance Button / Quick Add to this Dealer */}
                  {addingFinanceToDealerId === dealer.id ? (
                    <div className="p-2.5 rounded-xl bg-violet-50/80 border border-violet-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-violet-900">
                          เลือกไฟแนนซ์ที่ต้องการเพิ่ม:
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddingFinanceToDealerId(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-800"
                        >
                          ยกเลิก
                        </button>
                      </div>

                      {/* Standard suggestions with all abbreviations */}
                      <div className="flex flex-wrap gap-1">
                        {[...STANDARD_FINANCES, ...OTHER_FINANCES]
                          .filter(
                            (finName) =>
                              !dealer.finances.some(
                                (df) => df.name.toLowerCase() === finName.toLowerCase()
                              )
                          )
                          .map((finName) => {
                            const desc = FINANCE_DESCRIPTIONS[finName];
                            return (
                              <button
                                key={finName}
                                type="button"
                                onClick={() => handleAddFinance(dealer.id, finName)}
                                title={desc ? `${finName} (${desc})` : finName}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-white hover:bg-violet-600 hover:text-white text-violet-800 border border-violet-200 font-bold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                              >
                                <span>+ {finName}</span>
                                {desc && (
                                  <span className="text-[8.5px] opacity-75 font-normal hidden sm:inline">
                                    ({desc})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>

                      {/* Or type custom */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={customFinanceName}
                          onChange={(e) => setCustomFinanceName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddFinance(dealer.id, customFinanceName);
                            }
                          }}
                          placeholder="พิมพ์ชื่อไฟแนนซ์อื่นๆ แล้วกดเพิ่ม"
                          className="flex-1 px-2 py-1 rounded-lg text-xs border border-violet-200 bg-white outline-none font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFinance(dealer.id, customFinanceName)}
                          className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-2xs"
                        >
                          เพิ่ม
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setAddingFinanceToDealerId(dealer.id);
                        }}
                        className="text-[10.5px] font-semibold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100/80 px-2.5 py-1 rounded-xl border border-violet-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-violet-600" />
                        <span>เพิ่มไฟแนนซ์ในดีลเลอร์นี้</span>
                      </button>

                      {/* Mobile quick shortcut buttons for all finances */}
                      <div className="flex sm:hidden items-center gap-1 text-[9px] text-slate-400">
                        <span>แตะช่องเพื่อพิมพ์ 0 หรือ 1A</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Row: + เพิ่ม Dealer & Template Defaults */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAddDealer()}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs shadow-violet-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่ม Dealer ใหม่ (+ เพิ่มดีลเลอร์)</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreDefaultTemplate}
              className="text-[10.5px] text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              title="รีเซ็ตกลับเป็นตัวอย่าง ป.ยานยนต์ เริ่มต้น"
            >
              กู้คืนตัวอย่าง ป.ยานยนต์
            </button>
          </div>

          {/* Live Preview Box with Alignment Controls (ปรับสีสว่างเหมือนกล่องขออนุมัติเคส DV) */}
          <div className="glass-panel-white p-3.5 rounded-2xl elevated-data-box border border-violet-200/90 bg-gradient-to-br from-violet-50/40 via-white to-white shadow-2xs space-y-3">
            {/* Header & Quick Action */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-violet-100">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-bold text-slate-800">
                  ตัวอย่างข้อความรายงานที่จะส่งเข้า LINE :
                </span>
                <span className="text-[10px] text-violet-800 font-semibold bg-white border border-violet-200 px-2 py-0.5 rounded-full shadow-2xs">
                  {generateReportText().length} ตัวอักษร
                </span>
              </div>

              {/* Quick Copy tiny button */}
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] font-bold text-violet-700 hover:text-violet-900 flex items-center gap-1 hover:underline cursor-pointer bg-white/90 hover:bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200 shadow-2xs transition-colors"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-violet-600" />
                    <span>คัดลอกด่วน</span>
                  </>
                )}
              </button>
            </div>

            {/* Style Selector Tabs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-slate-600">
                  เลือกสไตล์การจัดแนว:
                </span>
                <span className="text-[10px] text-slate-400">
                  {formatOptions.style === 'modern_dots' && '• จุดไข่ปลาเชื่อมตัวเลขตรงดิ่ง (ยอดนิยม)'}
                  {formatOptions.style === 'tree' && '• แผนผังกิ่งไม้สวยงามเป็นระเบียบ'}
                  {formatOptions.style === 'spaced' && '• จัดคอลัมน์ด้วยช่องว่างตรงบรรทัด'}
                  {formatOptions.style === 'boxed' && '• ตารางกรอบสี่เหลี่ยมรอบดีลเลอร์'}
                  {formatOptions.style === 'simple_dots' && '• เรียบง่ายดั้งเดิม ตัวเลขเรียงตรงดิ่ง'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {[
                  { id: 'modern_dots', label: '✨ จุดตรงดิ่ง', sub: 'แนะนำ' },
                  { id: 'tree', label: '🌿 กิ่งผัง', sub: 'Tree' },
                  { id: 'spaced', label: '📋 เว้นวรรค', sub: 'Spaced' },
                  { id: 'boxed', label: '📦 กล่องตาราง', sub: 'Boxed' },
                  { id: 'simple_dots', label: '📝 เรียบง่าย', sub: 'Simple' },
                ].map((s) => {
                  const isActive = formatOptions.style === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setFormatOptions((prev) => ({ ...prev, style: s.id as ReportStyle }));
                      }}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all text-center border cursor-pointer ${
                        isActive
                          ? 'bg-violet-600 text-white border-violet-600 shadow-xs shadow-violet-500/25 ring-2 ring-violet-200'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <div className="leading-tight">{s.label}</div>
                      <div
                        className={`text-[9px] font-normal ${
                          isActive ? 'text-violet-100' : 'text-slate-400'
                        }`}
                      >
                        {s.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customization Options Bar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-violet-100">
              {/* Separator toggle */}
              <div className="flex items-center rounded-lg bg-white p-0.5 border border-violet-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 px-1.5">คั่น:</span>
                <button
                  type="button"
                  onClick={() => setFormatOptions((prev) => ({ ...prev, separator: '=' }))}
                  className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md transition-colors ${
                    formatOptions.separator === '='
                      ? 'bg-violet-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  =
                </button>
                <button
                  type="button"
                  onClick={() => setFormatOptions((prev) => ({ ...prev, separator: ':' }))}
                  className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md transition-colors ${
                    formatOptions.separator === ':'
                      ? 'bg-violet-600 text-white shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  :
                </button>
              </div>

              {/* Pin Icon Toggle */}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-violet-50/60 border border-violet-200/80 cursor-pointer text-[10.5px] text-slate-700 select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={formatOptions.includeDealerIcon}
                  onChange={(e) =>
                    setFormatOptions((prev) => ({ ...prev, includeDealerIcon: e.target.checked }))
                  }
                  className="rounded text-violet-600 focus:ring-violet-500 w-3 h-3"
                />
                <span>📍 ไอคอนดีลเลอร์</span>
              </label>

              {/* Grand Total Toggle */}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-violet-50/60 border border-violet-200/80 cursor-pointer text-[10.5px] text-slate-700 select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={formatOptions.includeGrandTotal}
                  onChange={(e) =>
                    setFormatOptions((prev) => ({ ...prev, includeGrandTotal: e.target.checked }))
                  }
                  className="rounded text-violet-600 focus:ring-violet-500 w-3 h-3"
                />
                <span>📊 รวมทุกดีลเลอร์</span>
              </label>

              {/* Subtotal per dealer */}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-violet-50/60 border border-violet-200/80 cursor-pointer text-[10.5px] text-slate-700 select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={formatOptions.includeSubtotal}
                  onChange={(e) =>
                    setFormatOptions((prev) => ({ ...prev, includeSubtotal: e.target.checked }))
                  }
                  className="rounded text-violet-600 focus:ring-violet-500 w-3 h-3"
                />
                <span>รวมรายดีลเลอร์</span>
              </label>

              {/* Unit 'เคส' */}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-violet-50/60 border border-violet-200/80 cursor-pointer text-[10.5px] text-slate-700 select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={formatOptions.includeUnit}
                  onChange={(e) =>
                    setFormatOptions((prev) => ({ ...prev, includeUnit: e.target.checked }))
                  }
                  className="rounded text-violet-600 focus:ring-violet-500 w-3 h-3"
                />
                <span>หน่วย 'เคส'</span>
              </label>

              {/* Header Toggle */}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-violet-50/60 border border-violet-200/80 cursor-pointer text-[10.5px] text-slate-700 select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={formatOptions.includeHeader}
                  onChange={(e) =>
                    setFormatOptions((prev) => ({ ...prev, includeHeader: e.target.checked }))
                  }
                  className="rounded text-violet-600 focus:ring-violet-500 w-3 h-3"
                />
                <span>หัวข้อวันที่/ผู้ส่ง</span>
              </label>

              {/* Code block toggle */}
              <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-violet-50/60 border border-violet-200/80 cursor-pointer text-[10.5px] text-slate-700 select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={formatOptions.useCodeBlock}
                  onChange={(e) =>
                    setFormatOptions((prev) => ({ ...prev, useCodeBlock: e.target.checked }))
                  }
                  className="rounded text-violet-600 focus:ring-violet-500 w-3 h-3"
                />
                <span>``` โค้ดบล็อก LINE</span>
              </label>
            </div>

            {/* Live Text Preview Box: ปรับสีสว่าง (Light Theme) เหมือนกล่องขออนุมัติเคส DV */}
            <div className="relative">
              <pre className="font-sans text-[11.5px] leading-relaxed whitespace-pre-wrap text-slate-800 select-text bg-white/95 p-3.5 rounded-xl border border-violet-200/80 shadow-2xs max-h-[220px] overflow-y-auto">
                {generateReportText()}
              </pre>
            </div>
          </div>

          {/* Primary Action Buttons: คัดลอก & ส่งเข้า LINE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyText}
              className={`w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                isCopied
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 hover:border-slate-300 shadow-slate-200/50'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>คัดลอกรายงานเรียบร้อยแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-violet-600" />
                  <span>คัดลอกข้อความรายงาน</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSendLine}
              className={`w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                lineSentFeedback
                  ? 'bg-emerald-700 text-white shadow-emerald-700/30'
                  : 'bg-[#06C755] hover:bg-[#05b34c] text-white shadow-[#06C755]/30'
              }`}
            >
              <Share2 className="w-4 h-4 text-white" />
              <span>
                {lineSentFeedback
                  ? 'คัดลอก & กำลังเปิด LINE...'
                  : 'คัดลอก & ส่งเข้า LINE'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
