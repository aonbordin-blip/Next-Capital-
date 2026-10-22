import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  BarChart3,
  Layers,
  CopyPlus,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export interface FinanceEntry {
  id: string;
  name: string;
  value: string;
}

export interface DealerReportItem {
  id: string;
  dealerName: string;
  finances: FinanceEntry[];
}

const DEFAULT_FINANCE_NAMES = [
  'Next Capital',
  'Summit',
  'S Leasing',
  'Cathay',
  'AY',
  'เสริม',
];

const QUICK_FINANCE_PRESETS = [
  'Next Capital',
  'Summit',
  'S Leasing',
  'Cathay',
  'AY',
  'เสริม',
  'ฐิติกร (TK)',
  'ศรีสวัสดิ์',
  'เมืองไทย',
  'อิออน (AEON)',
];

const DEALER_PRESETS = [
  'ป.ยานยนต์(สนญ.)',
  'ป.ยานยนต์',
  'แสงชัย',
  'เตชะพาณิชย์',
  'สหพานิช',
  'มิตรยนต์',
  'ฮอนด้าประสิทธิ์',
];

const QUICK_VALUE_PRESETS = ['0', '1', '2', '3', '1A', '2A', '3A'];

const createDefaultFinances = (): FinanceEntry[] => [
  { id: 'f-1', name: 'Next Capital', value: '1A' },
  { id: 'f-2', name: 'Summit', value: '1' },
  { id: 'f-3', name: 'S Leasing', value: '0' },
  { id: 'f-4', name: 'Cathay', value: '1' },
  { id: 'f-5', name: 'AY', value: '1' },
  { id: 'f-6', name: 'เสริม', value: '0' },
];

const createEmptyFinances = (): FinanceEntry[] =>
  DEFAULT_FINANCE_NAMES.map((name, i) => ({
    id: `f-${Date.now()}-${i}`,
    name,
    value: '0',
  }));

const STORAGE_KEY = 'ncap_daily_report_data_v1';

interface Props {
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const DailyReportCard: React.FC<Props> = ({
  className = '',
  isExpanded: controlledExpanded,
  onToggleExpand,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<boolean>(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    triggerHaptic('light');
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // State: List of Dealers
  const [dealers, setDealers] = useState<DealerReportItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'd-1',
        dealerName: 'ป.ยานยนต์(สนญ.)',
        finances: createDefaultFinances(),
      },
    ];
  });

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lineSentFeedback, setLineSentFeedback] = useState<boolean>(false);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dealers));
    } catch {
      // ignore
    }
  }, [dealers]);

  // Generate Report Text exactly matching user format
  const generateReportText = (): string => {
    if (dealers.length === 0) return '';

    return dealers
      .map((dealer) => {
        const dealerTitle = (dealer.dealerName || 'ไม่ระบุชื่อดีลเลอร์').trim();
        const financeLines = dealer.finances
          .map((f) => `${f.name.trim()} = ${(f.value || '0').trim()}`)
          .join('\n');

        return `--------------------------\n${dealerTitle}\n${financeLines}\n--------------------------`;
      })
      .join('\n');
  };

  // Add new dealer
  const handleAddDealer = (presetName?: string) => {
    triggerHaptic('medium');
    const newDealer: DealerReportItem = {
      id: `dealer-${Date.now()}`,
      dealerName: presetName || `ดีลเลอร์ที่ ${dealers.length + 1}`,
      finances: createEmptyFinances(),
    };
    setDealers((prev) => [...prev, newDealer]);
  };

  // Duplicate dealer
  const handleDuplicateDealer = (dealerIndex: number) => {
    triggerHaptic('light');
    const source = dealers[dealerIndex];
    if (!source) return;
    const duplicated: DealerReportItem = {
      id: `dealer-${Date.now()}`,
      dealerName: `${source.dealerName} (สาขาใหม่)`,
      finances: source.finances.map((f) => ({
        id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: f.name,
        value: '0',
      })),
    };
    const next = [...dealers];
    next.splice(dealerIndex + 1, 0, duplicated);
    setDealers(next);
  };

  // Remove dealer
  const handleRemoveDealer = (dealerIndex: number) => {
    triggerHaptic('light');
    if (dealers.length <= 1) {
      // Don't remove last one, just reset it
      setDealers([
        {
          id: `dealer-${Date.now()}`,
          dealerName: 'ป.ยานยนต์(สนญ.)',
          finances: createDefaultFinances(),
        },
      ]);
      return;
    }
    setDealers((prev) => prev.filter((_, idx) => idx !== dealerIndex));
  };

  // Update dealer name
  const handleUpdateDealerName = (dealerIndex: number, newName: string) => {
    setDealers((prev) => {
      const next = [...prev];
      next[dealerIndex] = { ...next[dealerIndex], dealerName: newName };
      return next;
    });
  };

  // Add finance to a dealer
  const handleAddFinance = (dealerIndex: number, financeName = '') => {
    triggerHaptic('light');
    setDealers((prev) => {
      const next = [...prev];
      const target = next[dealerIndex];
      const newEntry: FinanceEntry = {
        id: `f-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: financeName || 'ไฟแนนซ์ใหม่',
        value: '0',
      };
      next[dealerIndex] = {
        ...target,
        finances: [...target.finances, newEntry],
      };
      return next;
    });
  };

  // Remove finance from a dealer
  const handleRemoveFinance = (dealerIndex: number, financeIndex: number) => {
    triggerHaptic('light');
    setDealers((prev) => {
      const next = [...prev];
      const target = next[dealerIndex];
      next[dealerIndex] = {
        ...target,
        finances: target.finances.filter((_, idx) => idx !== financeIndex),
      };
      return next;
    });
  };

  // Update finance name or value
  const handleUpdateFinance = (
    dealerIndex: number,
    financeIndex: number,
    field: 'name' | 'value',
    newValue: string
  ) => {
    setDealers((prev) => {
      const next = [...prev];
      const target = next[dealerIndex];
      const finances = [...target.finances];
      finances[financeIndex] = { ...finances[financeIndex], [field]: newValue };
      next[dealerIndex] = { ...target, finances };
      return next;
    });
  };

  // Quick reset all values to '0'
  const handleResetValuesToZero = () => {
    triggerHaptic('medium');
    setDealers((prev) =>
      prev.map((d) => ({
        ...d,
        finances: d.finances.map((f) => ({ ...f, value: '0' })),
      }))
    );
  };

  // Reset all to template
  const handleResetEntireTemplate = () => {
    triggerHaptic('medium');
    setDealers([
      {
        id: `dealer-${Date.now()}`,
        dealerName: 'ป.ยานยนต์(สนญ.)',
        finances: createDefaultFinances(),
      },
    ]);
  };

  // Copy report to clipboard
  const handleCopyReport = async () => {
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

  // Send to LINE
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

  // Calculate Next Capital total across dealers
  const nextCapitalCount = dealers.reduce((acc, d) => {
    const nc = d.finances.find((f) => f.name.toLowerCase().includes('next capital'));
    return nc ? `${acc}${acc ? ', ' : ''}${d.dealerName}: ${nc.value}` : acc;
  }, '');

  return (
    <div
      id="daily-report-section"
      className={`glass-card-primary rounded-[26px] p-4 sm:p-5 relative overflow-hidden elevated-data-box border border-indigo-200/90 shadow-md ${className}`}
    >
      {/* Top Gradient Header Accent Bar */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 opacity-95" />

      {/* Header Row */}
      <div
        onClick={handleToggle}
        className={`flex items-center justify-between gap-2 cursor-pointer select-none transition-all ${
          isExpanded ? 'pb-3 border-b border-indigo-100/90' : 'pb-0 border-b-0'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-sky-600 flex items-center justify-center text-white shadow-xs shadow-indigo-500/30 shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-800 tracking-tight">
                รายงานประจำวัน (ส่งยอดดีลเลอร์ & ไฟแนนซ์)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200/80">
                Daily Report
              </span>
              {!isExpanded && (
                <span className="text-[9.5px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  คลิกเพื่อขยาย
                </span>
              )}
            </div>
            {!isExpanded ? (
              <p className="text-[10.5px] text-indigo-900/80 font-medium truncate mt-0.5">
                {dealers.length} ดีลเลอร์ | {nextCapitalCount || 'พร้อมส่งออก LINE'}
              </p>
            ) : (
              <p className="text-[10.5px] text-slate-500 font-medium truncate">
                บันทึกยอดแต่ละไฟแนนซ์ แยกตามดีลเลอร์ ส่งสรุปเข้า LINE รูปแบบมาตรฐาน
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isExpanded && (
            <button
              type="button"
              onClick={handleResetValuesToZero}
              className="p-1.5 rounded-xl bg-white/90 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200/80 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              title="รีเซ็ตยอดทุกไฟแนนซ์เป็น 0 สำหรับวันใหม่"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline text-[10.5px]">รีเซ็ตเป็น 0</span>
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
        <div className="mt-4 space-y-4 animate-fade-in">
          {/* Top Info Bar & Quick Preset Dealer Pills */}
          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-950 font-semibold text-[11.5px]">
              <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>รายการดีลเลอร์ประจำวัน ({dealers.length} ร้าน)</span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-indigo-700 font-medium">เพิ่มด่วน:</span>
              {DEALER_PRESETS.slice(0, 4).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleAddDealer(p)}
                  className="text-[9.5px] px-2 py-0.5 rounded-lg bg-white hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200/80 font-medium transition-colors cursor-pointer shadow-2xs"
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>

          {/* List of Dealers Cards */}
          <div className="space-y-4">
            {dealers.map((dealer, dIdx) => (
              <div
                key={dealer.id}
                className="glass-panel-white p-3.5 sm:p-4 rounded-2xl border border-indigo-100 shadow-2xs relative space-y-3"
              >
                {/* Dealer Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-100/80">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 shadow-xs">
                      {dIdx + 1}
                    </span>
                    <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <input
                      type="text"
                      value={dealer.dealerName}
                      onChange={(e) => handleUpdateDealerName(dIdx, e.target.value)}
                      placeholder="ระบุชื่อ Dealer เช่น ป.ยานยนต์(สนญ.)"
                      className="flex-1 glass-input-field px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 border border-indigo-200/80 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Duplicate button */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateDealer(dIdx)}
                      className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center gap-1 border border-indigo-200 transition-colors cursor-pointer"
                      title="คัดลอกโครงสร้างดีลเลอร์นี้"
                    >
                      <CopyPlus className="w-3 h-3" />
                      <span className="hidden sm:inline">คัดลอก</span>
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveDealer(dIdx)}
                      className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      title={dealers.length > 1 ? 'ลบดีลเลอร์นี้' : 'รีเซ็ตดีลเลอร์นี้'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Preset Chips for Dealer Name */}
                <div className="flex flex-wrap gap-1 items-center pt-0.5">
                  <span className="text-[9.5px] text-slate-400 font-medium">ชื่อแนะนำ:</span>
                  {DEALER_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        handleUpdateDealerName(dIdx, preset);
                      }}
                      className={`text-[9.5px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        dealer.dealerName === preset
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                          : 'bg-white hover:bg-indigo-50 text-slate-600 border-slate-200 font-medium'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Finances Section for this Dealer */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <span>ยอดของแต่ละไฟแนนซ์ ({dealer.finances.length} รายการ)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      ใส่จำนวน เช่น 1, 0, 1A, 2A
                    </span>
                  </div>

                  {/* Finance items grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {dealer.finances.map((f, fIdx) => {
                      const isNextCapital = f.name.toLowerCase().includes('next capital');
                      return (
                        <div
                          key={f.id}
                          className={`p-2.5 rounded-xl border transition-all space-y-1.5 ${
                            isNextCapital
                              ? 'bg-gradient-to-br from-blue-50/80 via-white to-sky-50/60 border-blue-200 shadow-2xs ring-1 ring-blue-400/30'
                              : 'bg-slate-50/70 border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <input
                              type="text"
                              value={f.name}
                              onChange={(e) =>
                                handleUpdateFinance(dIdx, fIdx, 'name', e.target.value)
                              }
                              placeholder="ชื่อไฟแนนซ์"
                              className={`flex-1 text-[11px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1 py-0.5 rounded outline-none ${
                                isNextCapital ? 'text-blue-900' : 'text-slate-800'
                              }`}
                            />
                            {isNextCapital && (
                              <span className="text-[8.5px] font-extrabold px-1.5 py-0.2 rounded bg-blue-600 text-white shadow-2xs shrink-0">
                                NCAP
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveFinance(dIdx, fIdx)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                              title="ลบไฟแนนซ์นี้"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={f.value}
                              onChange={(e) =>
                                handleUpdateFinance(dIdx, fIdx, 'value', e.target.value)
                              }
                              placeholder="0 หรือ 1A"
                              className={`w-20 px-2 py-1 rounded-lg text-xs font-mono font-bold text-center border outline-none shadow-2xs ${
                                isNextCapital
                                  ? 'bg-white text-blue-900 border-blue-300 focus:ring-1 focus:ring-blue-500'
                                  : 'bg-white text-slate-800 border-slate-300 focus:ring-1 focus:ring-indigo-500'
                              }`}
                            />

                            {/* Quick Value Buttons */}
                            <div className="flex gap-0.5 flex-wrap flex-1">
                              {QUICK_VALUE_PRESETS.map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    handleUpdateFinance(dIdx, fIdx, 'value', val);
                                  }}
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border transition-all cursor-pointer ${
                                    f.value === val
                                      ? isNextCapital
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-700 text-white border-slate-700'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Finance Buttons / Presets */}
                  <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddFinance(dIdx)}
                      className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มไฟแนนซ์</span>
                    </button>

                    <span className="text-[10px] text-slate-400 font-medium ml-1">
                      หรือเพิ่มด่วน:
                    </span>
                    {QUICK_FINANCE_PRESETS.filter(
                      (p) => !dealer.finances.some((f) => f.name.toLowerCase() === p.toLowerCase())
                    )
                      .slice(0, 5)
                      .map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAddFinance(dIdx, preset)}
                          className="text-[9.5px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Dealer Big Button */}
          <div className="pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => handleAddDealer()}
              className="w-full sm:w-auto min-w-[220px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-sky-600 hover:from-indigo-600 hover:to-sky-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>เพิ่ม Dealer ใหม่ (+ เพิ่มร้านค้า)</span>
            </button>
          </div>

          {/* Live LINE Message Preview Box */}
          <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-sky-50/60 border border-indigo-200/80 shadow-2xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-200/70 text-[11px]">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#06c755] animate-pulse" />
                ตัวอย่างข้อความรายงานที่จะส่งเข้า LINE :
              </span>
              <span className="text-[10px] text-indigo-900 font-semibold bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-full shadow-2xs">
                {dealers.length} ดีลเลอร์ • {generateReportText().length} ตัวอักษร
              </span>
            </div>
            <pre className="font-mono text-xs sm:text-[12.5px] leading-relaxed whitespace-pre-wrap text-slate-900 select-text bg-white/95 p-3 rounded-xl border border-indigo-200/70 shadow-2xs">
              {generateReportText()}
            </pre>
          </div>

          {/* Action Buttons: คัดลอก & ส่ง Line อยู่แถวเดียวกันกึ่งกลาง */}
          <div className="pt-2 flex flex-row items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Copy Text Button */}
            <button
              type="button"
              onClick={handleCopyReport}
              className="flex-1 sm:flex-initial sm:min-w-[175px] justify-center px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs font-bold flex items-center gap-2 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">คัดลอกเรียบร้อย!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-700" />
                  <span>คัดลอกข้อความ</span>
                </>
              )}
            </button>

            {/* Send to LINE Button */}
            <button
              type="button"
              onClick={handleSendLine}
              className="flex-1 sm:flex-initial sm:min-w-[175px] justify-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-[#06c755] to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-sm shadow-emerald-500/30 transition-all active:scale-95 cursor-pointer"
            >
              {lineSentFeedback ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>คัดลอก & กำลังส่ง LINE!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-white" />
                  <span>ส่ง Line</span>
                  <ExternalLink className="w-3 h-3 text-emerald-200" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
