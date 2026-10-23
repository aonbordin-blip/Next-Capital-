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
} from 'lucide-react';
import { SavedCaseRecord } from '../types';
import { formatBaht } from '../data/proposals';
import { triggerHaptic } from '../utils/haptics';
import {
  getSavedCases,
  deleteCaseRecord,
  updateCaseTitle,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [previewCase, setPreviewCase] = useState<SavedCaseRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);

  // Load cases when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCases(getSavedCases());
      setSearchQuery('');
      setEditingId(null);
      setPreviewCase(null);
      setDeleteConfirmId(null);
      setShowClearAllConfirm(false);
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase().trim();
    return cases.filter((c) => {
      const titleMatch = c.caseTitle.toLowerCase().includes(q);
      const custMatch = c.customerName.toLowerCase().includes(q);
      const phoneMatch = c.customerPhone?.toLowerCase().includes(q);
      const bikeMatch = c.bikeModelName?.toLowerCase().includes(q);
      const codeMatch = c.bikeModelCode?.toLowerCase().includes(q);
      const proposalMatch = c.snapshot.proposalCode.toLowerCase().includes(q);
      return titleMatch || custMatch || phoneMatch || bikeMatch || codeMatch || proposalMatch;
    });
  }, [cases, searchQuery]);

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

  const handleExport = () => {
    triggerHaptic('success');
    const jsonStr = exportCasesAsJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MotoLease_Saved_Cases_${new Date().toISOString().slice(0, 10)}.json`;
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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                  เคสที่บันทึกไว้ในอุปกรณ์
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  {cases.length} รายการ
                </span>
              </div>
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

              <button
                type="button"
                onClick={handleExport}
                disabled={cases.length === 0}
                className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 font-medium text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap"
                title="ดาวน์โหลดไฟล์สำรองข้อมูล (JSON)"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">สำรองไฟล์</span>
              </button>

              <label
                className="px-2.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1 border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap"
                title="นำเข้าไฟล์สำรองข้อมูล (JSON)"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">นำเข้า</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>

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
            <div className="grid grid-cols-1 gap-3">
              {filteredCases.map((record) => {
                const isEditing = editingId === record.id;
                const isCurrentEditing = activeEditingId === record.id;
                return (
                  <div
                    key={record.id}
                    className={`p-3.5 sm:p-4 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all duration-200 space-y-2.5 relative group ${
                      isCurrentEditing
                        ? 'border-amber-400 ring-2 ring-amber-300/60 bg-amber-50/20'
                        : 'border-slate-200/80 hover:border-sky-300'
                    }`}
                  >
                    {/* Card Top: Title, Date, Customer & Badges */}
                    <div className="space-y-1.5">
                      {/* Case Title Row */}
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editTitleInput}
                            onChange={(e) => setEditTitleInput(e.target.value)}
                            autoFocus
                            className="w-full px-2 py-1 text-xs font-bold text-slate-800 bg-sky-50 border border-sky-300 rounded-lg focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTitle(record.id)}
                            className="p-1 rounded-lg bg-emerald-600 text-white text-xs cursor-pointer hover:bg-emerald-700"
                            title="บันทึกชื่อ"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded-lg bg-slate-200 text-slate-600 text-xs cursor-pointer hover:bg-slate-300"
                            title="ยกเลิก"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
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
                            onClick={() => handleStartEditTitle(record)}
                            className="text-slate-400 hover:text-sky-600 transition-colors p-0.5 cursor-pointer opacity-70 group-hover:opacity-100"
                            title="แก้ไขชื่อลูกค้า"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
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

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between gap-2 pt-1">
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
                              onClick={() => executeDelete(record.id)}
                              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] cursor-pointer active:scale-95 shadow-2xs transition-all whitespace-nowrap"
                            >
                              ลบเลย
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-[10.5px] cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
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
                            onClick={() => {
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
                          onClick={() => {
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
