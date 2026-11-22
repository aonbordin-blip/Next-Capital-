import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import mascotCompanionImg from '../assets/images/mascot_companion.png';
import mascotPointCleanImg from '../assets/images/mascot_point_clean.png';
import mascotVsignCleanImg from '../assets/images/mascot_vsign_clean.png';
import { triggerHaptic } from '../utils/haptics';
import type { KpiFocusKey } from './KpiSummaryChartCard';

interface DimensionalMascotStageProps {
  activeKey: KpiFocusKey;
  accentHex: string;
  pulseKey: number;
  onInteract: () => void;
}

const SPARKLE_NODES = [
  { id: 'top-right', xClass: 'right-0.5 top-2', size: 11, delay: 0, duration: 2.7 },
  { id: 'top-left', xClass: 'left-1 top-6', size: 9, delay: 0.85, duration: 3.2 },
  { id: 'mid-right', xClass: 'right-0 top-[46%]', size: 8, delay: 1.5, duration: 2.4 },
] as const;

type MascotPose = 'idle' | 'point' | 'vsign';

function resolvePose(activeKey: KpiFocusKey, isExcited: boolean): MascotPose {
  if (activeKey === 'cases' || activeKey === 'finance') return 'point';
  if (activeKey === 'delivered' || activeKey === 'pa') return 'vsign';
  return isExcited ? 'point' : 'idle';
}

export const DimensionalMascotStage: React.FC<DimensionalMascotStageProps> = ({
  activeKey,
  accentHex,
  pulseKey,
  onInteract,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [isExcited, setIsExcited] = useState(false);
  const [imgErrorCount, setImgErrorCount] = useState(0);

  useEffect(() => {
    if (pulseKey <= 0 || shouldReduceMotion) return;
    setIsExcited(true);
    const timer = window.setTimeout(() => setIsExcited(false), 760);
    return () => window.clearTimeout(timer);
  }, [pulseKey, shouldReduceMotion]);

  const pose = resolvePose(activeKey, isExcited);
  const isFocused = pose !== 'idle';
  const currentSprite =
    pose === 'point'
      ? mascotPointCleanImg
      : pose === 'vsign'
        ? mascotVsignCleanImg
        : mascotCompanionImg;

  const altText =
    pose === 'point'
      ? 'มาสคอตชี้แนะนำข้อมูลมิติที่เลือก'
      : pose === 'vsign'
        ? 'มาสคอตชูสองนิ้วฉลองผลงานมิติที่เลือก'
        : 'มาสคอตผู้ช่วยสรุปผลงาน 4 มิติ';

  const handleClick = () => {
    triggerHaptic('selection');
    onInteract();
  };

  return (
    <div
      className="pointer-events-auto absolute left-0.5 bottom-0.5 sm:left-1.5 sm:bottom-1 z-20 flex flex-col items-center select-none"
      style={{ perspective: '540px' }}
    >
      <motion.button
        type="button"
        onClick={handleClick}
        title="แตะมาสคอตเพื่อสลับดูมิติผลงาน"
        aria-label="มาสคอตผู้ช่วยสรุปผลงาน 4 มิติ แตะเพื่อสลับมิติข้อมูล"
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                scale: 1.06,
                y: -2,
                rotateY: pose === 'point' ? 8 : -5,
                transition: { type: 'spring', stiffness: 360, damping: 22 },
              }
        }
        whileTap={
          shouldReduceMotion
            ? undefined
            : {
                scale: 0.93,
                y: 2,
                transition: { type: 'spring', stiffness: 520, damping: 24 },
              }
        }
        className="group relative w-[76px] h-[138px] sm:w-[90px] sm:h-[160px] flex flex-col items-center justify-end cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-2xl overflow-visible"
      >
        {/* Dynamic KPI-Synced Volumetric Spotlight Glow */}
        <motion.div
          aria-hidden="true"
          animate={
            shouldReduceMotion
              ? { opacity: 0.55 }
              : {
                  opacity: isFocused ? [0.64, 0.92, 0.64] : [0.44, 0.68, 0.44],
                  scale: isExcited ? [1, 1.2, 1] : [0.96, 1.06, 0.96],
                }
          }
          transition={{
            duration: 3.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="pointer-events-none absolute inset-x-0.5 bottom-4 top-4 rounded-full blur-xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${accentHex}66 0%, #facc1528 45%, transparent 76%)`,
          }}
        />

        {/* Twinkling 4-Point Star Glints Matching Varsity Gold & Accent */}
        {!shouldReduceMotion &&
          SPARKLE_NODES.map((node, index) => (
            <motion.svg
              key={node.id}
              aria-hidden="true"
              viewBox="0 0 24 24"
              width={node.size}
              height={node.size}
              className={`pointer-events-none absolute ${node.xClass} z-20`}
              initial={{ opacity: 0.2, scale: 0.75, rotate: 0 }}
              animate={{
                opacity: isFocused ? [0.3, 1, 0.3] : [0.18, 0.82, 0.18],
                scale: isFocused ? [0.78, 1.24, 0.78] : [0.72, 1.06, 0.72],
                rotate: [0, 24, 0],
              }}
              transition={{
                duration: node.duration,
                delay: node.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <path
                d="M12 1.5L14.3 9.7L22.5 12L14.3 14.3L12 22.5L9.7 14.3L1.5 12L9.7 9.7L12 1.5Z"
                fill={index === 1 ? '#facc15' : isFocused ? accentHex : '#38bdf8'}
              />
            </motion.svg>
          ))}

        {/* Floating 3D Character Layer with Pose Switching */}
        <motion.div
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  y: isExcited ? [0, -9, 0] : [0, -5, 0],
                  rotate: isExcited ? [0, -2.5, 2, 0] : [-0.8, 1.1, -0.8],
                }
          }
          transition={
            isExcited
              ? { duration: 0.6, ease: 'easeOut' }
              : {
                  y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
                  rotate: { duration: 4.4, repeat: Infinity, ease: 'easeInOut' },
                }
          }
          className="relative z-10 w-full h-[124px] sm:h-[144px] flex items-end justify-center pb-2.5 overflow-visible"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {imgErrorCount >= 3 ? (
            <div
              className="w-12 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-yellow-300/80 shadow-md flex flex-col items-center justify-center text-white"
              aria-hidden="true"
            >
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={pose}
                src={currentSprite}
                alt={altText}
                draggable={false}
                onError={() => setImgErrorCount((c) => c + 1)}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0.7 }
                    : {
                        opacity: 0,
                        scale: 0.86,
                        y: 6,
                        rotateY: pose === 'point' ? -22 : pose === 'vsign' ? 22 : 0,
                      }
                }
                animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        scale: 0.88,
                        y: -4,
                        rotateY: pose === 'point' ? 18 : -18,
                      }
                }
                transition={{
                  type: 'spring',
                  stiffness: 350,
                  damping: 24,
                  mass: 0.75,
                }}
                className="h-[114px] sm:h-[134px] w-auto max-w-none object-contain object-bottom will-change-transform"
                style={{
                  filter: `drop-shadow(0 8px 12px rgba(15, 23, 42, 0.24)) drop-shadow(0 0 8px ${accentHex}44)`,
                }}
              />
            </AnimatePresence>
          )}
        </motion.div>

        {/* 3D Perspective Glass Pedestal & Inverse-Breathing Contact Shadow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 inset-x-1 h-6 flex items-center justify-center z-0"
        >
          {/* Ambient Ground Shadow (shrinks slightly as character floats up) */}
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    scale: [1, 0.85, 1],
                    opacity: [0.44, 0.22, 0.44],
                  }
            }
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute bottom-0.5 w-12 sm:w-14 h-3 rounded-full blur-[4px] bg-slate-900/35 dark:bg-black/65"
          />

          {/* Tilted Frosted Hologram Ring Pedestal */}
          <div
            className="relative w-[60px] sm:w-[70px] h-[22px] rounded-full border border-white/90 dark:border-sky-300/35 shadow-[0_4px_14px_-2px_rgba(14,165,233,0.32),inset_0_1px_4px_rgba(255,255,255,0.9)] dark:shadow-[0_4px_16px_-2px_rgba(14,165,233,0.42),inset_0_1px_5px_rgba(56,189,248,0.28)]"
            style={{
              transform: 'perspective(220px) rotateX(68deg)',
              background: `linear-gradient(135deg, rgba(255,255,255,0.82) 0%, ${accentHex}38 52%, rgba(255,255,255,0.68) 100%)`,
            }}
          >
            {/* Rotating Inner Conic Energy Rim */}
            {!shouldReduceMotion && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 8.5, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute inset-[2px] rounded-full opacity-80"
                style={{
                  background: `conic-gradient(from 0deg, ${accentHex}88, transparent 42%, #facc1566 74%, transparent)`,
                }}
              />
            )}
            <span className="pointer-events-none absolute inset-[4px] rounded-full bg-white/75 dark:bg-slate-900/70" />
          </div>
        </div>
      </motion.button>
    </div>
  );
};
