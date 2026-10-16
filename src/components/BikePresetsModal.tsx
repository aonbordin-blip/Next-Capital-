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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-xl shadow-sm">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                เลือกรุ่นรถจักรยานยนต์ยอดนิยม
              </h2>
              <p className="text-xs text-slate-500">
                ข้อมูลราคาแนะนำทางการ (MSRP) อัปเดตล่าสุด 2568 - 2569 พร้อมผูก Proposal ให้อัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source & Updated Badge Banner */}
        <div className="px-6 py-2 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-purple-50/50 border-b border-blue-100/80 flex items-center justify-between text-[11px] text-blue-950 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-blue-800">🏷️ ราคาเผยแพร่ทางการ (MSRP):</span>
            <span className="text-slate-600">อ้างอิงจาก Thai Honda, Yamaha, Vespa และ Lambretta ประเทศไทย</span>
          </div>
          <span className="font-bold text-blue-800 bg-white/80 px-2.5 py-0.5 rounded-full border border-blue-200/80 text-[10.5px] shadow-2xs">
            พร้อมใช้งาน {BIKE_PRESETS.length} รุ่น
          </span>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-200/60 space-y-3 bg-white/70">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อรุ่นรถ เช่น Wave, PCX, Fazzio, Sprint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedBrand === brand
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {brand === 'all'
                  ? 'ทั้งหมด'
                  : brand === 'Other'
                  ? 'มือสอง / อื่นๆ'
                  : brand}
              </button>
            ))}
          </div>
        </div>

        {/* Bike list */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredBikes.map((bike) => {
            const proposal = PROPOSALS[bike.proposalKey];
            return (
              <div
                key={bike.id}
                onClick={() => {
                  onSelectBike(bike);
                  onClose();
                }}
                className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-xs text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {bike.name}
                    </span>
                    {bike.popular && (
                      <span className="flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200/80 px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" /> นิยม
                      </span>
                    )}
                  </div>
                  {bike.badge && (
                    <p className="text-[11px] text-slate-500 mb-2">
                      {bike.badge}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">ราคาแนะนำทางการ (MSRP)</div>
                    <div className="text-sm font-bold text-slate-900">
                      ฿{bike.price.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {proposal.name}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredBikes.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 text-xs">
              ไม่พบรุ่นรถที่ค้นหา ลองเปลี่ยนคำค้นหา
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-xs transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};
