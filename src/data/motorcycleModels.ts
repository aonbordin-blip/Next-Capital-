export interface MotorcycleModel {
  id: string;
  code: string;       // รหัสรุ่นตัวพิมพ์ใหญ่ทั้งหมด เช่น ACF125CAT TH, AFS110KDBT TH
  name: string;       // ชื่อรุ่น เช่น HONDA GIORNO+, HONDA WAVE110, HONDA LEAD125, HONDA PCX160
  brand?: string;     // แบรนด์ เช่น HONDA, YAMAHA
  price?: number;     // ราคาตามเอกสารทางการ Max N/F* Amount (บาท)
  isSpecial?: boolean; // ไฮไลท์พิเศษ (แถวสีแดงในเอกสาร Price List)
  isGreen?: boolean;   // ไฮไลท์พิเศษ
  isCustom?: boolean;  // รุ่นที่ผู้ใช้บันทึกเอง
}

const CUSTOM_MODELS_STORAGE_KEY = 'ncap_custom_motorcycle_models';

/**
 * ดึงรายการรหัสรุ่นรถที่ผู้ใช้บันทึกเองจาก localStorage
 */
export function getCustomMotorcycleModels(): MotorcycleModel[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * บันทึกรหัสรุ่นรถใหม่ (รหัสรุ่น, ชื่อรถ, ราคา, แบรนด์) ลงใน localStorage
 */
export function saveCustomMotorcycleModel(data: {
  code: string;
  name: string;
  brand?: string;
  price?: number;
}): MotorcycleModel {
  const customList = getCustomMotorcycleModels();
  const cleanCode = data.code.trim().toUpperCase();
  const cleanName = data.name.trim();

  // If exists with same code, update it, else prepend
  const existingIdx = customList.findIndex(
    (m) => m.code.toUpperCase() === cleanCode
  );

  const newModel: MotorcycleModel = {
    id: existingIdx >= 0 ? customList[existingIdx].id : `custom-${Date.now()}`,
    code: cleanCode,
    name: cleanName || cleanCode,
    brand: data.brand || 'HONDA',
    price: data.price && data.price > 0 ? Number(data.price) : undefined,
    isCustom: true,
  };

  let updatedList: MotorcycleModel[];
  if (existingIdx >= 0) {
    updatedList = [...customList];
    updatedList[existingIdx] = newModel;
  } else {
    updatedList = [newModel, ...customList];
  }

  try {
    localStorage.setItem(CUSTOM_MODELS_STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error('Failed to save custom model:', err);
  }

  return newModel;
}

/**
 * ลบรหัสรุ่นรถที่ผู้ใช้บันทึกเอง
 */
export function deleteCustomMotorcycleModel(id: string): void {
  const customList = getCustomMotorcycleModels();
  const updatedList = customList.filter((m) => m.id !== id);
  try {
    localStorage.setItem(CUSTOM_MODELS_STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error('Failed to delete custom model:', err);
  }
}

/**
 * ดึงรายการรหัสรุ่นทั้งหมด (รวมรุ่นที่บันทึกเอง + ฐานข้อมูลทางการ Next Capital)
 */
export function getAllMotorcycleModels(): MotorcycleModel[] {
  const custom = getCustomMotorcycleModels();
  return [...custom, ...MOTORCYCLE_MODELS];
}

/**
 * รายการรหัสรุ่นรถจักรยานยนต์ทางการ Next Capital (Price List)
 * ครอบคลุมทั้ง HONDA (120 รุ่น) และ YAMAHA (70 รุ่น) รวม 190 รุ่น
 * อัปเดตข้อมูล รหัสรุ่น, ชื่อรถ, และราคารถ (Max N/F* Amount) ครบถ้วน 100%
 */
export const MOTORCYCLE_MODELS: MotorcycleModel[] = [
  // =========================================================================
  // HONDA (หน้า 1/2) - ADV, C125, CB, CBR, CL, CLICK, CRF, CT, DAX, EV, FORZA, GIORNO+, LEAD, PCX, SCOOPY MINIONS
  // =========================================================================
  { id: 'h-001', code: 'ADV160AP TH', name: 'HONDA ADV160', brand: 'HONDA', price: 120800, isSpecial: true },
  { id: 'h-002', code: 'ADV160AP TH1', name: 'HONDA ADV160 KITACO RACING', brand: 'HONDA', price: 131100, isSpecial: true },
  { id: 'h-003', code: 'ADV160AP TH2', name: 'HONDA ADV160 CAPTAIN AMERICA', brand: 'HONDA', price: 126000, isSpecial: true },
  { id: 'h-004', code: 'ADV160AP TH3', name: 'HONDA ADV160 IRONMAN', brand: 'HONDA', price: 126000, isSpecial: true },
  { id: 'h-005', code: 'ADV160AS TH', name: 'HONDA ADV160 EXPLORE THE WILD', brand: 'HONDA', price: 120800, isSpecial: true },
  { id: 'h-006', code: 'ADV160AT 3TH', name: 'HONDA ADV160', brand: 'HONDA', price: 123300, isSpecial: true },
  { id: 'h-007', code: 'ADV160AT 7TH', name: 'HONDA ADV160', brand: 'HONDA', price: 123900, isSpecial: true },
  { id: 'h-008', code: 'ADV160AT 7TH(TH1)', name: 'HONDA ADV160 SMART TOURER TH1', brand: 'HONDA', price: 140400, isSpecial: true },
  { id: 'h-009', code: 'ADV350AS 3TH', name: 'HONDA ADV350 RoadSync type', brand: 'HONDA', price: 192400, isSpecial: true },
  { id: 'h-010', code: 'ADV350AS 3TH (TH1)', name: 'HONDA ADV350 H2C ADVENTURE II', brand: 'HONDA', price: 204000, isSpecial: true },
  { id: 'h-011', code: 'C125AT 2TH', name: 'HONDA C125', brand: 'HONDA', price: 94600, isSpecial: true },
  { id: 'h-012', code: 'C125AT 3TH', name: 'HONDA C125', brand: 'HONDA', price: 94600, isSpecial: true },
  { id: 'h-013', code: 'C125AT TH', name: 'HONDA C125', brand: 'HONDA', price: 94600, isSpecial: true },
  { id: 'h-014', code: 'CBF150NAJ TH', name: 'HONDA CB150R', brand: 'HONDA', price: 95800, isSpecial: true },
  { id: 'h-015', code: 'CBF150NAR TH', name: 'HONDA CB150R', brand: 'HONDA', price: 137700, isSpecial: true },
  { id: 'h-016', code: 'CBF300NAP TH', name: 'HONDA CB300R', brand: 'HONDA', price: 157200, isSpecial: true },
  { id: 'h-017', code: 'CBR150RAM 5TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 108900, isSpecial: true },
  { id: 'h-018', code: 'CBR150RAM 9TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 108900, isSpecial: true },
  { id: 'h-019', code: 'CBR150RAR 5TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 122200, isSpecial: true },
  { id: 'h-020', code: 'CBR150RAR 9TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 122200, isSpecial: true },
  { id: 'h-021', code: 'CBR150RAS 4TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 122200, isSpecial: true },
  { id: 'h-022', code: 'CBR150RAS TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 122200, isSpecial: true },
  { id: 'h-023', code: 'CBR150RM 9TH', name: 'HONDA CBR150R', brand: 'HONDA', price: 101200, isSpecial: true },
  { id: 'h-024', code: 'CL300AS TH', name: 'HONDA CL300', brand: 'HONDA', price: 151900, isSpecial: true },
  { id: 'h-025', code: 'CL300A3S TH', name: 'HONDA CL300 EClutch', brand: 'HONDA', price: 165000, isSpecial: true },
  { id: 'h-026', code: 'ACB125BTP TH', name: 'HONDA CLICK125', brand: 'HONDA', price: 65200, isSpecial: true },
  { id: 'h-027', code: 'ACB125CBTP TH', name: 'HONDA CLICK125', brand: 'HONDA', price: 71400, isSpecial: true },
  { id: 'h-028', code: 'ACB125BTM TH', name: 'HONDA CLICK125i', brand: 'HONDA', price: 58200, isSpecial: true },
  { id: 'h-029', code: 'ACB125CBTL TH', name: 'HONDA CLICK125i', brand: 'HONDA', price: 55000, isSpecial: true },
  { id: 'h-030', code: 'ACB160CATN TH', name: 'HONDA CLICK 160 ABS', brand: 'HONDA', price: 76200, isSpecial: true },
  { id: 'h-031', code: 'ACB160CATR 2TH', name: 'HONDA CLICK160', brand: 'HONDA', price: 85200, isSpecial: true },
  { id: 'h-032', code: 'ACB160CATR TH', name: 'HONDA CLICK160', brand: 'HONDA', price: 84700, isSpecial: true },
  { id: 'h-033', code: 'ACB160CATN TH1', name: 'HONDA CLICK160 Dynamic Sport', brand: 'HONDA', price: 78100, isSpecial: true },
  { id: 'h-034', code: 'CRF300LDAS TH', name: 'HONDA CRF300L', brand: 'HONDA', price: 164400, isSpecial: true },
  { id: 'h-035', code: 'CT125AP TH', name: 'HONDA CT125 Standard', brand: 'HONDA', price: 100800, isSpecial: true },
  { id: 'h-036', code: 'CT125AS TH1', name: 'HONDA CT125 X CHUMS', brand: 'HONDA', price: 98900, isSpecial: true },
  { id: 'h-037', code: 'CT125AP TH1', name: 'HONDA CT125 X STANLEY SPECIAL', brand: 'HONDA', price: 108700, isSpecial: true },
  { id: 'h-038', code: 'ST125AS TH(TH5)', name: 'HONDA DAX ROYAL', brand: 'HONDA', price: 94900, isSpecial: true },
  { id: 'h-039', code: 'ST125AP TH', name: 'HONDA DAX125 Standard', brand: 'HONDA', price: 97000, isSpecial: true },
  { id: 'h-040', code: 'RST9004T 4TH', name: 'HONDA EV UC3', brand: 'HONDA', price: 132600, isSpecial: true },
  { id: 'h-041', code: 'RST9004T 5TH', name: 'HONDA EV UC3', brand: 'HONDA', price: 132600, isSpecial: true },
  { id: 'h-042', code: 'NSS350AP TH', name: 'HONDA FORZA350', brand: 'HONDA', price: 196000, isSpecial: true },
  { id: 'h-043', code: 'NSS350AS 2TH..', name: 'HONDA FORZA350 Ohlins TH2', brand: 'HONDA', price: 207000, isSpecial: true },
  { id: 'h-044', code: 'ACF125CAS TH', name: 'HONDA GIORNO+', brand: 'HONDA', price: 85200, isSpecial: true },
  { id: 'h-045', code: 'ACF125CAT TH', name: 'HONDA GIORNO+', brand: 'HONDA', price: 90700, isSpecial: true },
  { id: 'h-046', code: 'ACF125CAT TH (TH1)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 90700, isSpecial: true },
  { id: 'h-047', code: 'ACF125CAT TH (TH2)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 90700, isSpecial: true },
  { id: 'h-048', code: 'ACF125CAT TH (TH3)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 90700, isSpecial: true },
  { id: 'h-049', code: 'ACF125CAT TH (TH4)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 90700, isSpecial: true },
  { id: 'h-050', code: 'ACF125CBT TH (TH5)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 84700, isSpecial: true },
  { id: 'h-051', code: 'ACF125CBT TH (TH6)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 84700, isSpecial: true },
  { id: 'h-052', code: 'ACF125CBT TH (TH7)', name: 'HONDA GIORNO+', brand: 'HONDA', price: 84700, isSpecial: true },
  { id: 'h-053', code: 'ACF125CBS TH', name: 'HONDA GIORNO+', brand: 'HONDA', price: 79000, isSpecial: true },
  { id: 'h-054', code: 'ACF125CBT TH', name: 'HONDA GIORNO+', brand: 'HONDA', price: 84500, isSpecial: true },
  { id: 'h-055', code: 'NHX125S 2TH', name: 'HONDA LEAD125', brand: 'HONDA', price: 75600, isSpecial: true },
  { id: 'h-056', code: 'NHX125S TH', name: 'HONDA LEAD125', brand: 'HONDA', price: 74500, isSpecial: true },
  { id: 'h-057', code: 'NHX125T TH', name: 'HONDA LEAD125', brand: 'HONDA', price: 75100, isSpecial: true },
  { id: 'h-058', code: 'NHX125S 2TH(TH1)', name: 'HONDA LEAD125 TH1 Ohlins', brand: 'HONDA', price: 87900, isSpecial: true },
  { id: 'h-059', code: 'WW160AP 2TH', name: 'HONDA PCX160', brand: 'HONDA', price: 113900, isSpecial: true },
  { id: 'h-060', code: 'WW160AP TH', name: 'HONDA PCX160', brand: 'HONDA', price: 113200, isSpecial: true },
  { id: 'h-061', code: 'WW160AR TH', name: 'HONDA PCX160', brand: 'HONDA', price: 113600, isSpecial: true },
  { id: 'h-062', code: 'WW160AS TH', name: 'HONDA PCX160', brand: 'HONDA', price: 116100, isSpecial: true },
  { id: 'h-063', code: 'WW160SS TH', name: 'HONDA PCX160', brand: 'HONDA', price: 120800, isSpecial: true },
  { id: 'h-064', code: 'WW160SS TH.', name: 'HONDA PCX160', brand: 'HONDA', price: 130100, isSpecial: true },
  { id: 'h-065', code: 'ACF110CBTP 3TH (TH1)', name: 'HONDA SCOOPY (TH1) MINIONS', brand: 'HONDA', price: 69400, isSpecial: true },

  // =========================================================================
  // HONDA (หน้า 2/2) - SCOOPY, SUPER CUB, WAVE 110, WAVE 125
  // =========================================================================
  { id: 'h-066', code: 'ACF110CBTR TH', name: 'HONDA Scoopy CLUB 12', brand: 'HONDA', price: 68400, isSpecial: true },
  { id: 'h-067', code: 'ACF110CBTT TH', name: 'HONDA Scoopy CLUB 12', brand: 'HONDA', price: 69300, isSpecial: true },
  { id: 'h-068', code: 'ACF110CBTP TH3', name: 'HONDA SCOOPY CLUB12', brand: 'HONDA', price: 72900, isSpecial: true },
  { id: 'h-069', code: 'ACF110CBTS TH(TH2)', name: 'HONDA SCOOPY CLUB12 FUNCTIONA', brand: 'HONDA', price: 73300, isSpecial: true },
  { id: 'h-070', code: 'ACF110CBTS TH(TH1)', name: 'HONDA SCOOPY CLUB12 FASHION ST', brand: 'HONDA', price: 71700, isSpecial: true },
  { id: 'h-071', code: 'ACF110CBTR 2TH', name: 'HONDA SCOOPY CLUB12 TH1 Hello', brand: 'HONDA', price: 72600, isSpecial: true },
  { id: 'h-072', code: 'ACF110CBTP TH2', name: 'HONDA SCOOPY COLOR CULTURE', brand: 'HONDA', price: 72900, isSpecial: true },
  { id: 'h-073', code: 'ACF110CBTS TH', name: 'HONDA SCOOPY COLOR CULTURE', brand: 'HONDA', price: 69300, isSpecial: true },
  { id: 'h-074', code: 'ACF110BTS 2TH', name: 'HONDA Scoopy i Urban', brand: 'HONDA', price: 63600, isSpecial: true },
  { id: 'h-075', code: 'ACF110CBTP 3TH', name: 'HONDA SCOOPY PRESTIGE', brand: 'HONDA', price: 66000, isSpecial: true },
  { id: 'h-076', code: 'ACF110CBTR 3TH', name: 'HONDA Scoopy Prestige', brand: 'HONDA', price: 66500, isSpecial: true },
  { id: 'h-077', code: 'ACF110CBTS 3TH', name: 'HONDA SCOOPY PRESTIGE', brand: 'HONDA', price: 67500, isSpecial: true },
  { id: 'h-078', code: 'ACF110CBTT 3TH', name: 'HONDA Scoopy Prestige', brand: 'HONDA', price: 67500, isSpecial: true },
  { id: 'h-079', code: 'ACF110BTP 2TH', name: 'HONDA SCOOPY URBAN', brand: 'HONDA', price: 62800, isSpecial: true },
  { id: 'h-080', code: 'ACF110BTR 2TH', name: 'HONDA Scoopy Urban', brand: 'HONDA', price: 62800, isSpecial: true },
  { id: 'h-081', code: 'ACF110BTT 2TH', name: 'HONDA Scoopy Urban', brand: 'HONDA', price: 63600, isSpecial: true },
  { id: 'h-082', code: 'ACF110CBTT 2TH', name: 'HONDA Scoopy X CINNAMOROLL TH1', brand: 'HONDA', price: 75100, isSpecial: true },
  { id: 'h-083', code: 'ACF110CBTS TH(TH3)', name: 'HONDA SCOOPY X KUROMI', brand: 'HONDA', price: 76500, isSpecial: true },
  { id: 'h-084', code: 'NBC110MSBT 2TH', name: 'HONDA SUPER CUB', brand: 'HONDA', price: 63600, isSpecial: true },
  { id: 'h-085', code: 'NBC110MSBT TH', name: 'HONDA SUPER CUB', brand: 'HONDA', price: 63600, isSpecial: true },
  { id: 'h-086', code: 'NBC110MSBT 2TH(TH1)', name: 'HONDA SUPER CUB Fuji San', brand: 'HONDA', price: 68100, isSpecial: true },
  { id: 'h-087', code: 'AFS110MSBT 2TH', name: 'HONDA WAVE 110', brand: 'HONDA', price: 58300, isSpecial: true },
  { id: 'h-088', code: 'AFS110MSBT TH', name: 'HONDA WAVE 110', brand: 'HONDA', price: 58300, isSpecial: true },
  { id: 'h-089', code: 'AFS110KDFR 3TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 46800, isSpecial: true },
  { id: 'h-090', code: 'AFS110KDFS 3TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 47300, isSpecial: true },
  { id: 'h-091', code: 'AFS110KSFR 3TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 52400, isSpecial: true },
  { id: 'h-092', code: 'AFS110KSFS 3TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 53000, isSpecial: true },
  { id: 'h-093', code: 'AFS110MCFL TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 45500, isSpecial: true },
  { id: 'h-094', code: 'AFS110MCFP 3TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 51800, isSpecial: true },
  { id: 'h-095', code: 'AFS110MCFR 4TH', name: 'HONDA WAVE 110i', brand: 'HONDA', price: 58400, isSpecial: true },
  { id: 'h-096', code: 'AFS110KDBT TH', name: 'HONDA WAVE110', brand: 'HONDA', price: 49100, isSpecial: true },
  { id: 'h-097', code: 'AFS110MCBT 2TH', name: 'HONDA Wave110', brand: 'HONDA', price: 60800, isSpecial: true },
  { id: 'h-098', code: 'AFS110MCBT 3TH', name: 'HONDA Wave110', brand: 'HONDA', price: 61300, isSpecial: true },
  { id: 'h-099', code: 'AFS110MCBT TH', name: 'HONDA Wave110', brand: 'HONDA', price: 60800, isSpecial: true },
  { id: 'h-100', code: 'AFS110KDFR 4TH', name: 'HONDA WAVE110i', brand: 'HONDA', price: 46800, isSpecial: true },
  { id: 'h-101', code: 'AFS110KSFR 4TH', name: 'HONDA WAVE110i', brand: 'HONDA', price: 52400, isSpecial: true },
  { id: 'h-102', code: 'AFS110MCFR 3TH', name: 'HONDA WAVE110i', brand: 'HONDA', price: 58400, isSpecial: true },
  { id: 'h-103', code: 'AFS110MCFS 3TH', name: 'HONDA WAVE110i', brand: 'HONDA', price: 59000, isSpecial: true },
  { id: 'h-104', code: 'AFS110MSFR 3TH', name: 'HONDA WAVE110i', brand: 'HONDA', price: 56000, isSpecial: true },
  { id: 'h-105', code: 'AFS110MSFR 4TH', name: 'HONDA WAVE110i', brand: 'HONDA', price: 56000, isSpecial: true },
  { id: 'h-106', code: 'AFS125CSBT 2TH.', name: 'HONDA WAVE125 x PROFENDER TH1', brand: 'HONDA', price: 83600, isSpecial: true },
  { id: 'h-107', code: 'AFS125CSFS TH', name: 'HONDA WAVE125i', brand: 'HONDA', price: 73300, isSpecial: true },
  { id: 'h-108', code: 'AFS125CSFK TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 55300, isSpecial: true },
  { id: 'h-109', code: 'AFS125CSFL TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 55900, isSpecial: true },
  { id: 'h-110', code: 'AFS125CSFM TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 63400, isSpecial: true },
  { id: 'h-111', code: 'AFS125CSFP TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 71200, isSpecial: true },
  { id: 'h-112', code: 'AFS125CSFR TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 72300, isSpecial: true },
  { id: 'h-113', code: 'AFS125MSBT TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 72000, isSpecial: true },
  { id: 'h-114', code: 'AFS125MSFL TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 53700, isSpecial: true },
  { id: 'h-115', code: 'AFS125MSFM TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 60900, isSpecial: true },
  { id: 'h-116', code: 'AFS125MSFP TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 68400, isSpecial: true },
  { id: 'h-117', code: 'AFS125MSFR TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 69600, isSpecial: true },
  { id: 'h-118', code: 'AFS125CSBT 2TH', name: 'HONDA WAVE 125', brand: 'HONDA', price: 76500, isSpecial: true },
  { id: 'h-119', code: 'AFS125CSBT TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 74800, isSpecial: true },
  { id: 'h-120', code: 'AFS125MSFS TH', name: 'HONDA WAVE 125i', brand: 'HONDA', price: 71100, isSpecial: true },

  // =========================================================================
  // YAMAHA (หน้า 1/2) - AEROX, EXCITER, FAZZIO, FINN, GRAND FILANO, MT-15, NMAX, PG-1
  // =========================================================================
  { id: 'y-001', code: 'BWR100', name: 'YAMAHA AEROX', brand: 'YAMAHA', price: 100700, isSpecial: true },
  { id: 'y-002', code: 'BWR200', name: 'YAMAHA AEROX', brand: 'YAMAHA', price: 100700, isSpecial: true },
  { id: 'y-003', code: 'D13100', name: 'YAMAHA AEROX SP', brand: 'YAMAHA', price: 117100, isSpecial: true },
  { id: 'y-004', code: 'BAW100', name: 'YAMAHA Exciter 155', brand: 'YAMAHA', price: 74600, isSpecial: true },
  { id: 'y-005', code: 'BAW300', name: 'YAMAHA Exciter 155', brand: 'YAMAHA', price: 74700, isSpecial: true },
  { id: 'y-006', code: 'BAW400', name: 'YAMAHA Exciter155', brand: 'YAMAHA', price: 76800, isSpecial: true },
  { id: 'y-007', code: 'BAW500', name: 'YAMAHA Exciter155', brand: 'YAMAHA', price: 76800, isSpecial: true },
  { id: 'y-008', code: 'BAW600', name: 'YAMAHA Exciter155', brand: 'YAMAHA', price: 90400, isSpecial: true },
  { id: 'y-009', code: 'BWK100', name: 'YAMAHA EXCITER155', brand: 'YAMAHA', price: 97200, isSpecial: true },
  { id: 'y-010', code: 'BWK200', name: 'YAMAHA EXCITER155', brand: 'YAMAHA', price: 97200, isSpecial: true },
  { id: 'y-011', code: 'BWK300', name: 'YAMAHA Exciter155', brand: 'YAMAHA', price: 97200, isSpecial: true },
  { id: 'y-012', code: 'BWK400', name: 'YAMAHA Exciter155', brand: 'YAMAHA', price: 97200, isSpecial: true },
  { id: 'y-013', code: 'BKF100', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 69300, isSpecial: true },
  { id: 'y-014', code: 'BKF300', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 71400, isSpecial: true },
  { id: 'y-015', code: 'BKF400', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 67800, isSpecial: true },
  { id: 'y-016', code: 'BKF500', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 70000, isSpecial: true },
  { id: 'y-017', code: 'BKF600', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 64200, isSpecial: true },
  { id: 'y-018', code: 'BKF700', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 66800, isSpecial: true },
  { id: 'y-019', code: 'BKF800', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 78700, isSpecial: true },
  { id: 'y-020', code: 'BKFB00', name: 'YAMAHA FAZZIO', brand: 'YAMAHA', price: 62900, isSpecial: true },
  { id: 'y-021', code: 'BKFD00', name: 'YAMAHA FAZZIO HYBRID', brand: 'YAMAHA', price: 66800, isSpecial: true },
  { id: 'y-022', code: 'BKFF00', name: 'YAMAHA FAZZIO HYBRID', brand: 'YAMAHA', price: 62900, isSpecial: true },
  { id: 'y-023', code: 'BKFE00', name: 'YAMAHA FAZZIO Special Edition', brand: 'YAMAHA', price: 74500, isSpecial: true },
  { id: 'y-024', code: 'DA6100', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 63200, isSpecial: true },
  { id: 'y-025', code: 'DA6200', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 60800, isSpecial: true },
  { id: 'y-026', code: 'DA6300', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 58200, isSpecial: true },
  { id: 'y-027', code: 'DT0100', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 52100, isSpecial: true },
  { id: 'y-028', code: 'DT0200', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 56400, isSpecial: true },
  { id: 'y-029', code: 'DT0300', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 59000, isSpecial: true },
  { id: 'y-030', code: 'DT0400', name: 'YAMAHA FINN', brand: 'YAMAHA', price: 61300, isSpecial: true },
  { id: 'y-031', code: 'B6FW00', name: 'YAMAHA FINN SP', brand: 'YAMAHA', price: 62800, isSpecial: true },
  { id: 'y-032', code: 'BJK400', name: 'YAMAHA Grand Filano Hybrid', brand: 'YAMAHA', price: 86200, isSpecial: true },
  { id: 'y-033', code: 'BJK500', name: 'YAMAHA Grand Filano Hybrid', brand: 'YAMAHA', price: 81900, isSpecial: true },
  { id: 'y-034', code: 'BJK600', name: 'YAMAHA Grand Filano Hybrid', brand: 'YAMAHA', price: 87500, isSpecial: true },
  { id: 'y-035', code: 'BJK900', name: 'YAMAHA Grand Filano Hybrid', brand: 'YAMAHA', price: 98300, isSpecial: true },
  { id: 'y-036', code: 'BJKA00', name: 'YAMAHA Grand Filano Hybrid', brand: 'YAMAHA', price: 81900, isSpecial: true },
  { id: 'y-037', code: 'BJKB00', name: 'YAMAHA Grand Filano Hybrid', brand: 'YAMAHA', price: 87500, isSpecial: true },
  { id: 'y-038', code: 'BJKC00', name: 'YAMAHA GRAND FILANO HYBRID', brand: 'YAMAHA', price: 81900, isSpecial: true },
  { id: 'y-039', code: 'BJKD00', name: 'YAMAHA GRAND FILANO HYBRID', brand: 'YAMAHA', price: 87500, isSpecial: true },
  { id: 'y-040', code: 'BJKE00', name: 'YAMAHA GRAND FILANO HYBRID', brand: 'YAMAHA', price: 93400, isSpecial: true },
  { id: 'y-041', code: 'B7D100', name: 'YAMAHA MT-15', brand: 'YAMAHA', price: 96300, isSpecial: true },
  { id: 'y-042', code: 'B7D300', name: 'YAMAHA MT-15', brand: 'YAMAHA', price: 108300, isSpecial: true },
  { id: 'y-043', code: 'B7D400', name: 'YAMAHA MT-15', brand: 'YAMAHA', price: 108400, isSpecial: true },
  { id: 'y-044', code: 'B7D500', name: 'YAMAHA MT-15', brand: 'YAMAHA', price: 111100, isSpecial: true },
  { id: 'y-045', code: 'B7D600', name: 'YAMAHA MT-15', brand: 'YAMAHA', price: 123500, isSpecial: true },
  { id: 'y-046', code: 'BTF100', name: 'YAMAHA NMAX', brand: 'YAMAHA', price: 118300, isSpecial: true },
  { id: 'y-047', code: 'BTF200', name: 'YAMAHA NMAX', brand: 'YAMAHA', price: 118300, isSpecial: true },
  { id: 'y-048', code: 'BTF300', name: 'YAMAHA NMAX', brand: 'YAMAHA', price: 129200, isSpecial: true },
  { id: 'y-049', code: 'BTM100', name: 'YAMAHA NMAX', brand: 'YAMAHA', price: 136300, isSpecial: true },
  { id: 'y-050', code: 'BTM200', name: 'YAMAHA NMAX', brand: 'YAMAHA', price: 136300, isSpecial: true },
  { id: 'y-051', code: 'D18100', name: 'YAMAHA PG-1', brand: 'YAMAHA', price: 73000, isSpecial: true },

  // =========================================================================
  // YAMAHA (หน้า 2/2) - PG-1, R3, SR400, WR155R, XMAX, XSR155, YZF-R15, R15M
  // =========================================================================
  { id: 'y-052', code: 'BKW100', name: 'YAMAHA PG-1', brand: 'YAMAHA', price: 82300, isSpecial: true },
  { id: 'y-053', code: 'BKW200', name: 'YAMAHA PG-1 (CAMPER)', brand: 'YAMAHA', price: 92400, isSpecial: true },
  { id: 'y-054', code: 'BKW300', name: 'YAMAHA PG-1 (TRACKER)', brand: 'YAMAHA', price: 92400, isSpecial: true },
  { id: 'y-055', code: 'BRA900', name: 'YAMAHA R3', brand: 'YAMAHA', price: 208200, isSpecial: true },
  { id: 'y-056', code: 'B9FB00', name: 'YAMAHA SR400', brand: 'YAMAHA', price: 315000, isSpecial: true },
  { id: 'y-057', code: 'B9FC00', name: 'YAMAHA SR400', brand: 'YAMAHA', price: 298000, isSpecial: true },
  { id: 'y-058', code: 'B3MA00', name: 'YAMAHA WR155R', brand: 'YAMAHA', price: 139100, isSpecial: true },
  { id: 'y-059', code: 'B3M800', name: 'YAMAHA WR155R Monster', brand: 'YAMAHA', price: 113200, isSpecial: true },
  { id: 'y-060', code: 'WR155R', name: 'YAMAHA WR155R Monster', brand: 'YAMAHA', price: 113200, isSpecial: true },
  { id: 'y-061', code: 'DR9200', name: 'YAMAHA XMAX', brand: 'YAMAHA', price: 176100, isSpecial: true },
  { id: 'y-062', code: 'DR9400', name: 'YAMAHA XMAX 300', brand: 'YAMAHA', price: 193000, isSpecial: true },
  { id: 'y-063', code: 'BKAW00', name: 'YAMAHA XMAX TECH MAX', brand: 'YAMAHA', price: 202500, isSpecial: true },
  { id: 'y-064', code: 'B1V600', name: 'YAMAHA XSR155', brand: 'YAMAHA', price: 104700, isSpecial: true },
  { id: 'y-065', code: 'B1V700', name: 'YAMAHA XSR155', brand: 'YAMAHA', price: 107000, isSpecial: true },
  { id: 'y-066', code: 'B1V800', name: 'YAMAHA XSR155 TRAXKER DESIGN', brand: 'YAMAHA', price: 117100, isSpecial: true },
  { id: 'y-067', code: 'B1V900', name: 'YAMAHA XSR155', brand: 'YAMAHA', price: 117100, isSpecial: true },
  { id: 'y-068', code: 'B1V800 TRACKER', name: 'YAMAHA XSR155 TRACKER', brand: 'YAMAHA', price: 140800, isSpecial: true },
  { id: 'y-069', code: 'BNCA00', name: 'YAMAHA YZF-R15', brand: 'YAMAHA', price: 162100, isSpecial: true },
  { id: 'y-070', code: 'BNCB00', name: 'YAMAHA R15M', brand: 'YAMAHA', price: 162100, isSpecial: true },
];

function normalizeCodeStr(s: string): string {
  return s
    .toUpperCase()
    .replace(/[\s\-_/().]+/g, '')
    .replace(/^DL(?=\d)/, 'D1');
}

/**
 * ค้นหารุ่นรถตามรหัสหรือชื่อรุ่น หรือแบรนด์ (รวมรุ่นที่บันทึกเองและฐานข้อมูลทางการ)
 */
export function searchMotorcycleModels(query: string, includeCustom = true): MotorcycleModel[] {
  const baseList = includeCustom ? getAllMotorcycleModels() : MOTORCYCLE_MODELS;
  if (!query || !query.trim()) {
    return baseList;
  }

  const clean = query.trim().toUpperCase().replace(/[\s\-_/().]+/g, '');
  const cleanNorm = normalizeCodeStr(query);

  return baseList.filter((item) => {
    const codeClean = item.code.toUpperCase().replace(/[\s\-_/().]+/g, '');
    const codeNorm = normalizeCodeStr(item.code);
    const nameClean = item.name.toUpperCase().replace(/[\s\-_/().]+/g, '');
    const brandClean = (item.brand || '').toUpperCase().replace(/[\s\-_/().]+/g, '');

    return (
      codeClean.includes(clean) ||
      codeNorm.includes(cleanNorm) ||
      nameClean.includes(clean) ||
      brandClean.includes(clean)
    );
  });
}

/**
 * ค้นหาชื่อรุ่นจากรหัสรุ่น (ยืดหยุ่นต่อช่องว่างหรือตัวพิมพ์เล็ก/ใหญ่ และรูปแบบ D1/DL)
 */
export function findModelByCode(code: string, includeCustom = true): MotorcycleModel | undefined {
  if (!code || !code.trim()) return undefined;
  const baseList = includeCustom ? getAllMotorcycleModels() : MOTORCYCLE_MODELS;
  const target = code.trim().toUpperCase().replace(/[\s\-_/().]+/g, '');
  const targetNorm = normalizeCodeStr(code);

  // 1. Exact clean match
  const exact = baseList.find((m) => {
    const cClean = m.code.toUpperCase().replace(/[\s\-_/().]+/g, '');
    const cNorm = normalizeCodeStr(m.code);
    return cClean === target || cNorm === targetNorm;
  });
  if (exact) return exact;

  // 2. Starts with clean prefix or contains
  return baseList.find((m) => {
    const cClean = m.code.toUpperCase().replace(/[\s\-_/().]+/g, '');
    const cNorm = normalizeCodeStr(m.code);
    return (
      cClean.startsWith(target) ||
      target.startsWith(cClean) ||
      cNorm.startsWith(targetNorm) ||
      targetNorm.startsWith(cNorm)
    );
  });
}
