import React, { useState } from 'react';
import { X, Search, Sparkles, Bike } from 'lucide-react';
import { BIKE_PRESETS, PROPOSALS } from '../data/proposals';
import { BikePreset, ProposalKey } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectBike: (bike: BikePreset) => void;
  currentProposalKey: ProposalKey;
}

export const BikePresetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectBike,
}) => {
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const brands = ['all', 'Honda', 'Yamaha', 'Vespa', 'Lambretta', 'Other'];

  const filteredBikes = BIKE_PRESETS.filter((bike) => {
    const matchesBrand =
      selectedBrand === 'all' ||
      bike.brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesSearch =
      bike.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      PROPOSALS[bike.proposalKey].name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div 
        className="ios-glass-modal rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300"
        style={{
          boxShadow: '0 30px 60px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.7) inset'
        }}
      >
        {/* iOS Top Pull Indicator */}
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 bg-slate-400/40 rounded-full" />
        </div>

        {/* Header - iOS Glass Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-white/60 bg-white/40 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 ring-1 ring-white/50 shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                เลือกรุ่นรถจักรยานยนต์ยอดนิยม
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                ข้อมูลราคาแนะนำทางการ (MSRP) อัปเดตล่าสุด 2568 - 2569 พร้อมผูก Proposal ให้อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-300/80 active:scale-90 text-slate-600 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer ring-1 ring-white/70 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source & Updated Badge Banner - iOS Frosted Banner */}
        <div className="mx-4 sm:mx-6 my-2.5 px-3.5 py-2 bg-gradient-to-r from-blue-500/10 via-indigo-500/8 to-purple-500/10 backdrop-blur-md rounded-2xl border border-white/70 flex items-center justify-between text-[11px] sm:text-xs text-slate-700 shadow-2xs gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-indigo-900">🏷️ ราคาเผยแพร่ทางการ (MSRP):</span>
            <span className="text-slate-600">อ้างอิงจาก Thai Honda, Yamaha, Vespa และ Lambretta</span>
          </div>
          <span className="font-bold text-indigo-700 bg-white/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white text-[10.5px] shadow-2xs">
            พร้อมใช้งาน {BIKE_PRESETS.length} รุ่น
          </span>
        </div>

        {/* Search & Filter - iOS Spotlight & Segmented Control */}
        <div className="px-4 sm:px-6 pb-3 pt-0.5 space-y-2.5 border-b border-white/50 bg-white/20 backdrop-blur-md shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อรุ่นรถ เช่น Wave, PCX, Fazzio, Sprint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-white/60 hover:bg-white/80 focus:bg-white/95 backdrop-blur-md border border-white/80 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-inner/5"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* iOS Segmented Control */}
          <div className="p-1 bg-slate-200/50 backdrop-blur-xl rounded-xl flex items-center gap-1 border border-white/60 overflow-x-auto no-scrollbar">
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`flex-1 min-w-[70px] py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer text-center ${
                  selectedBrand === brand
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                {brand === 'all'
                  ? 'ทั้งหมด'
                  : brand === 'Other'
                  ? 'อื่นๆ'
                  : brand}
              </button>
            ))}
          </div>
        </div>

        {/* Bike list - iOS Glass Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredBikes.map((bike) => {
            const proposal = PROPOSALS[bike.proposalKey];
            return (
              <div
                key={bike.id}
                onClick={() => {
                  onSelectBike(bike);
                  onClose();
                }}
                className="ios-glass-card rounded-2xl p-3.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between text-left active:scale-[0.985]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-bold text-xs sm:text-[13px] text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {bike.name}
                    </span>
                    {bike.popular && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-800 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap backdrop-blur-xs">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" /> นิยม
                      </span>
                    )}
                  </div>
                  {bike.badge && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                      {bike.badge}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-200/50 flex items-end justify-between">
                  <div>
                    <div className="text-[9.5px] text-slate-400 font-medium">ราคาแนะนำทางการ (MSRP)</div>
                    <div className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      ฿{bike.price.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-lg bg-indigo-50/80 text-indigo-700 border border-indigo-100/70 shadow-2xs">
                      {proposal.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredBikes.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 text-xs">
              <div className="w-12 h-12 rounded-2xl bg-white/60 mx-auto flex items-center justify-center text-slate-400 mb-2 border border-white/80">
                <Search className="w-6 h-6" />
              </div>
              <p className="font-medium">ไม่พบรุ่นรถที่ค้นหา</p>
              <p className="text-[11px] text-slate-400 mt-0.5">ลองเปลี่ยนคำค้นหาหรือเลือกดูแบรนด์อื่น</p>
            </div>
          )}
        </div>

        {/* Footer - iOS Frosted Glass Footer */}
        <div className="px-5 sm:px-6 py-3 bg-white/40 backdrop-blur-xl border-t border-white/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            พบทั้งหมด <span className="text-slate-800 font-bold">{filteredBikes.length}</span> รุ่น
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200/70 hover:bg-slate-300/80 active:scale-95 text-slate-700 rounded-xl font-semibold text-xs transition-all backdrop-blur-md border border-white/60 shadow-xs cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};
