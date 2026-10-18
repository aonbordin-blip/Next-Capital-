import React, { useState, useRef, useEffect } from 'react';
import { Search, Tag, X, Check, ChevronDown, Sparkles } from 'lucide-react';
import { MOTORCYCLE_MODELS, MotorcycleModel, searchMotorcycleModels, findModelByCode } from '../data/motorcycleModels';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelectModel?: (model: MotorcycleModel) => void;
  selectedModelName?: string;
}

export const BikeModelCodeInput: React.FC<Props> = ({
  value,
  onChange,
  onSelectModel,
  selectedModelName,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>(value);
  const [brandFilter, setBrandFilter] = useState<'all' | 'HONDA' | 'YAMAHA'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep internal query synchronized and formatted in uppercase
  useEffect(() => {
    setQuery(value ? value.toUpperCase() : '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const rawResults = searchMotorcycleModels(query);
  const results = rawResults.filter((m) => {
    if (brandFilter === 'all') return true;
    return m.brand?.toUpperCase() === brandFilter;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert all English characters to uppercase immediately
    const upperVal = e.target.value.toUpperCase();
    setQuery(upperVal);
    onChange(upperVal);
    setIsOpen(true);
  };

  const handleSelect = (model: MotorcycleModel) => {
    triggerHaptic('selection');
    const upperCode = model.code.toUpperCase();
    setQuery(upperCode);
    onChange(upperCode);
    setIsOpen(false);
    if (onSelectModel) {
      onSelectModel(model);
    }
  };

  const handleClear = () => {
    triggerHaptic('light');
    setQuery('');
    onChange('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Find matching model if exists using findModelByCode or exact match
  const matchedModel = findModelByCode(value) || MOTORCYCLE_MODELS.find(
    (m) => m.code.toUpperCase() === value.trim().toUpperCase()
  );

  return (
    <div ref={containerRef} className="relative">
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

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-3.5 h-3.5 text-blue-600" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="พิมพ์รหัสหรือชื่อรุ่น เช่น FAZZIO, PG-1, NMAX, WR155, GIORNO, PCX"
          className="w-full glass-input-field rounded-xl pl-8 pr-8 py-2 text-xs text-blue-950 font-bold font-mono uppercase tracking-wide outline-none hover:border-blue-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-slate-400"
        />

        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              title="ล้างข้อมูล"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Matched Model Neat Status Card */}
      {matchedModel && (
        <div className="mt-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white rounded-xl border border-blue-200/80 flex items-center justify-between text-xs shadow-2xs animate-fade-in">
          <div className="flex items-center gap-1.5 truncate">
            {matchedModel.brand && (
              <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded shadow-2xs ${
                matchedModel.brand === 'YAMAHA' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-800 text-white'
              }`}>
                {matchedModel.brand}
              </span>
            )}
            <span className="font-mono text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200/90 tracking-wide uppercase shadow-2xs">
              {matchedModel.code}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-bold text-slate-800 truncate">
              {matchedModel.name}
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1 flex-shrink-0">
            <Check className="w-3 h-3" /> ตรวจพบในระบบ
          </span>
        </div>
      )}

      {/* Autocomplete Dropdown List with Modern Brand Filter Pills */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-blue-200/90 overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header & Quick Brand Tabs */}
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 border-b border-slate-200/80 sticky top-0 backdrop-blur-md z-10 space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="flex items-center gap-1.5 text-blue-900 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                เลือกรหัสรุ่น ({results.length} รุ่น)
              </span>
              <span className="text-slate-400 text-[10px]">คลิกเพื่อเลือกทันที</span>
            </div>

            {/* Brand Filter Buttons */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">ยี่ห้อ:</span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBrandFilter('all');
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  brandFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBrandFilter('HONDA');
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  brandFilter === 'HONDA'
                    ? 'bg-gradient-to-r from-slate-800 to-indigo-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                HONDA
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBrandFilter('YAMAHA');
                }}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  brandFilter === 'YAMAHA'
                    ? 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-xs'
                    : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                }`}
              >
                YAMAHA
              </button>
            </div>
          </div>

          {results.length > 0 ? (
            <div className="divide-y divide-slate-100/80">
              {results.map((m, idx) => {
                const isSelected = value.trim().toUpperCase() === m.code.toUpperCase();
                return (
                  <button
                    key={m.id || idx}
                    type="button"
                    onClick={() => handleSelect(m)}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-3 hover:bg-blue-50/80 transition-all cursor-pointer group ${
                      isSelected ? 'bg-blue-50/90 border-l-4 border-l-blue-600 pl-2.5 font-semibold' : ''
                    }`}
                  >
                    {/* Left: Model Code in Monospace & Brand */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {m.brand && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs shrink-0 ${
                          isSelected
                            ? 'bg-blue-900 text-white'
                            : m.brand === 'YAMAHA'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {m.brand}
                        </span>
                      )}
                      <span className={`font-mono text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-blue-700 text-white'
                          : m.isGreen
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
                          : 'bg-slate-100 text-slate-800 border border-slate-200/70 group-hover:bg-blue-100 group-hover:text-blue-900'
                      }`}>
                        {m.code}
                      </span>
                    </div>

                    {/* Right: Model Name & Status */}
                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <span className={`text-xs ${isSelected ? 'font-bold text-blue-950' : 'font-medium text-slate-700 group-hover:text-blue-900'}`}>
                        {m.name}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-5 text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">ไม่พบรหัสรุ่นที่ตรงกับ "{query}"</p>
              <p className="text-[10.5px] text-slate-400">
                สามารถใช้รหัสนี้ได้โดยตรง ระบบจะแปลงเป็นตัวพิมพ์ใหญ่และนำไปแสดงในใบเสนอราคาให้ทันที
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
