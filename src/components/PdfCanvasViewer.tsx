import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertTriangle,
  RotateCw,
  Maximize,
  ExternalLink,
} from 'lucide-react';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  try {
    const base64Index = dataUrl.indexOf('base64,');
    const base64 = base64Index !== -1 ? dataUrl.substring(base64Index + 7) : dataUrl;
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error('Failed to decode PDF base64:', err);
    throw new Error('ไม่สามารถถอดรหัสไฟล์ PDF ได้');
  }
}

interface PdfCanvasViewerProps {
  dataUrl: string;
  fileName?: string;
  mode?: 'inline' | 'popup';
  onOpenExternal?: () => void;
  className?: string;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  dataUrl,
  fileName = 'เอกสารการอนุมัติ.pdf',
  mode = 'inline',
  onOpenExternal,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<boolean>(false);
  const [basePageWidth, setBasePageWidth] = useState<number>(595);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const bytes = dataUrlToUint8Array(dataUrl);
        const loadingTask = pdfjsLib.getDocument({
          data: bytes,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);

          // Calculate initial Fit-Width scale based on container width
          const firstPage = await doc.getPage(1);
          const baseVp = firstPage.getViewport({ scale: 1.0 });
          setBasePageWidth(baseVp.width);

          const availableWidth =
            (scrollViewportRef.current?.clientWidth ||
              containerRef.current?.clientWidth ||
              window.innerWidth ||
              380) - 28;

          if (mode === 'popup') {
            // Fit to mobile width by default so the entire document is visible from left to right
            const fitScale = Math.max(0.45, Math.min(2.0, availableWidth / baseVp.width));
            setScale(Number(fitScale.toFixed(2)));
          } else {
            // Inline thumbnail fit
            const inlineScale = Math.max(0.4, availableWidth / baseVp.width);
            setScale(Number(inlineScale.toFixed(2)));
          }

          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Error loading PDF via PDF.js:', err);
          setError(err?.message || 'ไม่สามารถโหลดไฟล์ PDF ได้');
          setIsLoading(false);
        }
      }
    };

    if (dataUrl) {
      loadPdf();
    }

    return () => {
      isCancelled = true;
    };
  }, [dataUrl, mode]);

  // Render current page onto canvas with high-DPI crisp quality
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setRenderProgress(true);
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;
        const viewport = page.getViewport({ scale });

        // Set display dimensions (CSS pixels)
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        // Set backing buffer dimensions (Device pixels for retina sharpness)
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Fill crisp white background before painting
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.warn('PDF page rendering error or cancelled:', err);
      } finally {
        setRenderProgress(false);
      }
    },
    [pdfDoc, scale]
  );

  useEffect(() => {
    if (pdfDoc && !isLoading) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, isLoading, renderPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
  };

  const handleZoomIn = () => {
    setScale((prev) => Number((Math.min(prev + 0.2, 3.0)).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => Number((Math.max(prev - 0.2, 0.4)).toFixed(2)));
  };

  const handleResetZoom100 = () => {
    setScale(1.0);
  };

  const handleFitWidth = () => {
    const availableWidth =
      (scrollViewportRef.current?.clientWidth ||
        containerRef.current?.clientWidth ||
        window.innerWidth ||
        380) - 28;
    const fitScale = Math.max(0.45, Math.min(2.0, availableWidth / basePageWidth));
    setScale(Number(fitScale.toFixed(2)));
  };

  // Inline Preview Mode (ในการ์ดรายละเอียดเคส)
  if (mode === 'inline') {
    return (
      <div
        ref={containerRef}
        className={`relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 shadow-sm ${className}`}
      >
        {/* Inline Top Toolbar */}
        <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-bold truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-200">
              ตัวอย่างเอกสาร (หน้า {currentPage}/{numPages})
            </span>
          </div>

          <div className="flex items-center gap-1">
            {numPages > 1 && (
              <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg px-1 py-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="px-1 text-slate-300 font-mono font-bold">
                  {currentPage}/{numPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  className="p-1 hover:text-white disabled:opacity-30 cursor-pointer"
                  title="หน้าถัดไป"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {onOpenExternal && (
              <button
                type="button"
                onClick={onOpenExternal}
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="เปิดดูเอกสารด้วยแอพภายนอก"
              >
                <ExternalLink className="w-3 h-3" />
                <span>เปิดในแอพภายนอก</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas Display with full scrollable wrapper */}
        <div
          ref={scrollViewportRef}
          className="relative min-h-[260px] max-h-[380px] overflow-auto p-2 bg-slate-950"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-white text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              <span>กำลังแปลงหน้าเอกสาร PDF...</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-rose-200 text-xs space-y-1">
              <AlertTriangle className="w-6 h-6 mx-auto text-rose-400" />
              <p className="font-bold">ไม่สามารถแสดงตัวอย่างเอกสารได้</p>
              <p className="text-[10px] text-slate-300">{error}</p>
            </div>
          )}

          <div className="min-w-fit min-h-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className={`shadow-md rounded block mx-auto bg-white transition-opacity duration-200 ${
                isLoading || error ? 'hidden' : 'block'
              }`}
            />
          </div>
        </div>
      </div>
    );
  }

  // Popup Full Mode (หน้าต่างแสดงผลเต็ม)
  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full bg-slate-950 text-slate-100 select-none ${className}`}
    >
      {/* Interactive Controls Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-2.5 sm:px-4 py-2 flex items-center justify-between gap-1.5 flex-wrap text-xs shrink-0 z-10 shadow-xs">
        {/* Page Selector & Count */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-[11px] sm:text-xs font-bold text-slate-200 px-1.5 py-1 rounded bg-slate-800/80 font-mono">
            {currentPage} / {numPages}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="หน้าถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls: Fit Width, -, %, + */}
        <div className="flex items-center gap-1">
          {/* Fit Width Button */}
          <button
            type="button"
            onClick={handleFitWidth}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            title="ปรับความกว้างให้พอดีหน้าจอ"
          >
            <Maximize className="w-3 h-3 text-rose-400" />
            <span>พอดีจอ</span>
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.45 || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="ย่อขนาด"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom100}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 hover:text-white cursor-pointer transition-colors"
            title="ปรับเป็นขนาดปกติ 100%"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="ขยายขนาด"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Viewport: Fully scrollable in 360-degrees without negative coordinate clipping */}
      <div
        ref={scrollViewportRef}
        className="flex-1 overflow-auto p-2 sm:p-4 bg-slate-950 relative overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white bg-slate-950/80 z-20">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <span className="text-xs font-bold">กำลังแสดงผลเอกสาร PDF อัตโนมัติ...</span>
          </div>
        )}

        {error && (
          <div className="my-auto p-6 max-w-md mx-auto text-center bg-slate-900 rounded-2xl border border-rose-500/40 text-xs space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />
            <p className="font-extrabold text-sm text-white">ไม่สามารถแสดงผลเอกสารได้</p>
            <p className="text-slate-300 text-[11px]">{error}</p>
            <a
              href={dataUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลดไฟล์ PDF แทน</span>
            </a>
          </div>
        )}

        {renderProgress && !isLoading && (
          <div className="sticky top-2 right-2 float-right bg-slate-800/90 text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 z-20 shadow-md">
            <RotateCw className="w-3 h-3 animate-spin text-rose-400" />
            <span>ปรับความคมชัด...</span>
          </div>
        )}

        {/* min-w-fit container: Guarantees zero clipping when zoomed in */}
        <div className="min-w-fit min-h-full flex items-center justify-center p-1 sm:p-3">
          <canvas
            ref={canvasRef}
            className={`shadow-2xl rounded-sm block mx-auto bg-white transition-opacity duration-150 ${
              isLoading || error ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
