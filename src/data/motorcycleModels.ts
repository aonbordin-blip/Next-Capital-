export interface MotorcycleModel {
  id: string;
  code: string;       // รหัสรุ่นตัวพิมพ์ใหญ่ทั้งหมด เช่น AFS110 KDBT 3TH, WW160AV TH
  name: string;       // ชื่อรุ่น เช่น เวฟ110ดรัม, PCX ใหม่
  isSpecial?: boolean; // ไฮไลท์พิเศษ (แถวสีแดงในเอกสาร)
  isGreen?: boolean;   // ไฮไลท์พิเศษ (แถวสีเขียว UC3)
}

/**
 * รายการรหัสรุ่นรถจักรยานยนต์ พร้อมชื่อรุ่น
 * ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ทั้งหมด (ALL UPPERCASE)
 * ตามตารางเอกสารมาตรฐานทางการ
 */
export const MOTORCYCLE_MODELS: MotorcycleModel[] = [
  { id: 'm-01', code: 'AFS110 KDBT 3TH', name: 'เวฟ110ดรัม' },
  { id: 'm-02', code: 'AFS110 MSBT TH / 2TH', name: 'เวฟ110มือ ใหม่' },
  { id: 'm-03', code: 'AFS110 MCBT TH', name: 'เวฟ110แม็ก ใหม่' },
  { id: 'm-04', code: 'AFS110 MCBT 2TH', name: 'เวฟ110แม็ก ใหม่' },
  { id: 'm-05', code: 'AFS110 MCBT 3TH', name: 'เวฟ110แม็ก ใหม่' },
  { id: 'm-06', code: 'AFS125 MSBT TH', name: 'เวฟ125มือ ใหม่' },
  { id: 'm-07', code: 'AFS125CSBT TH', name: 'เวฟ125แม็ก ใหม่' },
  { id: 'm-08', code: 'AFS125CSBT 2TH', name: 'เวฟ125แม็ก ใหม่' },
  { id: 'm-09', code: 'NBC110MSBT TH / 2TH', name: 'ซุปเปอร์คัพ ใหม่' },
  { id: 'm-10', code: 'ACF110BTT 2TH', name: 'สกู๊ป042' },
  { id: 'm-11', code: 'ACF110CBTT 3TH', name: 'สกู๊ป041 แม็ก' },
  { id: 'm-12', code: 'ACF110CBTT TH', name: 'สกู๊ป043 แม็ก' },
  { id: 'm-13', code: 'ACF125CBT TH', name: 'GIORNO' },
  { id: 'm-14', code: 'ACF125CBT TH567', name: 'GIORNO แต่ง' },
  { id: 'm-15', code: 'ACF125CAT TH', name: 'GIORNO ABS' },
  { id: 'm-16', code: 'ACF125CBT TH1234', name: 'GIORNO ABS แต่ง' },
  { id: 'm-17', code: 'ACF125CBT TH8', name: 'GIORNO ABS แต่ง', isSpecial: true },
  { id: 'm-18', code: 'ACB125BTP TH', name: 'คลิก125ลวด' },
  { id: 'm-19', code: 'ACB125CBTP TH', name: 'คลิก125แม็ก' },
  { id: 'm-20', code: 'ACB160CATV TH', name: 'คลิก160 ABS ใหม่' },
  { id: 'm-21', code: 'ACB160CATV TH1', name: 'คลิก160 ABS แต่ง', isSpecial: true },
  { id: 'm-22', code: 'NHX125T TH', name: 'ลีด125 ใหม่' },
  { id: 'm-23', code: 'NHX125AT TH', name: 'ลีด125 ใหม่ สีดำ/เทา' },
  { id: 'm-24', code: 'WW160AV TH', name: 'PCX ใหม่', isSpecial: true },
  { id: 'm-25', code: 'WW160SV TH', name: 'PCX ใหม่ SYNC', isSpecial: true },
  { id: 'm-26', code: 'CBR150RAS TH/4TH', name: 'CBR150ABS ใหม่' },
  { id: 'm-27', code: 'CBF150NAR TH', name: 'CB150' },
  { id: 'm-28', code: 'NSS350AS 2TH', name: 'ฟอร์ซ่า ใหม่' },
  { id: 'm-29', code: 'ADV160AT 3TH', name: 'ADV160 ใหม่' },
  { id: 'm-30', code: 'ADV160AT 7TH', name: 'ADV160 ใหม่' },
  { id: 'm-31', code: 'ADV350AS 3TH', name: 'ADV350' },
  { id: 'm-32', code: 'MSX125 AR 2TH', name: 'MSX125 ABS' },
  { id: 'm-33', code: 'CBF150NAR TH-ABS', name: 'CB150ABS ใหม่' },
  { id: 'm-34', code: 'ADV350AS 3TH-SYNC', name: 'ADV350 SYNC' },
  { id: 'm-35', code: 'CL300AS TH', name: 'CL300 ใหม่' },
  { id: 'm-36', code: 'CL300A3A TH', name: 'CL300 ใหม่' },
  { id: 'm-37', code: 'CMX300AS TH', name: 'รีเบล ใหม่' },
  { id: 'm-38', code: 'CMX300A3S TH', name: 'รีเบล ใหม่' },
  { id: 'm-39', code: 'CRF300LDAS TH / 2TH', name: 'CRF300 D ใหม่' },
  { id: 'm-40', code: 'CRF300LRAS TH', name: 'CRF300 R ใหม่' },
  { id: 'm-41', code: 'RST9004T 4TH5TH', name: 'UC3', isGreen: true },
];

/**
 * ค้นหารุ่นรถตามรหัสหรือชื่อรุ่น
 */
export function searchMotorcycleModels(query: string): MotorcycleModel[] {
  if (!query || !query.trim()) {
    return MOTORCYCLE_MODELS;
  }

  const clean = query.trim().toUpperCase().replace(/\s+/g, '');
  return MOTORCYCLE_MODELS.filter((item) => {
    const codeClean = item.code.toUpperCase().replace(/\s+/g, '');
    const nameClean = item.name.toUpperCase().replace(/\s+/g, '');
    return codeClean.includes(clean) || nameClean.includes(clean);
  });
}
