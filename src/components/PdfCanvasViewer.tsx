import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  Loader2,
  AlertTriangle,
  RotateCw,
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
  onExpand?: () => void;
  className?: string;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  dataUrl,
  fileName = 'เอกสารการอนุมัติ.pdf',
  mode = 'popup',
  onExpand,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(mode === 'inline' ? 1.0 : 1.25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<boolean>(false);

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
  }, [dataUrl]);

  // Render current page onto canvas with high-DPI crisp quality
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

      try {
        setRenderProgress(true);
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        // Calculate responsive scale based on container width
        const containerWidth = containerRef.current.clientWidth || 360;
        const baseViewport = page.getViewport({ scale: 1.0 });

        let targetScale = scale;
        if (mode === 'inline') {
          // Fit comfortably within container
          targetScale = (containerWidth - 24) / baseViewport.width;
          if (targetScale <= 0) targetScale = 1.0;
        }

        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;
        const viewport = page.getViewport({ scale: targetScale });

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
    [pdfDoc, scale, mode]
  );

  useEffect(() => {
    if (pdfDoc && !isLoading) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, isLoading, renderPage]);

  // Re-render when container resizes
  useEffect(() => {
    if (mode !== 'inline' || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (pdfDoc && !isLoading) {
        renderPage(currentPage);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mode, pdfDoc, isLoading, currentPage, renderPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.6));
  };

  const handleResetZoom = () => {
    setScale(1.2);
  };

  // Inline Preview Mode
  if (mode === 'inline') {
    return (
      <div
        ref={containerRef}
        className={`relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-sm ${className}`}
      >
        {/* Inline Top Toolbar */}
        <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs border-b border-slate-800">
          <div className="flex items-center gap-1.5 font-bold truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] text-slate-200">ตัวอย่างเอกสาร (หน้า {currentPage}/{numPages})</span>
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

            {onExpand && (
              <button
                type="button"
                onClick={onExpand}
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10.5px] flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="ขยายดูแบบเต็มจอ Popup"
              >
                <Maximize2 className="w-3 h-3" />
                <span>ขยายเต็มจอ</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative min-h-[260px] max-h-[380px] overflow-auto flex items-center justify-center p-2 bg-slate-800/80">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-white text-xs">
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

          <canvas
            ref={canvasRef}
            className={`mx-auto shadow-md rounded transition-opacity duration-200 ${
              isLoading || error ? 'hidden' : 'block'
            }`}
          />
        </div>
      </div>
    );
  }

  // Popup Full Mode
  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 select-none ${className}`}
    >
      {/* Interactive Controls Toolbar */}
      <div className="bg-slate-800/90 border-b border-slate-700/80 px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs shrink-0 z-10 shadow-xs">
        {/* Page Selector & Count */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="หน้าก่อนหน้า"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-slate-200 px-1 font-mono">
            หน้า {currentPage} / {numPages}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="หน้าถัดไป"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.6 || isLoading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="ย่อขนาด"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-mono text-slate-200 cursor-pointer"
            title="รีเซ็ตขนาด 100%"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || isLoading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="ขยายขนาด"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Scroll Viewport */}
      <div className="flex-1 overflow-auto p-3 sm:p-5 flex items-start justify-center bg-slate-900/95 relative touch-pan-x touch-pan-y overscroll-contain">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white bg-slate-900/80 z-20">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <span className="text-xs font-bold">กำลังแสดงผลเอกสาร PDF อัตโนมัติ...</span>
          </div>
        )}

        {error && (
          <div className="my-auto p-6 max-w-md text-center bg-slate-800 rounded-2xl border border-rose-500/40 text-xs space-y-3">
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
          <div className="absolute top-3 right-3 bg-slate-800/80 text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1 z-20">
            <RotateCw className="w-3 h-3 animate-spin text-rose-400" />
            <span>กำลังปรับความคมชัด...</span>
          </div>
        )}

        <div className="relative inline-block my-auto">
          <canvas
            ref={canvasRef}
            className={`shadow-2xl rounded-sm transition-opacity duration-150 ${
              isLoading || error ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
