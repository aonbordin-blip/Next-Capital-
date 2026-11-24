import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import mascotWaiCleanImg from '../assets/images/mascot_wai_clean.png';
import mascotPointCleanImg from '../assets/images/mascot_point_clean.png';
import mascotVsignCleanImg from '../assets/images/mascot_vsign_clean.png';
import { triggerHaptic } from '../utils/haptics';
import type { KpiFocusKey } from './KpiSummaryChartCard';

export type MascotGreetStage = 'wai' | 'wave' | 'none';

interface DimensionalMascotStageProps {
  activeKey: KpiFocusKey;
  accentHex: string;
  pulseKey?: number;
  greetTrigger?: number;
  onGreetStageChange?: (stage: MascotGreetStage) => void;
  onInteract: () => void;
}

export const DimensionalMascotStage: React.FC<DimensionalMascotStageProps> = ({
  activeKey,
  accentHex,
  onGreetStageChange,
  onInteract,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [imgError, setImgError] = React.useState(false);

  useEffect(() => {
    onGreetStageChange?.(activeKey === 'overview' ? 'wai' : 'none');
  }, [activeKey, onGreetStageChange]);

  const pose =
    activeKey === 'cases' || activeKey === 'finance'
      ? 'point'
      : activeKey === 'delivered' || activeKey === 'pa'
        ? 'vsign'
        : 'wai';

  const altText =
    pose === 'wai'
      ? 'มาสคอตภาพนิ่งท่ายกมือไหว้สวัสดี'
      : pose === 'point'
        ? 'มาสคอตชี้แนะนำข้อมูลมิติที่เลือก'
        : 'มาสคอตชูสองนิ้วฉลองผลงานมิติที่เลือก';

  const poseSrc =
    pose === 'point'
      ? mascotPointCleanImg
      : pose === 'vsign'
        ? mascotVsignCleanImg
        : mascotWaiCleanImg;

  const handleClick = () => {
    triggerHaptic('selection');
    onInteract();
  };

  return (
    <div className="pointer-events-auto absolute left-0.5 bottom-0.5 sm:left-1.5 sm:bottom-1 z-20 flex flex-col items-center select-none">
      <motion.button
        type="button"
        onClick={handleClick}
        title="แตะมาสคอตเพื่อสลับดูมิติผลงาน"
        aria-label="มาสคอตผู้ช่วยสรุปผลงาน 4 มิติ แตะเพื่อสลับมิติข้อมูล"
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                scale: 1.04,
                transition: { type: 'spring', stiffness: 360, damping: 26 },
              }
        }
        whileTap={
          shouldReduceMotion
            ? undefined
            : {
                scale: 0.96,
                transition: { type: 'spring', stiffness: 520, damping: 28 },
              }
        }
        className="group relative w-[86px] h-[138px] sm:w-[98px] sm:h-[160px] flex flex-col items-center justify-end cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-2xl overflow-visible"
      >
        {/* Steady Soft Ambient Rim Aura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 bottom-4 top-5 rounded-full blur-xl opacity-35 transition-colors duration-500"
          style={{
            background: `radial-gradient(circle at 50% 55%, ${accentHex}4d 0%, transparent 72%)`,
          }}
        />

        {/* Still Character Image Stage */}
        <div className="relative z-10 w-full h-[126px] sm:h-[146px] flex items-end justify-center pb-2.5 overflow-visible">
          {imgError ? (
            <div
              className="w-12 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-yellow-300/80 shadow-md flex flex-col items-center justify-center text-white"
              aria-hidden="true"
            >
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
          ) : (
            <img
              src={poseSrc}
              alt={altText}
              draggable={false}
              onError={() => setImgError(true)}
              className="h-[118px] sm:h-[138px] w-auto max-w-none object-contain object-bottom pointer-events-none select-none"
              style={{
                filter: 'drop-shadow(0 8px 12px rgba(15, 23, 42, 0.22))',
              }}
            />
          )}
        </div>

        {/* Clean Steady 3D Perspective Glass Pedestal & Contact Shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 inset-x-1 h-6 flex items-center justify-center z-0"
        >
          <div className="absolute bottom-0.5 w-12 sm:w-14 h-3 rounded-full blur-[4px] bg-slate-900/30 dark:bg-black/60" />
          <div
            className="relative w-[62px] sm:w-[72px] h-[22px] rounded-full border border-white/85 dark:border-sky-300/30 shadow-[0_4px_12px_-2px_rgba(14,165,233,0.22),inset_0_1px_3px_rgba(255,255,255,0.85)] dark:shadow-[0_4px_14px_-2px_rgba(14,165,233,0.32),inset_0_1px_4px_rgba(56,189,248,0.22)]"
            style={{
              transform: 'perspective(220px) rotateX(68deg)',
              background: `linear-gradient(135deg, rgba(255,255,255,0.78) 0%, ${accentHex}2a 52%, rgba(255,255,255,0.62) 100%)`,
            }}
          >
            <span className="pointer-events-none absolute inset-[4px] rounded-full bg-white/70 dark:bg-slate-900/65" />
          </div>
        </div>
      </motion.button>
    </div>
  );
};
