import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  Sparkles,
  Check,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import { CalculationResult, TermComparisonItem } from '../types';
import { formatBaht, cleanPlanNameForLine, formatTermYearMonth } from '../data/proposals';
import { NextCapitalLogo } from './NextCapitalLogo';
import { downloadElementAsImage, generateElementPngBlob } from '../utils/exportImage';
import { triggerHaptic } from '../utils/haptics';
import { useModalTransition } from '../hooks/useModalTransition';

type CardThemeKey = 'ocean' | 'midnight' | 'bright';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  comparisons: TermComparisonItem[];
  bikeName?: string;
  bikeModelCode?: string;
  customerDisplay: string;
  hasCustomerInfo: boolean;
  officerInfo: string;
  dealerName?: string;
  includeDeliveryFees?: boolean;
  onShareSuccess?: (msg: string) => void;
}

const CARD_THEMES: Record<
  CardThemeKey,
  {
    label: string;
    swatch: string;
    cardBg: string;
    exportBgColor: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    headerBadgeBg: string;
    headerBadgeBorder: string;
    headerBadgeText: string;
    heroBg: string;
    heroBorder: string;
    heroLabelColor: string;
    heroAmountColor: string;
    heroSubColor: string;
    heroChipBg: string;
    heroChipText: string;
    bentoBg: string;
    bentoBorder: string;
    bentoLabel: string;
    bentoValue: string;
    termBg: string;
    termBorder: string;
    termText: string;
    termActiveBg: string;
    termActiveBorder: string;
    termActiveText: string;
    footerBg: string;
    footerBorder: string;
    divider: string;
  }
> = {
  ocean: {
    label: 'Ocean Blue',
    swatch: 'from-[#0b1c3e] via-[#1C449C] to-[#0284c7]',
    cardBg: 'linear-gradient(155deg, #0b1c3e 0%, #1C449C 48%, #0284c7 100%)',
    exportBgColor: '#0b1c3e',
    textPrimary: '#ffffff',
    textSecondary: '#e0f2fe',
    textMuted: '#bae6fd',
    headerBadgeBg: 'rgba(255, 255, 255, 0.14)',
    headerBadgeBorder: '1px solid rgba(255, 255, 255, 0.28)',
    headerBadgeText: '#ffffff',
    heroBg: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
    heroBorder: '2px solid rgba(255, 255, 255, 0.9)',
    heroLabelColor: '#0369a1',
    heroAmountColor: '#0f172a',
    heroSubColor: '#475569',
    heroChipBg: '#e0f2fe',
    heroChipText: '#0c4a6e',
    bentoBg: 'rgba(255, 255, 255, 0.12)',
    bentoBorder: '1px solid rgba(255, 255, 255, 0.22)',
    bentoLabel: '#bae6fd',
    bentoValue: '#ffffff',
    termBg: 'rgba(255, 255, 255, 0.1)',
    termBorder: '1px solid rgba(255, 255, 255, 0.2)',
    termText: '#e0f2fe',
    termActiveBg: '#fbbf24',
    termActiveBorder: '1px solid #fde68a',
    termActiveText: '#0f172a',
    footerBg: 'rgba(6, 17, 42, 0.35)',
    footerBorder: '1px solid rgba(255, 255, 255, 0.16)',
    divider: 'rgba(255, 255, 255, 0.18)',
  },
  midnight: {
    label: 'Midnight Pro',
    swatch: 'from-[#090d16] via-[#111827] to-[#1e293b]',
    cardBg: 'linear-gradient(155deg, #090d16 0%, #111827 52%, #1e293b 100%)',
    exportBgColor: '#090d16',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    headerBadgeBg: 'rgba(56, 189, 248, 0.14)',
    headerBadgeBorder: '1px solid rgba(56, 189, 248, 0.35)',
    headerBadgeText: '#7dd3fc',
    heroBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(14, 165, 233, 0.18) 100%)',
    heroBorder: '1.5px solid rgba(56, 189, 248, 0.45)',
    heroLabelColor: '#7dd3fc',
    heroAmountColor: '#ffffff',
    heroSubColor: '#cbd5e1',
    heroChipBg: 'rgba(255, 255, 255, 0.12)',
    heroChipText: '#e0f2fe',
    bentoBg: 'rgba(255, 255, 255, 0.06)',
    bentoBorder: '1px solid rgba(255, 255, 255, 0.12)',
    bentoLabel: '#94a3b8',
    bentoValue: '#f8fafc',
    termBg: 'rgba(255, 255, 255, 0.06)',
    termBorder: '1px solid rgba(255, 255, 255, 0.12)',
    termText: '#cbd5e1',
    termActiveBg: 'linear-gradient(135deg, #38bdf8 0%, #2dd4bf 100%)',
    termActiveBorder: '1px solid #7dd3fc',
    termActiveText: '#0f172a',
    footerBg: 'rgba(255, 255, 255, 0.05)',
    footerBorder: '1px solid rgba(255, 255, 255, 0.1)',
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  bright: {
    label: 'Clean Glass',
    swatch: 'from-[#e0f2fe] via-[#ffffff] to-[#bae6fd]',
    cardBg: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 48%, #e0f2fe 100%)',
    exportBgColor: '#eff6ff',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    headerBadgeBg: '#dbeafe',
    headerBadgeBorder: '1px solid #93c5fd',
    headerBadgeText: '#1e40af',
    heroBg: 'linear-gradient(135deg, #1C449C 0%, #0284c7 100%)',
    heroBorder: '2px solid #0284c7',
    heroLabelColor: '#bae6fd',
    heroAmountColor: '#ffffff',
    heroSubColor: '#e0f2fe',
    heroChipBg: 'rgba(255, 255, 255, 0.18)',
    heroChipText: '#ffffff',
    bentoBg: '#ffffff',
    bentoBorder: '1px solid #cbd5e1',
    bentoLabel: '#64748b',
    bentoValue: '#0f172a',
    termBg: '#ffffff',
    termBorder: '1px solid #cbd5e1',
    termText: '#334155',
    termActiveBg: '#1C449C',
    termActiveBorder: '1px solid #1e3a8a',
    termActiveText: '#ffffff',
    footerBg: '#f8fafc',
    footerBorder: '1px solid #e2e8f0',
    divider: '#cbd5e1',
  },
};

const CARD_WIDTH = 540;

export const InstallmentShareCardModal: React.FC<Props> = ({
  isOpen,
  onClose,
  result,
  comparisons,
  bikeName,
  bikeModelCode,
  customerDisplay,
  hasCustomerInfo,
  officerInfo,
  dealerName,
  includeDeliveryFees,
  onShareSuccess,
}) => {
  const [themeKey, setThemeKey] = useState<CardThemeKey>(() => {
    try {
      const saved = localStorage.getItem('ncap_share_card_theme');
      if (saved === 'ocean' || saved === 'midnight' || saved === 'bright') return saved;
    } catch {
      // ignore
    }
    return 'ocean';
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewHeight, setPreviewHeight] = useState<number>(720);

  useEffect(() => {
    if (!isOpen) return;
    const measureAndScale = () => {
      if (previewCardRef.current) {
        const h = previewCardRef.current.scrollHeight;
        if (h > 0) setPreviewHeight(h);
      }
      if (previewContainerRef.current) {
        const availableW = previewContainerRef.current.clientWidth - 20;
        if (availableW > 0 && availableW < CARD_WIDTH) {
          setPreviewScale(Math.max(0.42, availableW / CARD_WIDTH));
        } else {
          setPreviewScale(1);
        }
      }
    };
    measureAndScale();
    const t1 = setTimeout(measureAndScale, 60);
    const t2 = setTimeout(measureAndScale, 250);
    window.addEventListener('resize', measureAndScale);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measureAndScale);
    };
  }, [isOpen, themeKey, result, comparisons, bikeName, bikeModelCode, customerDisplay]);

  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } = useModalTransition(
    isOpen,
    onClose
  );

  if (!shouldRender) return null;

  const theme = CARD_THEMES[themeKey];

  const handleThemeSelect = (key: CardThemeKey) => {
    triggerHaptic('light');
    setThemeKey(key);
    try {
      localStorage.setItem('ncap_share_card_theme', key);
    } catch {
      // ignore
    }
  };

  const cleanRate = result.rateDisplayText
    .replace(/\s*\[\s*กำหนดเอง\s*\]/gi, '')
    .replace(/\s*\(\s*กำหนดเอง\s*\)/gi, '')
    .trim();

  const cleanInsurance =
    result.insuranceTotalWithVat > 0
      ? cleanPlanNameForLine(result.insurancePlanName)
      : 'ไม่รับความคุ้มครอง PA';

  const currentComp = comparisons.find((c) => c.term === result.term);

  const cleanModelCode = (bikeModelCode || '').replace(/\s+/g, ' ').trim();
  const displayModelTitle = (
    bikeName || (cleanModelCode ? `รหัสรุ่น ${cleanModelCode}` : 'รถจักรยานยนต์')
  )
    .replace(/\s+/g, ' ')
    .trim();
  const cleanCustomerDisplay = (customerDisplay || '').replace(/\s+/g, ' ').trim();
  const cleanDealerName = (dealerName || '').replace(/\s+/g, ' ').trim();

  const todayThai = (() => {
    const d = new Date();
    const months = [
      'ม.ค.',
      'ก.พ.',
      'มี.ค.',
      'เม.ย.',
      'พ.ค.',
      'มิ.ย.',
      'ก.ค.',
      'ส.ค.',
      'ก.ย.',
      'ต.ค.',
      'พ.ย.',
      'ธ.ค.',
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  })();

  const buildFileName = () => {
    const cleanModel = (bikeName || bikeModelCode || 'รถจักรยานยนต์').replace(/\s+/g, '_');
    return `สรุปค่างวด_${cleanModel}_${result.term}งวด_NextCapital.png`;
  };

  const handleDownloadImage = async () => {
    if (!exportRef.current || isGenerating) return;
    setIsGenerating(true);
    setStatusMessage(null);
    triggerHaptic('medium');
    try {
      await downloadElementAsImage(
        exportRef.current,
        buildFileName(),
        CARD_WIDTH,
        theme.exportBgColor
      );
      triggerHaptic('success');
      setStatusMessage('บันทึกรูปภาพการ์ดสรุปค่างวดลงอุปกรณ์เรียบร้อยแล้ว!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Failed to generate card image:', err);
      setStatusMessage('ไม่สามารถสร้างรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareImage = async () => {
    if (!exportRef.current || isSharing) return;
    setIsSharing(true);
    setStatusMessage(null);
    triggerHaptic('medium');

    try {
      const fileName = buildFileName();
      const blob = await generateElementPngBlob(
        exportRef.current,
        CARD_WIDTH,
        theme.exportBgColor
      );
      const file = new File([blob], fileName, { type: 'image/png' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === 'function'
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `สรุปค่างวด ${displayModelTitle}`,
            text: `ค่างวด ${formatBaht(result.monthlyInstallment)} บ./ด. (${result.term} งวด) • Next Capital`,
          });
          triggerHaptic('success');
          onShareSuccess?.('แชร์รูปภาพสรุปค่างวดเรียบร้อยแล้ว');
          setStatusMessage('ส่งรูปภาพผ่านระบบแชร์เรียบร้อยแล้ว!');
          setTimeout(() => setStatusMessage(null), 3000);
          return;
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
          // Fall through to download
        }
      }

      // Fallback when browser doesn't support file sharing via Web Share API
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      triggerHaptic('success');
      setStatusMessage('บันทึกรูปภาพแล้ว (อุปกรณ์ไม่รองรับแชร์ไฟล์โดยตรง สามารถส่งรูปจากคลังภาพเข้า LINE ได้ทันที)');
      setTimeout(() => setStatusMessage(null), 4500);
    } catch (err) {
      console.error('Failed to share card image:', err);
      setStatusMessage('เกิดข้อผิดพลาดในการสร้างรูปภาพ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSharing(false);
    }
  };

  const renderCardCanvas = () => (
    <div
      style={{
        width: `${CARD_WIDTH}px`,
        background: theme.cardBg,
        padding: '26px',
        boxSizing: 'border-box',
        fontFamily: "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif",
        color: theme.textPrimary,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px',
      }}
    >
      {/* Decorative Ambient Glow Circles */}
      <div
        style={{
          position: 'absolute',
          top: '-70px',
          right: '-60px',
          width: '220px',
          height: '220px',
          borderRadius: '9999px',
          background:
            themeKey === 'bright'
              ? 'radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(56,189,248,0) 70%)'
              : 'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(56,189,248,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-60px',
          width: '240px',
          height: '240px',
          borderRadius: '9999px',
          background:
            themeKey === 'bright'
              ? 'radial-gradient(circle, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0) 70%)'
              : 'radial-gradient(circle, rgba(34,211,238,0.2) 0%, rgba(34,211,238,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Brand Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          position: 'relative',
          zIndex: 1,
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 0%', minWidth: 0 }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '13px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.16)',
              border: themeKey === 'bright' ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.6)',
              flexShrink: 0,
            }}
          >
            <NextCapitalLogo size={32} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '15px',
                fontWeight: '800',
                letterSpacing: '0.02em',
                color: theme.textPrimary,
                lineHeight: '1.25',
              }}
            >
              NEXT CAPITAL
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '400',
                color: theme.textMuted,
                marginTop: '1px',
                lineHeight: '1.3',
              }}
            >
              บมจ. เน็กซ์ แคปปิตอล • สินเชื่อเช่าซื้อ
            </div>
          </div>
        </div>

        <div
          style={{
            background: theme.headerBadgeBg,
            border: theme.headerBadgeBorder,
            borderRadius: '12px',
            padding: '6px 11px',
            textAlign: 'right',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: '800',
              color: theme.headerBadgeText,
              lineHeight: '1.25',
            }}
          >
            ใบเสนอค่างวด
          </div>
          <div
            style={{
              fontSize: '9.5px',
              fontWeight: '600',
              color: theme.textMuted,
              marginTop: '1px',
              lineHeight: '1.25',
            }}
          >
            {result.proposalCode}
          </div>
        </div>
      </div>

      {/* Vehicle & Customer Identity */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          marginBottom: '16px',
          paddingBottom: '14px',
          borderBottom: `1px dashed ${theme.divider}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '19px',
                lineHeight: '1.3',
                flexShrink: 0,
              }}
            >
              🏍️
            </span>
            <div
              style={{
                flex: '1 1 0%',
                minWidth: 0,
                fontSize: '19px',
                fontWeight: '800',
                color: theme.textPrimary,
                lineHeight: '1.3',
                wordBreak: 'break-word',
              }}
            >
              {displayModelTitle}
            </div>
          </div>
          {cleanModelCode && (
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: '700',
                background: theme.headerBadgeBg,
                border: theme.headerBadgeBorder,
                color: theme.headerBadgeText,
                padding: '3px 10px',
                borderRadius: '9999px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                lineHeight: '1.35',
              }}
            >
              {cleanModelCode}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasCustomerInfo ? 'minmax(0, 1fr) minmax(0, 1.25fr)' : 'minmax(0, 1fr)',
            alignItems: 'center',
            gap: '10px',
            marginTop: '8px',
            fontSize: '11.5px',
            lineHeight: '1.4',
            color: theme.textSecondary,
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span style={{ flexShrink: 0 }}>📋</span>
            <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
              ข้อเสนอ: <strong style={{ fontWeight: '700', color: theme.textPrimary }}>{result.proposalName}</strong>
            </span>
          </div>
          {hasCustomerInfo && (
            <div
              style={{
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '5px',
                textAlign: 'right',
              }}
            >
              <span style={{ flexShrink: 0 }}>👤</span>
              <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                คุณ <strong style={{ fontWeight: '700', color: theme.textPrimary }}>{cleanCustomerDisplay}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* HERO CENTERPIECE: Monthly Installment Showcase */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: theme.heroBg,
          border: theme.heroBorder,
          borderRadius: '20px',
          padding: '18px 20px',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.16)',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: '700',
            color: theme.heroLabelColor,
            letterSpacing: '0.01em',
          }}
        >
          ค่างวดผ่อนชำระต่อเดือน (รวม VAT 7% แล้ว)
        </div>

        <div
          style={{
            fontSize: '42px',
            fontWeight: '800',
            color: theme.heroAmountColor,
            letterSpacing: '-0.02em',
            lineHeight: '1.15',
            margin: '6px 0 8px',
          }}
        >
          {formatBaht(result.monthlyInstallment)}
          <span
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: theme.heroSubColor,
              marginLeft: '6px',
              letterSpacing: '0',
            }}
          >
            บาท / เดือน
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              background: theme.heroChipBg,
              color: theme.heroChipText,
              fontSize: '11.5px',
              fontWeight: '800',
              padding: '4px 12px',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
            }}
          >
            ⏱️ ผ่อน {result.term} งวด ({formatTermYearMonth(result.term)})
          </span>
          <span
            style={{
              background: theme.heroChipBg,
              color: theme.heroChipText,
              fontSize: '11.5px',
              fontWeight: '700',
              padding: '4px 12px',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
            }}
          >
            📈 ดอกเบี้ย {cleanRate}
          </span>
        </div>

        {currentComp && currentComp.hasInsurance && currentComp.insuranceMonthlyDiff > 0 && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '10.5px',
              color: theme.heroSubColor,
              fontWeight: '600',
            }}
          >
            🛡️ รวมความคุ้มครอง {cleanInsurance} แล้ว (+{formatBaht(currentComp.insuranceMonthlyDiff)} บ./ด.)
          </div>
        )}
      </div>

      {/* 2x2 Bento Grid Key Figures */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            background: theme.bentoBg,
            border: theme.bentoBorder,
            borderRadius: '14px',
            padding: '11px 14px',
          }}
        >
          <div style={{ fontSize: '10.5px', color: theme.bentoLabel, fontWeight: '600' }}>
            🏷️ ราคารถเงินสด
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: theme.bentoValue, marginTop: '2px' }}>
            {formatBaht(result.baseVehiclePrice)} บาท
          </div>
        </div>

        <div
          style={{
            background: theme.bentoBg,
            border: theme.bentoBorder,
            borderRadius: '14px',
            padding: '11px 14px',
          }}
        >
          <div style={{ fontSize: '10.5px', color: theme.bentoLabel, fontWeight: '600' }}>
            💵 เงินดาวน์ ({result.downPercent.toFixed(1)}%)
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: theme.bentoValue, marginTop: '2px' }}>
            {formatBaht(result.downAmount)} บาท
          </div>
        </div>

        <div
          style={{
            background: theme.bentoBg,
            border: theme.bentoBorder,
            borderRadius: '14px',
            padding: '11px 14px',
          }}
        >
          <div style={{ fontSize: '10.5px', color: theme.bentoLabel, fontWeight: '600' }}>
            💳 ยอดจัดสินเชื่อรวม
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: theme.bentoValue, marginTop: '2px' }}>
            {formatBaht(result.financeAmount, true)} บาท
          </div>
        </div>

        <div
          style={{
            background: theme.bentoBg,
            border: theme.bentoBorder,
            borderRadius: '14px',
            padding: '11px 14px',
          }}
        >
          <div style={{ fontSize: '10.5px', color: theme.bentoLabel, fontWeight: '600' }}>
            🛡️ ประกันภัยคุ้มครอง
          </div>
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: '700',
              color: theme.bentoValue,
              marginTop: '4px',
              lineHeight: '1.3',
            }}
          >
            {cleanInsurance}
          </div>
        </div>
      </div>

      {/* Optional Drive Away Cost Banner */}
      {includeDeliveryFees && result.totalDriveAwayCost && result.totalDriveAwayCost > 0 && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'rgba(251, 191, 36, 0.16)',
            border: '1px solid rgba(251, 191, 36, 0.45)',
            borderRadius: '12px',
            padding: '9px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            fontSize: '12px',
          }}
        >
          <span style={{ fontWeight: '700', flex: '1 1 0%', minWidth: 0, color: themeKey === 'bright' ? '#92400e' : '#fde68a' }}>
            🏁 เงินพร้อมออกรถ (รวมค่าใช้จ่ายวันรับรถ)
          </span>
          <span style={{ fontWeight: '800', fontSize: '14px', flexShrink: 0, whiteSpace: 'nowrap', marginLeft: '8px', color: themeKey === 'bright' ? '#78350f' : '#fef3c7' }}>
            {formatBaht(result.totalDriveAwayCost)} บาท
          </span>
        </div>
      )}

      {/* Alternative Terms Mini Strip */}
      {comparisons.length > 1 && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: '700',
              color: theme.textMuted,
              marginBottom: '6px',
            }}
          >
            📊 ตัวเลือกระยะเวลาผ่อนอื่น (รวม VAT 7% แล้ว)
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(comparisons.length, 4)}, 1fr)`,
              gap: '6px',
            }}
          >
            {comparisons.slice(0, 8).map((c) => {
              const isSelected = c.term === result.term;
              return (
                <div
                  key={c.term}
                  style={{
                    background: isSelected ? theme.termActiveBg : theme.termBg,
                    border: isSelected ? theme.termActiveBorder : theme.termBorder,
                    color: isSelected ? theme.termActiveText : theme.termText,
                    borderRadius: '10px',
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '9.5px', fontWeight: isSelected ? '800' : '600', opacity: 0.9 }}>
                    {c.term} งวด {isSelected ? '★' : ''}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: '800', marginTop: '1px' }}>
                    {formatBaht(c.monthlyInstallment)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Officer Footer Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: theme.footerBg,
          border: theme.footerBorder,
          borderRadius: '14px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          {cleanDealerName && (
            <div style={{ fontSize: '10.5px', fontWeight: '700', color: theme.textSecondary, lineHeight: '1.35', marginBottom: '2px' }}>
              🏪 ร้านผู้จำหน่าย: {cleanDealerName}
            </div>
          )}
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: theme.textPrimary, lineHeight: '1.35' }}>
            👨‍💼 ดูแลโดย: {officerInfo}
          </div>
          <div style={{ fontSize: '9.5px', color: theme.textMuted, marginTop: '2px', lineHeight: '1.35' }}>
            *เงื่อนไขเบื้องต้น อาจปรับเปลี่ยนตามผลอนุมัติสินเชื่อจริง
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '9.5px', color: theme.textMuted, fontWeight: '600' }}>
            วันที่เสนอราคา
          </div>
          <div style={{ fontSize: '10.5px', color: theme.textSecondary, fontWeight: '700' }}>
            {todayThai}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative ${sheetAnimClass}`}
      >
        {/* Top Accent Strip */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-500" />

        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 flex items-center justify-between gap-2 bg-gradient-to-b from-sky-50/80 to-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-600 via-blue-700 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 shrink-0">
              <ImageIcon className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 truncate flex items-center gap-1.5">
                <span>การ์ดสรุปค่างวด (รูปภาพ HD)</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                เลือกสไตล์การ์ด แล้วกดแชร์เข้า LINE หรือบันทึกรูปภาพได้ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theme Selector Bar */}
        <div className="px-3.5 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200/70 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Palette className="w-3.5 h-3.5 text-sky-600" />
            <span>สไตล์การ์ด:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(CARD_THEMES) as CardThemeKey[]).map((key) => {
              const item = CARD_THEMES[key];
              const active = themeKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleThemeSelect(key)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    active
                      ? 'bg-sky-50 text-sky-900 border-sky-400 shadow-2xs ring-1 ring-sky-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-full bg-gradient-to-br ${item.swatch} border border-slate-300 shrink-0`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Toast Inside Modal */}
        {statusMessage && (
          <div className="mx-4 mt-2.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shrink-0 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Responsive Auto-Scaled Card Preview */}
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-y-auto bg-slate-100/80 p-3 sm:p-5 flex justify-center items-start"
        >
          <div
            style={{
              width: `${Math.round(CARD_WIDTH * previewScale)}px`,
              height: `${Math.round(previewHeight * previewScale)}px`,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              ref={previewCardRef}
              style={{
                width: `${CARD_WIDTH}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
                boxShadow: '0 14px 35px -5px rgba(15, 23, 42, 0.22)',
                borderRadius: '24px',
              }}
            >
              {renderCardCanvas()}
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="p-3 sm:px-5 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isGenerating || isSharing}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-300/80 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                <span>กำลังสร้างภาพ...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-slate-700 shrink-0" />
                <span>บันทึกรูป (PNG)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShareImage}
            disabled={isGenerating || isSharing}
            className="flex-[1.5] py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-[#06c755] to-teal-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังเตรียมรูปภาพ...</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-white shrink-0" />
                <span>แชร์รูปภาพ (LINE / อื่นๆ)</span>
              </>
            )}
          </button>
        </div>

        {/* Hidden Fixed-Width 1:1 Off-Screen Export Template */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: `${CARD_WIDTH}px`,
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          <div ref={exportRef} style={{ width: `${CARD_WIDTH}px` }}>
            {renderCardCanvas()}
          </div>
        </div>
      </div>
    </div>
  );
};
