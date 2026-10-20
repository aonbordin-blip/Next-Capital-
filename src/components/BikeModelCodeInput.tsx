import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Tag, X, Check, ChevronRight, Sparkles, Filter, Bike, CheckCircle2 } from 'lucide-react';
import { MOTORCYCLE_MODELS, MotorcycleModel, searchMotorcycleModels, findModelByCode } from '../data/motorcycleModels';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelectModel?: (model: MotorcycleModel) => void;
  selectedModelName?: string;
}

// Popular keyword chips for quick one-tap search
const QUICK_CHIPS = [
  'GIORNO+',
  'WAVE 110',
  'WAVE 125',
  'LEAD 125',
  'PCX 160',
  'FAZZIO',
  'PG-1',
  'NMAX',
  'GRAND FILANO',
  'AEROX',
];

export const BikeModelCodeInput: React.FC<Props> = ({
  value,
  onChange,
  onSelectModel,
  selectedModelName,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBrand, setActiveBrand] = useState<'all' | 'HONDA' | 'YAMAHA' | 'with_price'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync search query and auto-focus when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setSearchQuery(value ? value.toUpperCase() : '');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, value]);

  // Lock background scrolling when modal is active
  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isModalOpen]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Matched model lookup for selected value
  const matchedModel = useMemo(() => {
    if (!value) return undefined;
    return (
      findModelByCode(value) ||
      MOTORCYCLE_MODELS.find((m) => m.code.toUpperCase() === value.trim().toUpperCase())
    );
  }, [value]);

  // Filter models based on search query and brand selection
  const filteredModels = useMemo(() => {
    let list = MOTORCYCLE_MODELS;

    if (searchQuery.trim()) {
      list = searchMotorcycleModels(searchQuery);
    }

    if (activeBrand === 'HONDA') {
      list = list.filter((m) => m.brand === 'HONDA');
    } else if (activeBrand === 'YAMAHA') {
      list = list.filter((m) => m.brand === 'YAMAHA');
    } else if (activeBrand === 'with_price') {
      list = list.filter((m) => typeof m.price === 'number' && m.price > 0);
    }

    return list;
  }, [searchQuery, activeBrand]);

  const handleOpen = () => {
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const handleSelect = (model: MotorcycleModel) => {
    const upperCode = model.code.toUpperCase();
    onChange(upperCode);
    if (onSelectModel) {
      onSelectModel(model);
    }
    setIsModalOpen(false);
  };

  const handleUseCustomQuery = () => {
    if (!searchQuery.trim()) return;
    const clean = searchQuery.trim().toUpperCase();
    onChange(clean);
    setIsModalOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  const handleChipClick = (chip: string) => {
    if (searchQuery.toUpperCase() === chip.toUpperCase()) {
      setSearchQuery('');
    } else {
      setSearchQuery(chip);
    }
  };

  return (
    <div>
      {/* Label & Actions in Main Form */}
      <div className="flex justify-between items-center mb-1">
        <label className="text-[11px] text-slate-700 font-bold flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
          <span>รหัสรุ่นรถ (MODEL CODE)</span>
        </label>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-slate-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer font-medium transition-colors"
          >
            <X className="w-3 h-3" /> ล้างรหัส
          </button>
        )}
      </div>

      {/* Main Trigger Field - Clean, Responsive iOS Input Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        className="w-full glass-input-field rounded-xl px-3 py-2 flex items-center justify-between cursor-pointer group hover:border-blue-400 hover:bg-white/90 transition-all text-left select-none shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Search className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />

          {value ? (
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {matchedModel?.brand && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 ${
                    matchedModel.brand === 'YAMAHA' ? 'bg-blue-600' : 'bg-red-600'
                  }`}
                >
                  {matchedModel.brand}
                </span>
              )}
              <span className="font-mono text-xs font-bold text-blue-950 uppercase tracking-wide shrink-0">
                {value}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-slate-700 truncate">
                {matchedModel?.name || selectedModelName || 'รหัสรุ่นที่กำหนด'}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 group-hover:text-slate-600 truncate">
              แตะเพื่อค้นหารหัสรุ่นรถ (GIORNO, WAVE, PCX, FAZZIO...)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {matchedModel?.price && (
            <span className="font-mono text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80 hidden sm:inline-block">
              ฿{matchedModel.price.toLocaleString()}
            </span>
          )}
          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white px-2 py-0.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-0.5">
            <span>{value ? 'เปลี่ยน' : 'ค้นหา'}</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Confirmed Model Status Badge */}
      {matchedModel && (
        <div className="mt-1 px-2.5 py-1 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white rounded-lg border border-blue-200/70 flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-emerald-700 font-semibold flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ตรวจพบ:
            </span>
            <span className="font-bold text-slate-800 truncate">{matchedModel.name}</span>
            {matchedModel.price && (
              <span className="font-mono font-bold text-blue-900 shrink-0">
                (฿{matchedModel.price.toLocaleString()})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="text-blue-700 font-semibold hover:underline cursor-pointer shrink-0 ml-2"
          >
            เลือกใหม่
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL - MOUNTED DIRECTLY TO document.body VIA createPortal        */}
      {/* (Never trapped by any parent backdrop-filter, transform, or overflow)   */}
      {/* ========================================================================= */}
      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div
              className="ios-glass-modal rounded-[28px] sm:rounded-[32px] w-full max-w-xl max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden transition-all duration-300"
              style={{
                boxShadow:
                  '0 30px 60px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.75) inset',
              }}
            >
              {/* iOS Top Pull Indicator */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 bg-slate-400/40 rounded-full" />
              </div>

              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/60 bg-white/40 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 ring-1 ring-white/50 shrink-0">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                      <span>ค้นหารหัสรุ่นรถจักรยานยนต์</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500">
                      ตารางรหัสรุ่นทางการ Next Capital • HONDA & YAMAHA
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="ปิดหน้าต่าง"
                  className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-300/80 active:scale-90 text-slate-600 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer ring-1 ring-white/70 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Filter - iOS Spotlight & Segmented Control */}
              <div className="px-4 sm:px-6 pb-3 pt-2.5 space-y-2.5 border-b border-white/50 bg-white/20 backdrop-blur-md shrink-0">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="ค้นหารหัสหรือชื่อรุ่น เช่น ACF125, GIORNO, WAVE, PCX..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-9 py-2 bg-white/60 hover:bg-white/80 focus:bg-white/95 backdrop-blur-md border border-white/80 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-inner/5 tracking-wide uppercase"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* iOS Segmented Control */}
                <div className="p-1 bg-slate-200/50 backdrop-blur-xl rounded-xl flex items-center gap-1 border border-white/60 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'HONDA', label: '🔴 HONDA' },
                    { id: 'YAMAHA', label: '🔵 YAMAHA' },
                    { id: 'with_price', label: '💎 มีราคาทางการ' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveBrand(tab.id as typeof activeBrand)}
                      className={`flex-1 min-w-[70px] py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer text-center ${
                        activeBrand === tab.id
                          ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Quick Search Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0 flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3 text-amber-500" /> แตะค้นหาด่วน:
                  </span>
                  {QUICK_CHIPS.map((chip) => {
                    const isActive = searchQuery.toUpperCase().includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChipClick(chip)}
                        className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white/70 hover:bg-white text-slate-700 border-white/80'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Counter / Direct custom code banner */}
              <div className="px-5 py-2 bg-white/30 backdrop-blur-md border-b border-white/40 flex items-center justify-between text-[11px] shrink-0">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-600" />
                  พบ <b className="text-slate-800 font-bold">{filteredModels.length}</b> รุ่น
                </span>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={handleUseCustomQuery}
                    className="text-indigo-700 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-white/80 px-2.5 py-0.5 rounded-lg border border-indigo-200/80 shadow-2xs"
                  >
                    <span>ใช้รหัส "{searchQuery}" นี้โดยตรง</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Models List - Compact, Elegant iOS Glass Rows */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2">
                {filteredModels.map((m) => {
                  const isSelected = value.trim().toUpperCase() === m.code.toUpperCase();
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelect(m)}
                      className={`ios-glass-card rounded-2xl p-3 transition-all duration-200 cursor-pointer group flex items-center justify-between gap-3 text-left active:scale-[0.985] ${
                        isSelected
                          ? 'bg-indigo-50/90 ring-2 ring-indigo-600 border-indigo-300 shadow-sm'
                          : 'hover:bg-white/90'
                      }`}
                    >
                      {/* Left: Brand Badge & Monospace Code */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {m.brand && (
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? 'bg-indigo-900 text-white'
                                  : m.brand === 'YAMAHA'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {m.brand}
                            </span>
                          )}
                          <span
                            className={`font-mono text-xs sm:text-[13px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-indigo-700 text-white'
                                : m.isSpecial
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200/70 group-hover:bg-indigo-50 group-hover:text-indigo-900'
                            }`}
                          >
                            {m.code}
                          </span>
                        </div>

                        <div className="font-bold text-xs sm:text-[13px] text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                          {m.name}
                        </div>
                      </div>

                      {/* Right: Max Tax Price & Action */}
                      <div className="text-right shrink-0 flex items-center gap-2">
                        {m.price ? (
                          <div>
                            <div className="text-[9px] text-slate-400 font-medium">ราคา Max Tax</div>
                            <div className="font-mono text-xs sm:text-sm font-black text-indigo-700">
                              ฿{m.price.toLocaleString()}
                            </div>
                          </div>
                        ) : null}

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Empty State */}
                {filteredModels.length === 0 && (
                  <div className="py-10 px-4 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-white/70 mx-auto flex items-center justify-center text-slate-400 border border-white/80 shadow-xs">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">ไม่พบรหัสรุ่นที่ตรงกับการค้นหา</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        สามารถใช้รหัส "{searchQuery}" นี้ได้โดยตรง
                      </p>
                    </div>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={handleUseCustomQuery}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>ใช้รหัส "{searchQuery}"</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-white/60 bg-white/40 backdrop-blur-xl flex items-center justify-between text-xs shrink-0">
                <span className="text-[11px] text-slate-500">
                  แตะเลือกรุ่นเพื่ออัปเดตราคาเข้าสู่การคำนวณทันที
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
