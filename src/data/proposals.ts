import {
  ProposalDefinition,
  BikePreset,
  ProposalKey,
  CalculationResult,
  DownMode,
  TermComparisonItem,
  InsurancePlan,
  InsuranceYears,
  InsurancePlanDetail,
} from '../types';

export const INSURANCE_PLANS: Record<'plan_a' | 'plan_b', InsurancePlanDetail> = {
  plan_a: {
    id: 'plan_a',
    name: 'แผน A (PA ปกติ)',
    code: 'PA',
    badge: 'คุ้มครองอุบัติเหตุมาตรฐาน',
    premiums: {
      1: 670,
      2: 1340,
      3: 1950,
    },
    generalAccident: 80000,
    motorcycleAccident: 50000,
    assaultMurder: 50000,
    medicalExpense: 1000,
    funeralExpense: 10000,
    hospitalCompensationPerDay: 0,
  },
  plan_b: {
    id: 'plan_b',
    name: 'แผน B (PA PLUS)',
    code: 'PA+',
    badge: 'คุ้มครอง 200,000 + ชดเชยรายวัน 500/วัน',
    premiums: {
      1: 1329,
      2: 2658,
      3: 3987,
    },
    generalAccident: 200000,
    motorcycleAccident: 200000,
    assaultMurder: 200000,
    medicalExpense: 1000,
    funeralExpense: 10000,
    hospitalCompensationPerDay: 500, // สูงสุด 30 วัน/ปี
  },
};

/**
 * Removes '(PA ปกติ)' and '(PA PLUS)' from insurance plan names for customer-facing LINE messages
 */
export const cleanPlanNameForLine = (planName: string): string => {
  if (!planName) return '';
  return planName
    .replace(/\s*\(\s*PA\s*[-_]?\s*(?:ปกติ|standard|PLUS|plus)\s*\)\s*/gi, ' ')
    .replace(/\s*\bPA\s*[-_]?\s*(?:ปกติ|standard|PLUS|plus)\b\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const PROPOSALS: Record<ProposalKey, ProposalDefinition> = {
  small_bike: {
    key: 'small_bike',
    name: 'Small Bike',
    code: 'MS.MTS.0082/2568',
    category: 'รถครอบครัว / ออโตเมติกขนาดเล็ก',
    defaultDownMode: 'amount',
    defaultDownValue: 5000,
    validTerms: [12, 18, 24, 30, 36, 42],
    description: 'อัตราดอกเบี้ย Flat Rate 1.06% - 1.10% ต่อเดือน ตามระยะเวลางวดผ่อน',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    conditionNote: 'คำนวณตามหลักเกณฑ์เช่าซื้อมาตรฐาน Flat Rate',
  },
  fazzio: {
    key: 'fazzio',
    name: 'FAZZIO เท่านั้น',
    code: 'MS.MTS.0376/2569',
    category: 'Yamaha Fazzio เฉพาะรุ่น',
    defaultDownMode: 'amount',
    defaultDownValue: 5000,
    validTerms: [48],
    fixedTerm: 48,
    description: 'เงื่อนไขพิเศษเฉพาะ Yamaha FAZZIO อัตราคงที่ 1.10%/เดือน สำหรับ 48 งวด',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    conditionNote: 'เงื่อนไขเฉพาะเกรด Normal เท่านั้น (48 งวด)',
  },
  top_small: {
    key: 'top_small',
    name: 'Top Small',
    code: 'MS.MTS.0082/2568',
    category: 'พรีเมียม สกู๊ตเตอร์ 150-160cc (PCX, Click, ADV, Grand Filano)',
    defaultDownMode: 'amount',
    defaultDownValue: 10000,
    validTerms: [12, 18, 24, 30, 36, 42, 48],
    description: 'อัตราดอกเบี้ย 1.06% - 1.11% ต่อเดือน ผ่อนได้สูงสุดถึง 48 งวด',
    badgeColor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    conditionNote: 'กลุ่มรถยอดนิยม 12-36 งวด ดอกเบี้ย 1.06% ต่อเดือน (MS.MTS.0082/2568)',
  },
  aec: {
    key: 'aec',
    name: 'AEC',
    code: 'MS.MTS.0093/2568',
    category: 'ข้อเสนอพิเศษสำหรับลูกค้ากลุ่ม AEC',
    defaultDownMode: 'amount',
    defaultDownValue: 10000,
    validTerms: [12, 18, 24, 30, 36, 42, 48],
    description: 'อัตราดอกเบี้ย 1.06% - 1.11% ต่อเดือน ตามเกณฑ์เงื่อนไข AEC',
    badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
    conditionNote: 'ข้อเสนอพิเศษสำหรับลูกค้ากลุ่ม AEC (MS.MTS.0093/2568)',
  },
  vespa: {
    key: 'vespa',
    name: 'VESPA / LAMBRETTA',
    code: 'MS.MTS.0351/2569',
    category: 'พรีเมียมคลาสสิกอิตาเลียน สกู๊ตเตอร์',
    defaultDownMode: 'amount',
    defaultDownValue: 20000,
    validTerms: [12, 18, 24, 30, 36, 42, 48, 60],
    description: 'อัตราดอกเบี้ยคิดเป็นรายปีตามขั้นบันไดเงินดาวน์ (6.75% - 9.00% ต่อปี)',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    conditionNote: 'ดาวน์ 35,000+ รับดอกเบี้ยต่ำสุด 6.75% ต่อปี',
  },
  honda_yamaha: {
    key: 'honda_yamaha',
    name: 'Honda, Yamaha 250-399 CC.',
    code: 'MS.MTS.0098/2569',
    category: 'มิดเดิลคลาส บิ๊กสกู๊ตเตอร์ & สปอร์ต (Forza 350, XMAX, CBR300R)',
    defaultDownMode: 'percent',
    defaultDownValue: 15,
    validTerms: [12, 18, 24, 30, 36, 42, 48, 60],
    description: 'คิดอัตราดอกเบี้ยรายปีตามร้อยละของเงินดาวน์ (5.00% - 7.00% ต่อปี)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    conditionNote: 'ดาวน์ขั้นต่ำ 10% (แนะนำดาวน์ 20% เพื่อรับดอกเบี้ย 5.00% ต่อปี)',
  },
  second_hand: {
    key: 'second_hand',
    name: 'รถมือสอง 2 ND',
    code: 'MP.MAP.0080/2568',
    category: 'รถจักรยานยนต์ใช้แล้วสภาพดี',
    defaultDownMode: 'amount',
    defaultDownValue: 5000,
    validTerms: [24, 30, 36, 42],
    description: 'อัตราดอกเบี้ย 1.06% - 1.09% ต่อเดือน พร้อมเกณฑ์ดอกเบี้ยรวมขั้นต่ำ 7,000 บาท',
    badgeColor: 'bg-rose-100 text-rose-700 border-rose-200',
    minInterestRule: 7000,
    conditionNote: 'มีเกณฑ์ดอกเบี้ยรวมขั้นต่ำทั้งสัญญา 7,000 บาท',
  },
};

export const BIKE_PRESETS: BikePreset[] = [
  // =========================================================================
  // HONDA - รถครอบครัว และ ออโตเมติกยอดนิยม (อัปเดตราคาทางการ Next Capital)
  // =========================================================================
  {
    id: 'giorno-plus-cbs',
    code: 'ACF125CBT TH',
    name: 'HONDA GIORNO+ (CBS)',
    brand: 'Honda',
    price: 80300,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • คอมบายเบรก สไตล์ High Fashion',
    popular: true,
  },
  {
    id: 'giorno-plus-abs',
    code: 'ACF125CAT TH',
    name: 'HONDA GIORNO+ (ABS)',
    brand: 'Honda',
    price: 86500,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ระบบเบรก ABS ปลอดภัยมั่นใจ',
    popular: true,
  },
  {
    id: 'wave-110i-drum',
    code: 'AFS110KDBT TH',
    name: 'HONDA WAVE 110 (สตาร์ทเท้า/ดรัมเบรก)',
    brand: 'Honda',
    price: 49100,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สตาร์ทเท้า ประหยัดน้ำมัน คุ้มค่า',
    popular: true,
  },
  {
    id: 'wave-110i-mag',
    code: 'AFS110MCBT TH',
    name: 'HONDA Wave 110 (สตาร์ทมือ/ล้อแม็ก)',
    brand: 'Honda',
    price: 60800,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สตาร์ทมือ ล้อแม็กยอดนิยม',
    popular: true,
  },
  {
    id: 'wave-110i-spoke',
    code: 'AFS110KDFR 3TH',
    name: 'HONDA WAVE 110i (สตาร์ทเท้า/ล้อซี่ลวด)',
    brand: 'Honda',
    price: 46800,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ราคาเริ่มต้นสบายกระเป๋า',
    popular: true,
  },
  {
    id: 'wave-110i-mcfr4',
    code: 'AFS110MCFR 4TH',
    name: 'HONDA WAVE 110i (สตาร์ทมือ/ล้อแม็ก 4TH)',
    brand: 'Honda',
    price: 58400,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สปอร์ต ล้อแม็กดีไซน์เฉียบ',
  },
  {
    id: 'wave-125i-mag',
    code: 'AFS125CSBT TH',
    name: 'HONDA WAVE 125i (ล้อแม็ก)',
    brand: 'Honda',
    price: 74800,
    proposalKey: 'small_bike',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ผู้นำรถครอบครัวพรีเมียม',
    popular: true,
  },
  {
    id: 'wave-125-2th',
    code: 'AFS125CSBT 2TH',
    name: 'HONDA WAVE 125 (โฉมใหม่)',
    brand: 'Honda',
    price: 76500,
    proposalKey: 'small_bike',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ดีไซน์สง่างาม สมรรถนะสูง',
    popular: true,
  },
  {
    id: 'wave-125-profender',
    code: 'AFS125CSBT 2TH.',
    name: 'HONDA WAVE125 x PROFENDER TH1',
    brand: 'Honda',
    price: 83600,
    proposalKey: 'small_bike',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • โช้ค Profender ลิมิเต็ด',
    popular: true,
  },
  {
    id: 'lead-125',
    code: 'NHX125T TH',
    name: 'HONDA LEAD125',
    brand: 'Honda',
    price: 75100,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • U-Box ใหญ่จุใจ 37 ลิตร',
    popular: true,
  },
  {
    id: 'lead-125-ohlins',
    code: 'NHX125S 2TH(TH1)',
    name: 'HONDA LEAD125 TH1 Ohlins',
    brand: 'Honda',
    price: 87900,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สเปเชียล อิดิชั่น โช้ค Ohlins',
  },
  {
    id: 'pcx-160-std',
    code: 'WW160AP TH',
    name: 'HONDA PCX160 (Standard)',
    brand: 'Honda',
    price: 113200,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • พรีเมียม เอ.ที. สแตนดาร์ด',
    popular: true,
  },
  {
    id: 'pcx-160-as',
    code: 'WW160AS TH',
    name: 'HONDA PCX160 (ABS)',
    brand: 'Honda',
    price: 116100,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ระบบเบรก ABS ปลอดภัยขั้นสุด',
    popular: true,
  },
  {
    id: 'pcx-160-ss',
    code: 'WW160SS TH',
    name: 'HONDA PCX160 (SS)',
    brand: 'Honda',
    price: 120800,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • สปอร์ต พรีเมียม ท็อปคลาส',
    popular: true,
  },
  {
    id: 'scoopy-club12',
    code: 'ACF110CBTR TH',
    name: 'HONDA Scoopy CLUB 12',
    brand: 'Honda',
    price: 68400,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ล้อแม็ก 12 นิ้ว สตรีทแฟชั่น',
    popular: true,
  },
  {
    id: 'scoopy-prestige',
    code: 'ACF110CBTP 3TH',
    name: 'HONDA SCOOPY PRESTIGE',
    brand: 'Honda',
    price: 66000,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • เรียบหรู คลาสสิกพรีเมียม',
    popular: true,
  },
  {
    id: 'scoopy-urban',
    code: 'ACF110BTP 2TH',
    name: 'HONDA SCOOPY URBAN',
    brand: 'Honda',
    price: 62800,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สไตล์มินิมอล ล้อซี่ลวดคล่องตัว',
    popular: true,
  },
  {
    id: 'scoopy-kuromi',
    code: 'ACF110CBTS TH(TH3)',
    name: 'HONDA SCOOPY X KUROMI',
    brand: 'Honda',
    price: 76500,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ลิมิเต็ดคอลเลกชัน ลาย Kuromi',
  },
  {
    id: 'super-cub',
    code: 'NBC110MSBT TH',
    name: 'HONDA SUPER CUB',
    brand: 'Honda',
    price: 63600,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ออริจินัล เรโทรแจแปนสุดคลาสสิก',
    popular: true,
  },
  {
    id: 'click-125',
    code: 'ACB125CBTP TH',
    name: 'HONDA CLICK125 (ล้อแม็ก)',
    brand: 'Honda',
    price: 71400,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สปอร์ต เอ.ที. ยอดนิยมอันดับ 1',
    popular: true,
  },
  {
    id: 'click-160-abs',
    code: 'ACB160CATN TH',
    name: 'HONDA CLICK 160 ABS',
    brand: 'Honda',
    price: 76200,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • เร้าใจ 160cc เบรก ABS',
    popular: true,
  },
  {
    id: 'click-160-std',
    code: 'ACB160CATR TH',
    name: 'HONDA CLICK160',
    brand: 'Honda',
    price: 84700,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • พลัง eSP+ 4 วาล์วเต็มพิกัด',
    popular: true,
  },
  {
    id: 'adv-160',
    code: 'ADV160AP TH',
    name: 'HONDA ADV160',
    brand: 'Honda',
    price: 120800,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • SUV Bike ลุยได้ทุกสภาพถนน',
    popular: true,
  },
  {
    id: 'adv-350',
    code: 'ADV350AS 3TH',
    name: 'HONDA ADV350 RoadSync type',
    brand: 'Honda',
    price: 192400,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • บิ๊กสกู๊ตเตอร์แอดเวนเจอร์ทัวร์ริ่ง',
    popular: true,
  },
  {
    id: 'forza-350',
    code: 'NSS350AP TH',
    name: 'HONDA FORZA350',
    brand: 'Honda',
    price: 196000,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • บิ๊กสกู๊ตเตอร์หรูหราทรงพลัง',
    popular: true,
  },
  {
    id: 'cbr-150r',
    code: 'CBR150RAM 5TH',
    name: 'HONDA CBR150R',
    brand: 'Honda',
    price: 108900,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • เรซซิ่งสปอร์ตพันธ์ุแท้ระดับตำนาน',
  },
  {
    id: 'ct-125',
    code: 'CT125AP TH',
    name: 'HONDA CT125 Standard',
    brand: 'Honda',
    price: 100800,
    proposalKey: 'small_bike',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • เทรลไบค์สไตล์เอาท์ดอร์',
  },
  {
    id: 'dax-125',
    code: 'ST125AP TH',
    name: 'HONDA DAX125 Standard',
    brand: 'Honda',
    price: 97000,
    proposalKey: 'small_bike',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ไอคอนิกมินิไบค์เฟรม T-Bone',
  },

  // =========================================================================
  // YAMAHA - สกู๊ตเตอร์ และ รถครอบครัวยอดนิยม (อัปเดตราคาทางการ Next Capital)
  // =========================================================================
  {
    id: 'fazzio-std',
    code: 'BKF100',
    name: 'YAMAHA FAZZIO',
    brand: 'Yamaha',
    price: 69300,
    proposalKey: 'fazzio',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • สกู๊ตเตอร์แฟชั่นวัยรุ่น ดอกเบี้ยพิเศษ',
    popular: true,
  },
  {
    id: 'fazzio-hybrid',
    code: 'BKFD00',
    name: 'YAMAHA FAZZIO HYBRID',
    brand: 'Yamaha',
    price: 66800,
    proposalKey: 'fazzio',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • บลูคอร์ไฮบริด คุ้มค่าผ่อนสูงสุด 48 งวด',
    popular: true,
  },
  {
    id: 'fazzio-econ',
    code: 'BKFB00',
    name: 'YAMAHA FAZZIO (รุ่นประหยัด)',
    brand: 'Yamaha',
    price: 62900,
    proposalKey: 'fazzio',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • คล่องตัว ประหยัดสุดคุ้ม',
  },
  {
    id: 'grand-filano-hybrid',
    code: 'BJK400',
    name: 'YAMAHA Grand Filano Hybrid',
    brand: 'Yamaha',
    price: 86200,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • พรีเมียม ออโตเมติก ไฮบริดยอดนิยม',
    popular: true,
  },
  {
    id: 'grand-filano-c00',
    code: 'BJKC00',
    name: 'YAMAHA GRAND FILANO HYBRID',
    brand: 'Yamaha',
    price: 81900,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • สไตล์โมเดิร์นคลาสสิก หรูหราทุกมุมมอง',
    popular: true,
  },
  {
    id: 'grand-filano-connected',
    code: 'BJK900',
    name: 'YAMAHA Grand Filano Hybrid Connected',
    brand: 'Yamaha',
    price: 98300,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ท็อปคลาส เชื่อมต่อแอพ Y-Connect',
    popular: true,
  },
  {
    id: 'finn-mag',
    code: 'DA6200',
    name: 'YAMAHA FINN (สตาร์ทมือ/ล้อแม็ก)',
    brand: 'Yamaha',
    price: 60800,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ทนทาน ประหยัดน้ำมัน รับประกัน 5 ปี',
    popular: true,
  },
  {
    id: 'finn-kick',
    code: 'DT0100',
    name: 'YAMAHA FINN (สตาร์ทเท้า)',
    brand: 'Yamaha',
    price: 52100,
    proposalKey: 'small_bike',
    defaultDownPercent: 10,
    badge: 'ราคาทางการ Next Capital • ราคาเริ่มต้น สบายกระเป๋า',
  },
  {
    id: 'aerox-155',
    code: 'BWR100',
    name: 'YAMAHA AEROX',
    brand: 'Yamaha',
    price: 100700,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • สปอร์ต ออโตเมติก สไตล์เรซซิ่งพันธุ์แท้',
    popular: true,
  },
  {
    id: 'aerox-sp',
    code: 'D13100',
    name: 'YAMAHA AEROX SP',
    brand: 'Yamaha',
    price: 117100,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ซูเปอร์สปอร์ต อิดิชั่นพิเศษ',
  },
  {
    id: 'pg-1-std',
    code: 'D18100',
    name: 'YAMAHA PG-1',
    brand: 'Yamaha',
    price: 73000,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • เอาท์ดอร์ ไลฟ์สไตล์ ลุยได้ทุกที่',
    popular: true,
  },
  {
    id: 'pg-1-bkw',
    code: 'BKW100',
    name: 'YAMAHA PG-1 (BKW)',
    brand: 'Yamaha',
    price: 82300,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • แต่งลุยสไตล์สายแคมป์',
  },
  {
    id: 'pg-1-camper',
    code: 'BKW200',
    name: 'YAMAHA PG-1 (CAMPER)',
    brand: 'Yamaha',
    price: 92400,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • อุปกรณ์แต่ง CAMPER พร้อมลุย',
    popular: true,
  },
  {
    id: 'nmax-155',
    code: 'BTF100',
    name: 'YAMAHA NMAX',
    brand: 'Yamaha',
    price: 118300,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • MAX Series หรูหรา อัจฉริยะ',
    popular: true,
  },
  {
    id: 'nmax-155-btm',
    code: 'BTM100',
    name: 'YAMAHA NMAX (BTM)',
    brand: 'Yamaha',
    price: 136300,
    proposalKey: 'top_small',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • สเปกท็อป ฟังก์ชันล้ำสมัย',
  },
  {
    id: 'xmax-300',
    code: 'DR9200',
    name: 'YAMAHA XMAX',
    brand: 'Yamaha',
    price: 176100,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • บิ๊กสกู๊ตเตอร์สปอร์ตยอดนิยมอันดับ 1',
    popular: true,
  },
  {
    id: 'xmax-techmax',
    code: 'BKAW00',
    name: 'YAMAHA XMAX TECH MAX',
    brand: 'Yamaha',
    price: 202500,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • ท็อปสุด Tech Max หน้าจอ TFT คู่',
    popular: true,
  },
  {
    id: 'xsr-155',
    code: 'B1V600',
    name: 'YAMAHA XSR155',
    brand: 'Yamaha',
    price: 104700,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • สปอร์ต เฮอริเทจ ขับเคลื่อนตำนาน',
    popular: true,
  },
  {
    id: 'mt-15',
    code: 'B7D100',
    name: 'YAMAHA MT-15',
    brand: 'Yamaha',
    price: 96300,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • เน็กเก็ตไบค์สปอร์ตดุดัน Dark Side of Japan',
    popular: true,
  },
  {
    id: 'exciter-155',
    code: 'BAW100',
    name: 'YAMAHA Exciter 155',
    brand: 'Yamaha',
    price: 74600,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • สปอร์ตโมเพด เกียร์ 6 สปีด คลัตช์มือ',
  },
  {
    id: 'wr-155r',
    code: 'B3MA00',
    name: 'YAMAHA WR155R',
    brand: 'Yamaha',
    price: 139100,
    proposalKey: 'honda_yamaha',
    defaultDownPercent: 15,
    badge: 'ราคาทางการ Next Capital • เอ็นดูโร่สายลุยพันธุ์แท้ 155cc VVA',
  },

  // =========================================================================
  // VESPA & LAMBRETTA - พรีเมียมสกู๊ตเตอร์นำเข้า
  // =========================================================================
  {
    id: 'vespa-sprint-150',
    name: 'Vespa Sprint 150 i-Get ABS',
    brand: 'Vespa',
    price: 139900,
    proposalKey: 'vespa',
    defaultDownPercent: 20,
    badge: 'MSRP • ไอคอนิก อิตาเลียน ดีไซน์ระดับโลก',
    popular: true,
  },
  {
    id: 'vespa-primavera-150',
    name: 'Vespa Primavera 150',
    brand: 'Vespa',
    price: 134900,
    proposalKey: 'vespa',
    defaultDownPercent: 20,
    badge: 'MSRP • คลาสสิก อมตะ สง่างาม',
    popular: true,
  },
  {
    id: 'lambretta-x300',
    name: 'Lambretta X300',
    brand: 'Lambretta',
    price: 154900,
    proposalKey: 'vespa',
    defaultDownPercent: 20,
    badge: 'MSRP • สกู๊ตเตอร์ดีไซน์สุดล้ำจากมิลาน',
    popular: true,
  },
  {
    id: 'lambretta-v200',
    name: 'Lambretta V200 Special',
    brand: 'Lambretta',
    price: 103000,
    proposalKey: 'vespa',
    defaultDownPercent: 20,
    badge: 'MSRP • สกู๊ตเตอร์คลาสสิกในตำนาน',
  },
  {
    id: 'used-standard',
    name: 'รถจักรยานยนต์มือสอง เกรด A (2ND)',
    brand: 'Other',
    price: 36000,
    proposalKey: 'second_hand',
    defaultDownPercent: 15,
    badge: 'ตรวจสภาพพร้อมใช้งาน มาตรฐาน Next Capital',
    popular: true,
  },
];

/**
 * คำนวณอัตราดอกเบี้ย Flat Rate ต่อเดือนสูงสุดที่ไม่เกินเพดาน EIR (Effective Interest Rate) 23% ต่อปี
 * ตามเกณฑ์ควบคุมสัญญาเช่าซื้อรถจักรยานยนต์ของ สคบ. และระบบอนุมัติของ Next Capital
 * โดยสำหรับ 36 งวด ระบบ Next Capital กำหนดใช้อัตราสูงสุด 1.089% (ไม่เกินเพดาน EIR 23%)
 */
export function getMaxAllowedMonthlyFlatRate(term: number): number {
  if (term <= 0) return 0.011;
  if (term === 36) return 0.01089; // 1.089% ตรงตามระบบจริง Next Capital
  const targetEirAnnual = 0.2292; // 22.92% ปลอดภัยใต้เพดาน 23.00%
  const rMonth = targetEirAnnual / 12;
  const annuity = (1 - Math.pow(1 + rMonth, -term)) / rMonth;
  const rawFlat = 1 / annuity - 1 / term;
  // ปัดทศนิยม 3 ตำแหน่ง เช่น 0.01088998... -> 0.01089 (1.089%)
  return Math.floor(rawFlat * 100000 + 0.5) / 100000;
}

/**
 * คำนวณอัตราดอกเบี้ยที่แท้จริงต่อปี (Nominal EIR % ต่อปี) จากเงินต้น ค่างวด และจำนวนงวด
 */
export function calculateLoanNominalEIR(pv: number, pmt: number, term: number): number {
  if (pv <= 0 || pmt <= 0 || term <= 0) return 0;
  let r = 0.02; // Initial guess per month (~24% per year)
  for (let i = 0; i < 40; i++) {
    const powTerm = Math.pow(1 + r, -term);
    const f = (pmt * (1 - powTerm)) / r - pv;
    const df =
      pmt *
      ((term * Math.pow(1 + r, -term - 1)) / r - (1 - powTerm) / (r * r));
    if (Math.abs(df) < 1e-12) break;
    const newR = r - f / df;
    if (Math.abs(newR - r) < 1e-7) {
      r = newR;
      break;
    }
    r = newR;
  }
  return Math.max(0, r * 12 * 100);
}

/**
 * ปัดเศษค่างวดตามเกณฑ์ระบบของบริษัท Next Capital:
 * ค่างวดเช่าซื้อจะปัดขึ้นลงท้ายด้วย 0 หรือ 5
 * - หากเศษหลักหน่วย 1 ถึง 5 จะปัดเป็น 5 (เช่น 2,411 -> 2,415)
 * - หากเศษหลักหน่วยมากกว่า 5 จะปัดขึ้นเป็นหลักสิบ (เช่น 2,416 -> 2,420)
 * สูตรทางคณิตศาสตร์คือ Math.ceil(raw / 5) * 5
 */
export function roundNextCapitalInstallment(rawInstallment: number): number {
  if (rawInstallment <= 0) return 0;
  return Math.ceil(rawInstallment / 5) * 5;
}

export function calculateLease(
  proposalKey: ProposalKey,
  price: number,
  downValue: number,
  downMode: DownMode,
  term: number,
  registrationFee: number = 0,
  theftInsuranceFee: number = 0,
  insurancePlan: InsurancePlan = 'none',
  insuranceYears: InsuranceYears = 1
): CalculationResult {
  const proposal = PROPOSALS[proposalKey];
  const safeBasePrice = Math.max(0, price || 0);

  // Compute effective down amount and percent based on base vehicle price
  let downAmount = 0;
  let downPercent = 0;

  if (downMode === 'percent') {
    downPercent = Math.max(0, Math.min(100, downValue || 0));
    downAmount = safeBasePrice * (downPercent / 100);
  } else {
    downAmount = Math.max(0, Math.min(safeBasePrice, downValue || 0));
    downPercent = safeBasePrice > 0 ? (downAmount / safeBasePrice) * 100 : 0;
  }

  // ยอดจัดเฉพาะตัวรถ (ราคารถ - เงินดาวน์ เช่น 71,500)
  const vehicleFinanceAmount = Math.max(0, safeBasePrice - downAmount);

  // Insurance premium computation:
  // ค่าเบี้ยประกันให้นำมาคำนวณภาษี 7% ก่อน แล้วค่อยมารวมกับราคารถ เป็นยอดจัดไฟแนนซ์
  // ตัวอย่าง: ค่าเบี้ยประกัน 3,987 * 7% = 279.09 ค่าเบี้ยรวมภาษี = 4,266.09
  // มารวมกับ 71,500 = 75,766.09 (ยอดจัดไฟแนนซ์)
  let insuranceBasePremium = 0;
  let insuranceVat = 0;
  let insuranceTotalWithVat = 0;
  let insurancePlanName = 'ไม่รับความคุ้มครอง PA';

  if (insurancePlan !== 'none' && INSURANCE_PLANS[insurancePlan]) {
    const planDetail = INSURANCE_PLANS[insurancePlan];
    insuranceBasePremium = planDetail.premiums[insuranceYears] || 0;
    insurancePlanName = `${planDetail.name} (คุ้มครอง ${insuranceYears} ปี)`;
    insuranceVat = Number((insuranceBasePremium * 0.07).toFixed(2));
    insuranceTotalWithVat = Number((insuranceBasePremium + insuranceVat).toFixed(2));
  }

  // ยอดจัดไฟแนนซ์รวม = ยอดจัดตัวรถ + ค่าเบี้ยประกันรวมภาษี 7%
  const financeAmount = Number((vehicleFinanceAmount + insuranceTotalWithVat).toFixed(2));

  // Fallback term if invalid for proposal
  let validTerm = term;
  if (!proposal.validTerms.includes(term)) {
    validTerm = proposal.validTerms[0];
  }

  let proposalMonthlyRate = 0;
  let annualRate = 0;
  let isAnnualRate = false;
  let rateDisplayText = '';
  let remarkText = proposal.conditionNote || 'คำนวณตามเงื่อนไข Proposal';

  if (proposalKey === 'small_bike') {
    if (validTerm === 12) proposalMonthlyRate = 0.0106;
    else if (validTerm === 18) proposalMonthlyRate = 0.0107;
    else if (validTerm === 24) proposalMonthlyRate = 0.0107;
    else if (validTerm === 30) proposalMonthlyRate = 0.0108;
    else if (validTerm === 36) proposalMonthlyRate = 0.0109; // ขออัตรา 1.090%
    else proposalMonthlyRate = 0.011; // 42
    rateDisplayText = `${(proposalMonthlyRate * 100).toFixed(2)}% ต่อเดือน (Flat Rate)`;
  } else if (proposalKey === 'fazzio') {
    proposalMonthlyRate = 0.011;
    validTerm = 48;
    rateDisplayText = '1.10% ต่อเดือน (48 งวด)';
    remarkText = 'เงื่อนไขเฉพาะเกรด Normal เท่านั้น (48 งวด)';
  } else if (proposalKey === 'top_small' || proposalKey === 'aec') {
    if (validTerm <= 36) proposalMonthlyRate = 0.0106;
    else if (validTerm === 42) proposalMonthlyRate = 0.011;
    else proposalMonthlyRate = 0.0111; // 48
    rateDisplayText = `${(proposalMonthlyRate * 100).toFixed(2)}% ต่อเดือน (Flat Rate)`;
  } else if (proposalKey === 'vespa') {
    isAnnualRate = true;
    if (downAmount >= 35000) annualRate = 0.0675;
    else if (downAmount >= 25000) annualRate = 0.07;
    else if (downAmount >= 20000) annualRate = 0.0725;
    else if (downAmount >= 15000) annualRate = 0.075;
    else annualRate = 0.09;

    proposalMonthlyRate = annualRate / 12;
    rateDisplayText = `${(annualRate * 100).toFixed(2)}% ต่อปี (${(proposalMonthlyRate * 100).toFixed(3)}%/เดือน)`;
    remarkText = `ขั้นบันไดเงินดาวน์: ${(annualRate * 100).toFixed(2)}% ต่อปี`;
  } else if (proposalKey === 'honda_yamaha') {
    isAnnualRate = true;
    if (downPercent >= 20) {
      annualRate = validTerm <= 48 ? 0.05 : 0.055;
    } else if (downPercent >= 15) {
      annualRate = validTerm <= 48 ? 0.055 : 0.06;
    } else {
      annualRate = 0.07;
    }
    proposalMonthlyRate = annualRate / 12;
    rateDisplayText = `${(annualRate * 100).toFixed(2)}% ต่อปี (ดาวน์ ${downPercent.toFixed(0)}%)`;
    remarkText = `ดาวน์ ${downPercent.toFixed(1)}% | ดอกเบี้ย ${(annualRate * 100).toFixed(2)}% ต่อปี`;
  } else if (proposalKey === 'second_hand') {
    if (validTerm === 24 || validTerm === 30) proposalMonthlyRate = 0.0106;
    else if (validTerm === 36) proposalMonthlyRate = 0.0108;
    else proposalMonthlyRate = 0.0109; // 42
    rateDisplayText = `${(proposalMonthlyRate * 100).toFixed(2)}% ต่อเดือน`;
    remarkText = 'มีเกณฑ์ดอกเบี้ยรวมขั้นต่ำ 7,000 บาท';
  }

  // ============================================================
  // EIR (Effective Interest Rate) Control Logic (เพดานไม่เกิน 23% ต่อปี)
  // ============================================================
  const maxAllowedMonthlyRate = isAnnualRate
    ? 0.23 / 12
    : getMaxAllowedMonthlyFlatRate(validTerm);

  // ตรวจสอบว่าอัตราที่ขอมาตาม Proposal เกินเพดาน EIR 23% หรือไม่
  // หากเกิน: ระบบทำการล็อกและบังคับให้ใช้อัตราสูงสุดที่ไม่ผิดกฎหมาย
  const isCappedByEir = !isAnnualRate && proposalMonthlyRate > maxAllowedMonthlyRate;
  const effectiveMonthlyRate = isCappedByEir ? maxAllowedMonthlyRate : proposalMonthlyRate;
  const monthlyRate = effectiveMonthlyRate;

  // ข้อความกำกับอัตราสูงสุด
  const maxRateDisplayStr = (maxAllowedMonthlyRate * 100).toFixed(3);
  const eirMaxMessage = `สูงสุด ${maxRateDisplayStr} เป็นอัตราดอกเบี้ยไม่เกิน EIR 23%`;

  let eirReason = '';
  if (isCappedByEir) {
    rateDisplayText = `${(effectiveMonthlyRate * 100).toFixed(3)}% ต่อเดือน (สูงสุดตามเกณฑ์ EIR 23%)`;
    eirReason = `เนื่องจากตามเงื่อนไขของเคสนี้ (ราคารถ ${formatBaht(safeBasePrice)}, เงินดาวน์ ${formatBaht(downAmount)} และระยะเวลาผ่อน ${validTerm} งวด) หากใช้ดอกเบี้ย ${(proposalMonthlyRate * 100).toFixed(3)}% จะทำให้อัตราดอกเบี้ยที่แท้จริงต่อปี (EIR) สูงเกินเพดานกฎหมายกำหนด (ไม่เกิน 23% ต่อปี) ระบบจึงทำการล็อกและบังคับให้ใช้อัตราสูงสุดที่ไม่ผิดกฎหมาย คือ ${(effectiveMonthlyRate * 100).toFixed(3)}% แทน เพื่อให้ชุดข้อมูลชุดนี้ผ่านเกณฑ์การอนุมัติครับ`;
  } else {
    eirReason = `อัตราดอกเบี้ย ${(effectiveMonthlyRate * 100).toFixed(3)}% ต่อเดือน อยู่ในเกณฑ์ควบคุมสัญญาเช่าซื้อ ไม่เกินเพดาน EIR 23% ต่อปี`;
  }

  // Calculate Interest:
  let monthlyInterest = 0;
  let totalInterest = 0;

  if (isAnnualRate) {
    monthlyInterest = financeAmount * (annualRate / 12);
    totalInterest = financeAmount * annualRate * (validTerm / 12);
  } else {
    monthlyInterest = financeAmount * effectiveMonthlyRate;
    totalInterest = monthlyInterest * validTerm;
  }

  let minInterestApplied = false;
  if (proposalKey === 'second_hand' && totalInterest < 7000 && financeAmount > 0) {
    totalInterest = 7000;
    monthlyInterest = validTerm > 0 ? 7000 / validTerm : 0;
    minInterestApplied = true;
    remarkText = 'ปรับใช้ดอกเบี้ยขั้นต่ำตามเกณฑ์ 7,000 บาท';
  }


  // คำนวณยอดรวมสัญญาดิบและค่างวดดิบก่อนปัดเศษ
  const rawContractTotal = financeAmount + totalInterest;
  const rawMonthlyInstallment =
    validTerm > 0 ? Number((rawContractTotal / validTerm).toFixed(2)) : 0;

  // ค่างวดต่อเดือนตามเกณฑ์ระบบ Next Capital (ปัดเศษลงท้าย 0 หรือ 5: เศษ 1-5 ปัดเป็น 5 เช่น 2,411 -> 2,415, เศษ > 5 ปัดขึ้นหลักสิบ เช่น 2,416 -> 2,420)
  const monthlyInstallment = roundNextCapitalInstallment(rawMonthlyInstallment);
  const roundingRuleNote =
    'ปัดเศษค่างวดลงท้ายด้วย 0 หรือ 5 ตามระบบ Next Capital (เศษ ≤ 5 ปัดเป็น 5, เศษ > 5 ปัดขึ้นหลักสิบ)';

  // ยอดรวมทั้งสัญญาตามค่างวดจริง
  const totalWithVat = monthlyInstallment * validTerm;

  // คำนวณ EIR แท้จริงที่เกิดขึ้นจริง
  const eirAnnualPercent = Number(
    calculateLoanNominalEIR(financeAmount, monthlyInstallment, validTerm).toFixed(2)
  );

  // การจำแนก VAT 7% ตามหลักเกณฑ์ภาษีเช่าซื้อ
  const vatAmount = Number(((totalWithVat * 7) / 107).toFixed(2));
  const totalBeforeVat = Number((totalWithVat - vatAmount).toFixed(2));

  const totalDriveAwayCost = downAmount + registrationFee + theftInsuranceFee;

  return {
    proposalCode: proposal.code,
    proposalName: proposal.name,
    baseVehiclePrice: safeBasePrice,
    vehiclePrice: safeBasePrice,
    downAmount,
    downPercent,
    vehicleFinanceAmount,
    baseFinanceAmount: vehicleFinanceAmount,
    insurancePlan,
    insurancePlanName,
    insuranceYears,
    insurancePremium: insuranceBasePremium,
    insuranceBasePremium,
    insuranceVat,
    insuranceTotalWithVat,
    financeAmount,
    term: validTerm,
    rateDisplayText,
    monthlyRate,
    annualRate,
    isAnnualRate,
    proposalMonthlyRate,
    maxAllowedMonthlyRate,
    effectiveMonthlyRate,
    isCappedByEir,
    eirMaxMessage,
    eirAnnualPercent,
    eirReason,
    monthlyInterest,
    totalInterest,
    minInterestApplied,
    totalBeforeVat,
    vatAmount,
    totalWithVat,
    rawMonthlyInstallment,
    monthlyInstallment,
    roundingRuleNote,
    remarkText,
    registrationFee,
    theftInsuranceFee,
    totalDriveAwayCost,
  };
}

export function getTermComparisons(
  proposalKey: ProposalKey,
  price: number,
  downValue: number,
  downMode: DownMode,
  currentTerm: number,
  insurancePlan: InsurancePlan = 'none',
  insuranceYears: InsuranceYears = 1
): TermComparisonItem[] {
  const proposal = PROPOSALS[proposalKey];
  return proposal.validTerms.map((t) => {
    // คำนวณตามแผนปัจจุบัน (หากเลือกประกัน รวมยอดจัดประกัน)
    const res = calculateLease(
      proposalKey,
      price,
      downValue,
      downMode,
      t,
      0,
      0,
      insurancePlan,
      insuranceYears
    );

    // คำนวณเคสตัวรถล้วน (ไม่รวมประกัน) เป็นฐานเปรียบเทียบเสมอ
    const resNoInsurance = calculateLease(
      proposalKey,
      price,
      downValue,
      downMode,
      t,
      0,
      0,
      'none',
      1
    );

    // คำนวณทางเลือกแผน A และ B สำหรับดูส่วนต่างกรณีปัจจุบันยังไม่ได้เลือกประกัน
    const resPlanA = calculateLease(
      proposalKey,
      price,
      downValue,
      downMode,
      t,
      0,
      0,
      'plan_a',
      insuranceYears || 1
    );

    const resPlanB = calculateLease(
      proposalKey,
      price,
      downValue,
      downMode,
      t,
      0,
      0,
      'plan_b',
      insuranceYears || 1
    );

    const hasInsurance = insurancePlan !== 'none';
    const monthlyInstallmentWithoutInsurance = resNoInsurance.monthlyInstallment;
    const insuranceMonthlyDiff = Math.max(
      0,
      res.monthlyInstallment - resNoInsurance.monthlyInstallment
    );
    const totalWithoutInsurance = resNoInsurance.totalWithVat;
    const insuranceTotalDiff = Math.max(0, res.totalWithVat - resNoInsurance.totalWithVat);

    return {
      term: t,
      monthlyInstallment: res.monthlyInstallment,
      totalInterest: res.totalInterest,
      totalWithVat: res.totalWithVat,
      rateDisplayText: res.rateDisplayText,
      isCurrent: t === currentTerm,
      proposalMonthlyRate: res.proposalMonthlyRate,
      maxAllowedMonthlyRate: res.maxAllowedMonthlyRate,
      effectiveMonthlyRate: res.effectiveMonthlyRate,
      isCappedByEir: res.isCappedByEir,
      eirAnnualPercent: res.eirAnnualPercent,

      // ข้อมูลเปรียบเทียบประกันภัย PA
      hasInsurance,
      monthlyInstallmentWithoutInsurance,
      insuranceMonthlyDiff,
      totalWithoutInsurance,
      insuranceTotalDiff,
      insurancePlanName: res.insurancePlanName,
      planAInstallment: resPlanA.monthlyInstallment,
      planADiff: Math.max(0, resPlanA.monthlyInstallment - resNoInsurance.monthlyInstallment),
      planBInstallment: resPlanB.monthlyInstallment,
      planBDiff: Math.max(0, resPlanB.monthlyInstallment - resNoInsurance.monthlyInstallment),
    };
  });
}

export function formatBaht(amount: number, showDecimals = false): string {
  if (isNaN(amount)) return '฿0';
  if (showDecimals) {
    return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `฿${Math.round(amount).toLocaleString('th-TH')}`;
}

export function formatNumber(amount: number, decimals = 0): string {
  if (isNaN(amount)) return '0';
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * แปลงจำนวนงวดผ่อนชำระ (หรือจำนวนปีที่มีทศนิยม) ให้เป็นรูปแบบ "X ปี Y เดือน" หรือ "X ปี"
 * เช่น 42 งวด (หรือ 3.5 ปี) -> "3 ปี 6 เดือน"
 * เช่น 36 งวด (หรือ 3 ปี) -> "3 ปี"
 * เช่น 18 งวด (หรือ 1.5 ปี) -> "1 ปี 6 เดือน"
 * เช่น 30 งวด (หรือ 2.5 ปี) -> "2 ปี 6 เดือน"
 * เช่น 54 งวด (หรือ 4.5 ปี) -> "4 ปี 6 เดือน"
 */
export function formatTermYearMonth(term: number): string {
  if (!term || isNaN(term) || term <= 0) return '';
  // กรณีส่งมาเป็นจำนวนปีที่มีทศนิยม เช่น 3.5 ปี
  const totalMonths =
    term <= 10 && !Number.isInteger(term) ? Math.round(term * 12) : Math.round(term);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years > 0 && months > 0) {
    return `${years} ปี ${months} เดือน`;
  }
  if (years > 0) {
    return `${years} ปี`;
  }
  return `${months} เดือน`;
}

