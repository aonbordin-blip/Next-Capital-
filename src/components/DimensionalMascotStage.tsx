import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import mascotCompanionImg from '../assets/images/mascot_companion.png';
import mascotPointCleanImg from '../assets/images/mascot_point_clean.png';
import mascotVsignCleanImg from '../assets/images/mascot_vsign_clean.png';
import mascotGreetSheet90 from '../assets/images/greet/mascot_greet_sheet_90.png';
import { triggerHaptic } from '../utils/haptics';
import type { KpiFocusKey } from './KpiSummaryChartCard';

export type MascotGreetStage = 'wai' | 'wave' | 'none';

interface DimensionalMascotStageProps {
  activeKey: KpiFocusKey;
  accentHex: string;
  pulseKey: number;
  greetTrigger: number;
  onGreetStageChange?: (stage: MascotGreetStage) => void;
  onInteract: () => void;
}

const SHEET_COLS = 10;
const SHEET_FRAME_W = 180;
const SHEET_FRAME_H = 240;
const TOTAL_FRAMES = 90;
const FRAME_DURATION_MS = 1000 / 30; // Exact 30.0 fps (2 vsyncs @ 60Hz) -> 3.00s seamless loop

function getStageForFrame(frameIndex: number): MascotGreetStage {
  if (frameIndex >= 2 && frameIndex <= 42) return 'wai';
  if (frameIndex >= 44 && frameIndex <= 89) return 'wave';
  return 'none';
}

export const DimensionalMascotStage: React.FC<DimensionalMascotStageProps> = ({
  activeKey,
  accentHex,
  pulseKey,
  greetTrigger,
  onGreetStageChange,
  onInteract,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [isExcited, setIsExcited] = useState(false);
  const [sheetSource, setSheetSource] = useState<CanvasImageSource | null>(null);
  const [imgError, setImgError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(-1);
  const lastStageRef = useRef<MascotGreetStage>('none');

  const isLoopActive = activeKey === 'overview' && !shouldReduceMotion;

  // Preload & GPU-decode the 90-frame sprite sheet once (ImageBitmap prevents Chrome draw stalls)
  useEffect(() => {
    let cancelled = false;
    let decodedBitmap: ImageBitmap | null = null;
    const img = new Image();
    img.decoding = 'async';
    img.src = mascotGreetSheet90;

    const finalizeFallback = () => {
      if (!cancelled) {
        setSheetSource(img);
      }
    };

    img.onload = () => {
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(img)
          .then((bitmap) => {
            if (cancelled) {
              bitmap.close();
              return;
            }
            decodedBitmap = bitmap;
            setSheetSource(bitmap);
          })
          .catch(() => {
            if (typeof img.decode === 'function') {
              img.decode().then(finalizeFallback).catch(finalizeFallback);
            } else {
              finalizeFallback();
            }
          });
      } else if (typeof img.decode === 'function') {
        img.decode().then(finalizeFallback).catch(finalizeFallback);
      } else {
        finalizeFallback();
      }
    };
    img.onerror = () => {
      if (!cancelled) setImgError(true);
    };

    return () => {
      cancelled = true;
      if (decodedBitmap) {
        decodedBitmap.close();
      }
    };
  }, []);

  // Restart cycle cleanly when returning to overview or clicking replay
  useEffect(() => {
    startTimeRef.current = 0;
    lastFrameRef.current = -1;
    if (!isLoopActive) {
      if (lastStageRef.current !== 'none') {
        lastStageRef.current = 'none';
        onGreetStageChange?.('none');
      }
    }
  }, [isLoopActive, greetTrigger, onGreetStageChange]);

  // Synchronous 90-frame GPU canvas blitting locked to 30fps cadence (zero stutter, zero white flash)
  useEffect(() => {
    if (!isLoopActive || !sheetSource) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(SHEET_FRAME_W * dpr);
    const targetH = Math.round(SHEET_FRAME_H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let rafId = 0;

    const drawFrame = (frameIndex: number) => {
      const col = frameIndex % SHEET_COLS;
      const row = Math.floor(frameIndex / SHEET_COLS);
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(
        sheetSource,
        col * SHEET_FRAME_W,
        row * SHEET_FRAME_H,
        SHEET_FRAME_W,
        SHEET_FRAME_H,
        0,
        0,
        targetW,
        targetH
      );
    };

    const tick = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;
      const elapsed = Math.max(0, now - startTimeRef.current);
      // Offset +8ms centers transition thresholds cleanly between 60Hz/120Hz vsync ticks
      const frameIndex = Math.floor((elapsed + 8) / FRAME_DURATION_MS) % TOTAL_FRAMES;

      if (frameIndex !== lastFrameRef.current) {
        lastFrameRef.current = frameIndex;
        drawFrame(frameIndex);

        const nextStage = getStageForFrame(frameIndex);
        if (nextStage !== lastStageRef.current) {
          lastStageRef.current = nextStage;
          onGreetStageChange?.(nextStage);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    drawFrame(0);
    lastFrameRef.current = 0;
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isLoopActive, sheetSource, onGreetStageChange]);

  // Gentle settle bounce when KPI filter changes
  useEffect(() => {
    if (pulseKey <= 0 || shouldReduceMotion) return;
    setIsExcited(true);
    const timer = window.setTimeout(() => setIsExcited(false), 520);
    return () => window.clearTimeout(timer);
  }, [pulseKey, shouldReduceMotion]);

  const kpiPose =
    activeKey === 'cases' || activeKey === 'finance'
      ? 'point'
      : activeKey === 'delivered' || activeKey === 'pa'
        ? 'vsign'
        : 'idle';

  const altText =
    activeKey === 'overview'
      ? 'มาสคอตเคลื่อนไหวยกมือไหว้สวัสดีและโบกมือทักทาย'
      : kpiPose === 'point'
        ? 'มาสคอตชี้แนะนำข้อมูลมิติที่เลือก'
        : 'มาสคอตชูสองนิ้วฉลองผลงานมิติที่เลือก';

  const kpiSrc =
    shouldReduceMotion
      ? mascotCompanionImg
      : kpiPose === 'point'
        ? mascotPointCleanImg
        : kpiPose === 'vsign'
          ? mascotVsignCleanImg
          : mascotCompanionImg;

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
                scale: 1.05,
                y: -2,
                transition: { type: 'spring', stiffness: 360, damping: 24 },
              }
        }
        whileTap={
          shouldReduceMotion
            ? undefined
            : {
                scale: 0.94,
                y: 1,
                transition: { type: 'spring', stiffness: 520, damping: 26 },
              }
        }
        className="group relative w-[86px] h-[138px] sm:w-[98px] sm:h-[160px] flex flex-col items-center justify-end cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-2xl overflow-visible"
      >
        {/* Steady Soft Ambient Rim Aura (Zero Flashing / Zero Blinking) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 bottom-4 top-5 rounded-full blur-xl opacity-35 transition-colors duration-500"
          style={{
            background: `radial-gradient(circle at 50% 55%, ${accentHex}4d 0%, transparent 72%)`,
          }}
        />

        {/* Character Stage */}
        <motion.div
          animate={
            shouldReduceMotion || isLoopActive
              ? { y: 0, rotate: 0 }
              : {
                  y: isExcited ? [0, -6, 0] : [0, -3, 0],
                  rotate: isExcited ? [0, -1.5, 1.5, 0] : [-0.4, 0.5, -0.4],
                }
          }
          transition={
            isLoopActive
              ? { duration: 0.2 }
              : isExcited
                ? { duration: 0.45, ease: 'easeOut' }
                : {
                    y: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' },
                    rotate: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
                  }
          }
          className="relative z-10 w-full h-[126px] sm:h-[146px] flex items-end justify-center pb-2.5 overflow-visible"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {imgError ? (
            <div
              className="w-12 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-yellow-300/80 shadow-md flex flex-col items-center justify-center text-white"
              aria-hidden="true"
            >
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
          ) : isLoopActive ? (
            <div className="relative h-[124px] sm:h-[144px] aspect-[180/240] shrink-0 overflow-visible flex items-end justify-center">
              {!sheetSource ? (
                <img
                  src={mascotCompanionImg}
                  alt={altText}
                  draggable={false}
                  onError={() => setImgError(true)}
                  className="h-[114px] sm:h-[134px] w-auto object-contain object-bottom pointer-events-none select-none"
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label={altText}
                  className="w-full h-full block pointer-events-none select-none will-change-contents"
                />
              )}
            </div>
          ) : (
            <motion.img
              key={shouldReduceMotion ? 'reduced' : kpiPose}
              src={kpiSrc}
              alt={altText}
              draggable={false}
              onError={() => setImgError(true)}
              initial={
                shouldReduceMotion
                  ? { opacity: 0.9 }
                  : { scale: 0.92, y: 4 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 26,
              }}
              className="h-[114px] sm:h-[134px] w-auto max-w-none object-contain object-bottom will-change-transform"
              style={{
                filter: 'drop-shadow(0 8px 12px rgba(15, 23, 42, 0.22))',
              }}
            />
          )}
        </motion.div>

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
