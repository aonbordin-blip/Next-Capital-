import React, { useState, useMemo } from 'react';
import { X, Search, Sparkles, Bike, Tag, Check, Layers } from 'lucide-react';
import { BIKE_PRESETS, PROPOSALS } from '../data/proposals';
import { BikePreset, ProposalKey } from '../types';
import { getAllMotorcycleModels, MotorcycleModel } from '../data/motorcycleModels';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectBike: (bike: BikePreset) => void;
  currentProposalKey: ProposalKey;
}

// Convert a database model to a BikePreset
function modelToPreset(model: MotorcycleModel): BikePreset {
  const brandLower = (model.brand || 'Honda').toLowerCase();
  let proposalKey: ProposalKey = 'small_bike';
  const nameUpper = model.name.toUpperCase();
  const codeUpper = model.code.toUpperCase();

  if (nameUpper.includes('FAZZIO') || codeUpper.startsWith('BKF')) {
    proposalKey = 'fazzio';
  } else if (
    nameUpper.includes('PCX') ||
    codeUpper.startsWith('WW160') ||
    nameUpper.includes('CLICK 160') ||
    nameUpper.includes('CLICK160') ||
    codeUpper.startsWith('ACB160') ||
    nameUpper.includes('AEROX') ||
    codeUpper.startsWith('BWR') ||
    nameUpper.includes('GRAND FILANO') ||
    codeUpper.startsWith('BJK') ||
    nameUpper.includes('NMAX') ||
    codeUpper.startsWith('BTF') ||
    codeUpper.startsWith('BTM') ||
    (nameUpper.includes('ADV') && !nameUpper.includes('ADV350') && !codeUpper.startsWith('ADV350'))
  ) {
    proposalKey = 'top_small';
  } else if (
    nameUpper.includes('FORZA') ||
    codeUpper.startsWith('NSS350') ||
    nameUpper.includes('ADV350') ||
    codeUpper.startsWith('ADV350') ||
    nameUpper.includes('XMAX') ||
    codeUpper.startsWith('DR9') ||
    codeUpper.startsWith('BKAW') ||
    nameUpper.includes('CBR') ||
    codeUpper.startsWith('CBR') ||
    nameUpper.includes('CB') ||
    codeUpper.startsWith('CBF') ||
    nameUpper.includes('CL300') ||
    codeUpper.startsWith('CL300') ||
    nameUpper.includes('MT-15') ||
    codeUpper.startsWith('B7D') ||
    nameUpper.includes('XSR') ||
    codeUpper.startsWith('B1V') ||
    nameUpper.includes('WR155') ||
    codeUpper.startsWith('B3M') ||
    codeUpper.startsWith('WR155') ||
    nameUpper.includes('PG-1') ||
    codeUpper.startsWith('BKW') ||
    codeUpper.startsWith('D18') ||
    nameUpper.includes('EXCITER') ||
    codeUpper.startsWith('BAW') ||
    codeUpper.startsWith('BWK') ||
    nameUpper.includes('R3') ||
    codeUpper.startsWith('BRA') ||
    nameUpper.includes('SR400') ||
    codeUpper.startsWith('B9F') ||
    nameUpper.includes('R15') ||
    codeUpper.startsWith('BNC')
  ) {
    proposalKey = 'honda_yamaha';
  }

  const brand: 'Honda' | 'Yamaha' | 'Vespa' | 'Lambretta' | 'Other' =
    brandLower === 'yamaha' ? 'Yamaha' :
    brandLower === 'vespa' ? 'Vespa' :
    brandLower === 'lambretta' ? 'Lambretta' :
    brandLower === 'other' ? 'Other' : 'Honda';

  return {
    id: `db-${model.id}`,
    code: model.code,
    name: model.name,
    brand,
    price: model.price || 0,
    proposalKey,
    defaultDownPercent: proposalKey === 'small_bike' || proposalKey === 'fazzio' ? 10 : 15,
    badge: 'ราคาทางการ Next Capital (Max N/F*)',
    popular: model.isSpecial,
  };
}

export const BikePresetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectBike,
}) => {
  const [viewMode, setViewMode] = useState<'popular' | 'all_db'>('popular');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // All models from Next Capital database + custom
  const allDbModels = useMemo(() => {
    return getAllMotorcycleModels();
  }, []);

  if (!isOpen) return null;

  const brands = ['all', 'Honda', 'Yamaha', 'Vespa', 'Lambretta', 'Other'];

  // Combine or filter bike list
  const displayList: BikePreset[] = viewMode === 'popular'
    ? BIKE_PRESETS
    : allDbModels.map(modelToPreset);

  const filteredBikes = displayList.filter((bike) => {
    const matchesBrand =
      selectedBrand === 'all' ||
      bike.brand.toLowerCase() === selectedBrand.toLowerCase();

    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return matchesBrand;

    const matchesName = bike.name.toLowerCase().includes(cleanQuery);
    const matchesCode = bike.code ? bike.code.toLowerCase().includes(cleanQuery) : false;
    const matchesProposal = PROPOSALS[bike.proposalKey]?.name.toLowerCase().includes(cleanQuery) || false;

    return matchesBrand && (matchesName || matchesCode || matchesProposal);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 animate-fade-in">
      <div className="bg-white rounded-[28px] sm:rounded-[32px] w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
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
                อัปเดตข้อมูล รหัสรุ่น, ชื่อรถ, และราคารถตาม Price List ล่าสุด Next Capital (Max N/F*)
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

        {/* Toggle Mode: รุ่นยอดนิยม vs ทุกรุ่นใน Price List Next Capital */}
        <div className="px-4 sm:px-6 pt-2.5 pb-1 bg-white/20 backdrop-blur-md shrink-0">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/50 rounded-2xl border border-white/60">
            <button
              onClick={() => setViewMode('popular')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'popular'
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>รุ่นยอดนิยม ({BIKE_PRESETS.length} รุ่นเด่น)</span>
            </button>
            <button
              onClick={() => setViewMode('all_db')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'all_db'
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>ทุกรุ่นใน Price List ({allDbModels.length} รุ่น)</span>
            </button>
          </div>
        </div>

        {/* Source & Updated Badge Banner - iOS Frosted Banner */}
        <div className="mx-4 sm:mx-6 my-2 px-3.5 py-1.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/8 to-purple-500/10 backdrop-blur-md rounded-2xl border border-white/70 flex items-center justify-between text-[11px] sm:text-xs text-slate-700 shadow-2xs gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-indigo-900">🏷️ ราคาทางการ Next Capital:</span>
            <span className="text-slate-600">อัปเดต รหัสรุ่น, ชื่อรถ, ราคารถ (Max N/F*) ครบถ้วน</span>
          </div>
          <span className="font-bold text-indigo-700 bg-white/80 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white text-[10.5px] shadow-2xs">
            แสดง {filteredBikes.length} รุ่น
          </span>
        </div>

        {/* Search & Filter - iOS Spotlight & Segmented Control */}
        <div className="px-4 sm:px-6 pb-2.5 space-y-2 border-b border-white/50 bg-white/20 backdrop-blur-md shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสรุ่นรถ หรือ ชื่อรถ เช่น ACF125, WAVE, PCX, BJK400, FAZZIO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-white/70 hover:bg-white/90 focus:bg-white backdrop-blur-md border border-white/80 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all shadow-inner/5"
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
                className={`flex-1 min-w-[65px] py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer text-center ${
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
                className="ios-glass-card rounded-2xl p-3.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between text-left active:scale-[0.985] hover:border-indigo-400/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs sm:text-[13px] text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">
                        {bike.name}
                      </div>
                      {bike.code && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/60 text-indigo-700 font-mono text-[10.5px] font-bold tracking-wider mt-1 shadow-2xs">
                          <Tag className="w-2.5 h-2.5" />
                          {bike.code}
                        </div>
                      )}
                    </div>
                    {bike.popular && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-800 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap backdrop-blur-xs shrink-0">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" /> ยอดนิยม
                      </span>
                    )}
                  </div>
                  {bike.badge && (
                    <p className="text-[10.5px] text-slate-500 line-clamp-1 mb-2">
                      {bike.badge}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-200/50 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[9.5px] text-slate-400 font-medium">
                      {bike.code ? 'ราคาทางการ Next Capital (Max N/F*)' : 'ราคาแนะนำทางการ (MSRP)'}
                    </div>
                    <div className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      ฿{bike.price.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50/90 text-indigo-700 border border-indigo-200/70 shadow-2xs">
                      {proposal?.name || 'โปรโมชันพิเศษ'}
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
              <p className="font-medium text-slate-700">ไม่พบรุ่นรถที่ค้นหา</p>
              <p className="text-[11px] text-slate-400 mt-0.5">ลองค้นหาด้วยรหัสรุ่น (เช่น ACF125, BJK) หรือชื่อรุ่น (Wave, Giorno, PCX)</p>
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
