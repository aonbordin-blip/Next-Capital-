export interface MotorcycleModel {
  id: string;
  code: string;       // รหัสรุ่นตัวพิมพ์ใหญ่ทั้งหมด เช่น ACF125CAT TH, AFS110KDBT TH
  name: string;       // ชื่อรุ่น เช่น HONDA GIORNO+, HONDA WAVE110, HONDA LEAD125, HONDA PCX160
  brand?: string;     // แบรนด์ เช่น HONDA, YAMAHA
  price?: number;     // ราคาตามเอกสารทางการ Max Tax (บาท)
  isSpecial?: boolean; // ไฮไลท์พิเศษ (แถวสีแดงในเอกสาร)
  isGreen?: boolean;   // ไฮไลท์พิเศษ (แถวสีเขียว UC3)
}

/**
 * รายการรหัสรุ่นรถจักรยานยนต์ พร้อมชื่อรุ่น และราคา
 * อัปเดตรหัสรุ่น, ชื่อรถ, และราคา (Max Tax) ตามเอกสารแนบทางการ
 * ส่วนอื่นที่ไม่ตรงกับเอกสารคงไว้เหมือนเดิม
 */
export const MOTORCYCLE_MODELS: MotorcycleModel[] = [
  // ==========================================
  // HONDA MODELS (อัปเดตตามเอกสารแนบทางการ)
  // ==========================================
  // GIORNO+ ซีรีส์ (ราคา 88,700 และ 82,700 บาท)
  { id: 'm-giorno-01', code: 'ACF125CAT TH', name: 'HONDA GIORNO+', brand: 'HONDA', price: 88700 },
  { id: 'm-giorno-02', code: 'ACF125CAT TH(TH1)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 88700 },
  { id: 'm-giorno-03', code: 'ACF125CAT TH (TH2)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 88700 },
  { id: 'm-giorno-04', code: 'ACF125CAT TH (TH3)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 88700 },
  { id: 'm-giorno-05', code: 'ACF125CAT TH (TH4)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 88700 },
  { id: 'm-giorno-06', code: 'ACF125CBT TH', name: 'HONDA GIORNO+', brand: 'HONDA', price: 82700 },
  { id: 'm-giorno-07', code: 'ACF125CBT TH (TH5)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 82700 },
  { id: 'm-giorno-08', code: 'ACF125CBT TH (TH6)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 82700 },
  { id: 'm-giorno-09', code: 'ACF125CBT TH (TH7)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 82700 },

  // WAVE 110 ซีรีส์ (ราคา 50,700 - 63,500 บาท)
  { id: 'm-wave110-01', code: 'AFS110KDBT TH', name: 'HONDA WAVE110', brand: 'HONDA', price: 50700 },
  { id: 'm-wave110-02', code: 'AFS110MCBT 2TH', name: 'HONDA Wave110', brand: 'HONDA', price: 62900 },
  { id: 'm-wave110-03', code: 'AFS110MCBT 3TH', name: 'HONDA Wave110', brand: 'HONDA', price: 63500 },
  { id: 'm-wave110-04', code: 'AFS110MCBT TH', name: 'HONDA Wave110', brand: 'HONDA', price: 62900 },
  { id: 'm-wave110-05', code: 'AFS110MSBT 2TH', name: 'HONDA WAVE 110', brand: 'HONDA', price: 59100 },
  { id: 'm-wave110-06', code: 'AFS110MSBT TH', name: 'HONDA WAVE 110', brand: 'HONDA', price: 60300 },

  // WAVE 125 ซีรีส์ (ราคา 72,000 - 79,200 บาท)
  { id: 'm-wave125-01', code: 'AFS125CSBT 2TH', name: 'HONDA WAVE 125', brand: 'HONDA', price: 79200 },
  { id: 'm-wave125-02', code: 'AFS125CSBT TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 75000 },
  { id: 'm-wave125-03', code: 'AFS125MSBT TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 72000 },

  // LEAD 125 ซีรีส์ (ราคา 75,100 และ 81,000 บาท)
  { id: 'm-lead-01', code: 'NHX125AT TH', name: 'HONDA LEAD125', brand: 'HONDA', price: 81000 },
  { id: 'm-lead-02', code: 'NHX125T TH', name: 'HONDA LEAD125', brand: 'HONDA', price: 75100 },

  // PCX 160 ซีรีส์ (ราคา 116,100 และ 120,800 บาท)
  { id: 'm-pcx-01', code: 'WW160AS TH', name: 'HONDA PCX160', brand: 'HONDA', price: 116100 },
  { id: 'm-pcx-02', code: 'WW160SS TH', name: 'HONDA PCX160', brand: 'HONDA', price: 120800 },

  // --- รุ่นอื่นๆ ของ HONDA (คงไว้เหมือนเดิมตามคำสั่ง) ---
  { id: 'm-09', code: 'NBC110MSBT TH / 2TH', name: 'ซุปเปอร์คัพ ใหม่', brand: 'HONDA' },
  { id: 'm-10', code: 'ACF110BTT 2TH', name: 'สกู๊ป042', brand: 'HONDA' },
  { id: 'm-11', code: 'ACF110CBTT 3TH', name: 'สกู๊ป041 แม็ก', brand: 'HONDA' },
  { id: 'm-12', code: 'ACF110CBTT TH', name: 'สกู๊ป043 แม็ก', brand: 'HONDA' },
  { id: 'm-18', code: 'ACB125BTP TH', name: 'คลิก125ลวด', brand: 'HONDA' },
  { id: 'm-19', code: 'ACB125CBTP TH', name: 'คลิก125แม็ก', brand: 'HONDA' },
  { id: 'm-20', code: 'ACB160CATV TH', name: 'คลิก160 ABS ใหม่', brand: 'HONDA' },
  { id: 'm-21', code: 'ACB160CATV TH1', name: 'คลิก160 ABS แต่ง', brand: 'HONDA', isSpecial: true },
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

  const clean = query.trim().toUpperCase().replace(/[\s\-_/()]+/g, '');
  return MOTORCYCLE_MODELS.filter((item) => {
    const codeClean = item.code.toUpperCase().replace(/[\s\-_/()]+/g, '');
    const nameClean = item.name.toUpperCase().replace(/[\s\-_/()]+/g, '');
    const brandClean = (item.brand || '').toUpperCase().replace(/[\s\-_/()]+/g, '');
    return codeClean.includes(clean) || nameClean.includes(clean) || brandClean.includes(clean);
  });
}

/**
 * ค้นหาชื่อรุ่นจากรหัสรุ่น (ยืดหยุ่นต่อช่องว่างหรือตัวพิมพ์เล็ก/ใหญ่)
 */
export function findModelByCode(code: string): MotorcycleModel | undefined {
  if (!code || !code.trim()) return undefined;
  const target = code.trim().toUpperCase().replace(/[\s\-_/()]+/g, '');
  // 1. Exact clean match
  const exact = MOTORCYCLE_MODELS.find(
    (m) => m.code.toUpperCase().replace(/[\s\-_/()]+/g, '') === target
  );
  if (exact) return exact;

  // 2. Starts with clean prefix or contains
  return MOTORCYCLE_MODELS.find((m) => {
    const c = m.code.toUpperCase().replace(/[\s\-_/()]+/g, '');
    return c === target || c.startsWith(target) || target.startsWith(c);
  });
}
