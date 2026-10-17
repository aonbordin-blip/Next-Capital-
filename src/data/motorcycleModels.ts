export interface MotorcycleModel {
  id: string;
  code: string;       // รหัสรุ่นตัวพิมพ์ใหญ่ทั้งหมด เช่น AFS110 KDBT 3TH, WW160AV TH, BEJ100
  name: string;       // ชื่อรุ่น เช่น เวฟ110ดรัม, PCX ใหม่, FAZZIO, PG-1
  brand?: string;     // แบรนด์ เช่น HONDA, YAMAHA
  isSpecial?: boolean; // ไฮไลท์พิเศษ (แถวสีแดงในเอกสาร)
  isGreen?: boolean;   // ไฮไลท์พิเศษ (แถวสีเขียว UC3)
}

/**
 * รายการรหัสรุ่นรถจักรยานยนต์ พร้อมชื่อรุ่น
 * ตัวอักษรภาษาอังกฤษพิมพ์ใหญ่ทั้งหมด (ALL UPPERCASE)
 * ตามตารางเอกสารทางการ Next Capital (ครอบคลุมทั้ง HONDA และ YAMAHA ตามเอกสารแนบ)
 */
export const MOTORCYCLE_MODELS: MotorcycleModel[] = [
  // ==========================================
  // HONDA MODELS
  // ==========================================
  { id: 'm-01', code: 'AFS110 KDBT 3TH', name: 'เวฟ110ดรัม', brand: 'HONDA' },
  { id: 'm-02', code: 'AFS110 MSBT TH / 2TH', name: 'เวฟ110มือ ใหม่', brand: 'HONDA' },
  { id: 'm-03', code: 'AFS110 MCBT TH', name: 'เวฟ110แม็ก ใหม่', brand: 'HONDA' },
  { id: 'm-04', code: 'AFS110 MCBT 2TH', name: 'เวฟ110แม็ก ใหม่', brand: 'HONDA' },
  { id: 'm-05', code: 'AFS110 MCBT 3TH', name: 'เวฟ110แม็ก ใหม่', brand: 'HONDA' },
  { id: 'm-06', code: 'AFS125 MSBT TH', name: 'เวฟ125มือ ใหม่', brand: 'HONDA' },
  { id: 'm-07', code: 'AFS125CSBT TH', name: 'เวฟ125แม็ก ใหม่', brand: 'HONDA' },
  { id: 'm-08', code: 'AFS125CSBT 2TH', name: 'เวฟ125แม็ก ใหม่', brand: 'HONDA' },
  { id: 'm-09', code: 'NBC110MSBT TH / 2TH', name: 'ซุปเปอร์คัพ ใหม่', brand: 'HONDA' },
  { id: 'm-10', code: 'ACF110BTT 2TH', name: 'สกู๊ป042', brand: 'HONDA' },
  { id: 'm-11', code: 'ACF110CBTT 3TH', name: 'สกู๊ป041 แม็ก', brand: 'HONDA' },
  { id: 'm-12', code: 'ACF110CBTT TH', name: 'สกู๊ป043 แม็ก', brand: 'HONDA' },
  { id: 'm-13', code: 'ACF125CBT TH', name: 'GIORNO', brand: 'HONDA' },
  { id: 'm-14', code: 'ACF125CBT TH567', name: 'GIORNO แต่ง', brand: 'HONDA' },
  { id: 'm-15', code: 'ACF125CAT TH', name: 'GIORNO ABS', brand: 'HONDA' },
  { id: 'm-16', code: 'ACF125CBT TH1234', name: 'GIORNO ABS แต่ง', brand: 'HONDA' },
  { id: 'm-17', code: 'ACF125CBT TH8', name: 'GIORNO ABS แต่ง', brand: 'HONDA', isSpecial: true },
  { id: 'm-18', code: 'ACB125BTP TH', name: 'คลิก125ลวด', brand: 'HONDA' },
  { id: 'm-19', code: 'ACB125CBTP TH', name: 'คลิก125แม็ก', brand: 'HONDA' },
  { id: 'm-20', code: 'ACB160CATV TH', name: 'คลิก160 ABS ใหม่', brand: 'HONDA' },
  { id: 'm-21', code: 'ACB160CATV TH1', name: 'คลิก160 ABS แต่ง', brand: 'HONDA', isSpecial: true },
  { id: 'm-22', code: 'NHX125T TH', name: 'ลีด125 ใหม่', brand: 'HONDA' },
  { id: 'm-23', code: 'NHX125AT TH', name: 'ลีด125 ใหม่ สีดำ/เทา', brand: 'HONDA' },
  { id: 'm-24', code: 'WW160AV TH', name: 'PCX ใหม่', brand: 'HONDA', isSpecial: true },
  { id: 'm-25', code: 'WW160SV TH', name: 'PCX ใหม่ SYNC', brand: 'HONDA', isSpecial: true },
  { id: 'm-26', code: 'CBR150RAS TH/4TH', name: 'CBR150ABS ใหม่', brand: 'HONDA' },
  { id: 'm-27', code: 'CBF150NAR TH', name: 'CB150', brand: 'HONDA' },
  { id: 'm-28', code: 'NSS350AS 2TH', name: 'ฟอร์ซ่า ใหม่', brand: 'HONDA' },
  { id: 'm-29', code: 'ADV160AT 3TH', name: 'ADV160 ใหม่', brand: 'HONDA' },
  { id: 'm-30', code: 'ADV160AT 7TH', name: 'ADV160 ใหม่', brand: 'HONDA' },
  { id: 'm-31', code: 'ADV350AS 3TH', name: 'ADV350', brand: 'HONDA' },
  { id: 'm-32', code: 'MSX125 AR 2TH', name: 'MSX125 ABS', brand: 'HONDA' },
  { id: 'm-33', code: 'CBF150NAR TH-ABS', name: 'CB150ABS ใหม่', brand: 'HONDA' },
  { id: 'm-34', code: 'ADV350AS 3TH-SYNC', name: 'ADV350 SYNC', brand: 'HONDA' },
  { id: 'm-35', code: 'CL300AS TH', name: 'CL300 ใหม่', brand: 'HONDA' },
  { id: 'm-36', code: 'CL300A3A TH', name: 'CL300 ใหม่', brand: 'HONDA' },
  { id: 'm-37', code: 'CMX300AS TH', name: 'รีเบล ใหม่', brand: 'HONDA' },
  { id: 'm-38', code: 'CMX300A3S TH', name: 'รีเบล ใหม่', brand: 'HONDA' },
  { id: 'm-39', code: 'CRF300LDAS TH / 2TH', name: 'CRF300 D ใหม่', brand: 'HONDA' },
  { id: 'm-40', code: 'CRF300LRAS TH', name: 'CRF300 R ใหม่', brand: 'HONDA' },
  { id: 'm-41', code: 'RST9004T 4TH5TH', name: 'UC3', brand: 'HONDA', isGreen: true },

  // ==========================================
  // YAMAHA MODELS (ตามเอกสารแนบ Next Capital - ไม่มี TH)
  // ==========================================
  // FAZZIO ซีรีส์
  { id: 'ym-01', code: 'BEJ100', name: 'FAZZIO HYBRID (STD)', brand: 'YAMAHA' },
  { id: 'ym-02', code: 'BEJ200', name: 'FAZZIO SMART KEY', brand: 'YAMAHA' },
  { id: 'ym-03', code: 'BEJ300', name: 'FAZZIO SPECIAL EDITION', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-04', code: 'BEJ1 / BEJ2', name: 'FAZZIO ไฮบริด ใหม่', brand: 'YAMAHA' },
  { id: 'ym-04b', code: 'BEJ1', name: 'FAZZIO STD', brand: 'YAMAHA' },
  { id: 'ym-04c', code: 'BEJ2', name: 'FAZZIO KEYLESS', brand: 'YAMAHA' },
  { id: 'ym-04d', code: 'BEJ3', name: 'FAZZIO SP', brand: 'YAMAHA', isSpecial: true },

  // PG-1 ซีรีส์
  { id: 'ym-05', code: 'B8A100', name: 'PG-1', brand: 'YAMAHA' },
  { id: 'ym-05b', code: 'B8A1', name: 'PG-1 ใหม่', brand: 'YAMAHA' },
  { id: 'ym-06', code: 'PG-1', name: 'PG-1 ลุยทุกทาง', brand: 'YAMAHA' },

  // NMAX ซีรีส์
  { id: 'ym-07', code: 'B6H100', name: 'NMAX 155', brand: 'YAMAHA' },
  { id: 'ym-07b', code: 'B6H1', name: 'NMAX 155 STD', brand: 'YAMAHA' },
  { id: 'ym-08', code: 'B6H200', name: 'NMAX 155 CONNECTED', brand: 'YAMAHA' },
  { id: 'ym-08b', code: 'B6H2', name: 'NMAX 155 CONNECTED ใหม่', brand: 'YAMAHA' },
  { id: 'ym-09', code: 'B6H300', name: 'NMAX 155 TECH MAX', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-10', code: 'BB8100', name: 'NMAX 155 ABS', brand: 'YAMAHA' },

  // WR155R ซีรีส์
  { id: 'ym-11', code: 'B3M100', name: 'WR155R', brand: 'YAMAHA' },
  { id: 'ym-11b', code: 'B3M1', name: 'WR155R สแตนดาร์ด', brand: 'YAMAHA' },
  { id: 'ym-12', code: 'B3M100-TRK', name: 'WR155R TRACKER', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-13', code: 'B3M100-TXD', name: 'WR155R TRAXKER DESIGN', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-14', code: 'B3M100-MON', name: 'WR155R MONSTER ENERGY', brand: 'YAMAHA' },

  // TRICITY & SR400 ซีรีส์
  { id: 'ym-15', code: 'BCS100', name: 'TRICITY155 (ABS)', brand: 'YAMAHA' },
  { id: 'ym-15b', code: 'BCS1', name: 'TRICITY 155 ABS', brand: 'YAMAHA' },
  { id: 'ym-16', code: '2RD100', name: 'SR400', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-16b', code: '2RD1', name: 'SR400 คลาสสิก', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-17', code: 'B03100', name: 'SR400 44TH ANNIVERSARY', brand: 'YAMAHA', isSpecial: true },

  // GRAND FILANO ซีรีส์
  { id: 'ym-18', code: 'BJK100', name: 'GRAND FILANO HYBRID (STD)', brand: 'YAMAHA' },
  { id: 'ym-19', code: 'BJK200', name: 'GRAND FILANO HYBRID ABS', brand: 'YAMAHA' },
  { id: 'ym-20', code: 'B8B100', name: 'GRAND FILANO HYBRID ใหม่', brand: 'YAMAHA' },
  { id: 'ym-20b', code: 'B8B1', name: 'GRAND FILANO HYBRID STD ใหม่', brand: 'YAMAHA' },
  { id: 'ym-21', code: 'B8B200', name: 'GRAND FILANO HYBRID ABS ใหม่', brand: 'YAMAHA' },
  { id: 'ym-21b', code: 'B8B2', name: 'GRAND FILANO HYBRID ABS ใหม่', brand: 'YAMAHA' },
  { id: 'ym-22', code: 'B8B300', name: 'GRAND FILANO SPECIAL EDITION', brand: 'YAMAHA', isSpecial: true },

  // FINN ซีรีส์
  { id: 'ym-23', code: 'B3F100', name: 'FINN ล้อซี่ลวด-สตาร์ทเท้า', brand: 'YAMAHA' },
  { id: 'ym-24', code: 'B3F200', name: 'FINN ล้อซี่ลวด-สตาร์ทมือ', brand: 'YAMAHA' },
  { id: 'ym-25', code: 'B3F300', name: 'FINN ล้อแม็ก-สตาร์ทมือ', brand: 'YAMAHA' },
  { id: 'ym-26', code: 'B3F400', name: 'FINN UBS ล้อแม็ก', brand: 'YAMAHA' },

  // AEROX ซีรีส์
  { id: 'ym-27', code: 'B6V100', name: 'AEROX 155 STANDARD', brand: 'YAMAHA' },
  { id: 'ym-28', code: 'B6V200', name: 'AEROX 155 ABS', brand: 'YAMAHA' },
  { id: 'ym-29', code: 'B8R100', name: 'AEROX 155 SP', brand: 'YAMAHA', isSpecial: true },

  // XMAX ซีรีส์
  { id: 'ym-30', code: 'B74100', name: 'XMAX 300', brand: 'YAMAHA' },
  { id: 'ym-31', code: 'BG6100', name: 'XMAX CONNECTED', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-32', code: 'BKA100', name: 'XMAX TECH MAX', brand: 'YAMAHA', isSpecial: true },

  // XSR155, MT-15, R15 ซีรีส์
  { id: 'ym-33', code: 'B1V100', name: 'XSR155', brand: 'YAMAHA' },
  { id: 'ym-34', code: 'B1V200', name: 'XSR155 WGP 60TH', brand: 'YAMAHA', isSpecial: true },
  { id: 'ym-35', code: 'B7D100', name: 'MT-15', brand: 'YAMAHA' },
  { id: 'ym-36', code: 'B9G100', name: 'MT-15 ใหม่', brand: 'YAMAHA' },
  { id: 'ym-37', code: 'BK6100', name: 'R15 CONNECTED', brand: 'YAMAHA' },
  { id: 'ym-38', code: 'BDJ100', name: 'R15M CONNECTED-ABS', brand: 'YAMAHA', isSpecial: true },

  // GT125, QBIX ซีรีส์
  { id: 'ym-39', code: '2SX100', name: 'GT125', brand: 'YAMAHA' },
  { id: 'ym-40', code: 'BM9100', name: 'QBIX', brand: 'YAMAHA' },
  { id: 'ym-41', code: 'BM9200', name: 'QBIX S', brand: 'YAMAHA' },
  { id: 'ym-42', code: 'BM9300', name: 'QBIX ABS', brand: 'YAMAHA' },
];

/**
 * ค้นหารุ่นรถตามรหัสหรือชื่อรุ่น หรือแบรนด์
 */
export function searchMotorcycleModels(query: string): MotorcycleModel[] {
  if (!query || !query.trim()) {
    return MOTORCYCLE_MODELS;
  }

  const clean = query.trim().toUpperCase().replace(/[\s\-_/]+/g, '');
  return MOTORCYCLE_MODELS.filter((item) => {
    const codeClean = item.code.toUpperCase().replace(/[\s\-_/]+/g, '');
    const nameClean = item.name.toUpperCase().replace(/[\s\-_/]+/g, '');
    const brandClean = (item.brand || '').toUpperCase().replace(/[\s\-_/]+/g, '');
    return codeClean.includes(clean) || nameClean.includes(clean) || brandClean.includes(clean);
  });
}

/**
 * ค้นหาชื่อรุ่นจากรหัสรุ่น (ยืดหยุ่นต่อช่องว่างหรือตัวพิมพ์เล็ก/ใหญ่)
 */
export function findModelByCode(code: string): MotorcycleModel | undefined {
  if (!code || !code.trim()) return undefined;
  const target = code.trim().toUpperCase().replace(/[\s\-_/]+/g, '');
  // 1. Exact clean match
  const exact = MOTORCYCLE_MODELS.find(
    (m) => m.code.toUpperCase().replace(/[\s\-_/]+/g, '') === target
  );
  if (exact) return exact;

  // 2. Starts with clean prefix or contains
  return MOTORCYCLE_MODELS.find((m) => {
    const c = m.code.toUpperCase().replace(/[\s\-_/]+/g, '');
    return c === target || c.startsWith(target) || target.startsWith(c);
  });
}
