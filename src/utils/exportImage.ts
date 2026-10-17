import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { PROMPT_FONT_EMBED_CSS } from '../data/promptFontBase64';

export async function downloadElementAsImage(
  element: HTMLElement,
  fileName: string,
  targetWidth = 780
): Promise<void> {
  // 1. Ensure fonts in document are fully ready
  if (document.fonts) {
    try {
      await document.fonts.load('400 16px Prompt');
      await document.fonts.load('600 16px Prompt');
      await document.fonts.load('700 16px Prompt');
      await document.fonts.load('800 16px Prompt');
      await document.fonts.ready;
    } catch {
      // Ignore font loading errors and continue
    }
  }

  // Slight delay to allow DOM calculations to settle
  await new Promise((r) => setTimeout(r, 80));

  let success = false;

  // METHOD 1: html-to-image (Native browser SVG foreignObject rendering with embedded Prompt font)
  // This renders 100% identical to the browser screen preview with perfect Thai glyphs & tone marks (วรรณยุกต์)
  try {
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, // 2x high resolution retina quality
      width: targetWidth,
      skipFonts: true, // IMPORTANT: Avoids CORS failures on Google Fonts links; uses fontEmbedCSS instead
      fontEmbedCSS: PROMPT_FONT_EMBED_CSS,
      cacheBust: false,
      backgroundColor: '#ffffff',
      style: {
        opacity: '1',
        visibility: 'visible',
        position: 'static',
        transform: 'none',
        left: '0',
        top: '0',
        margin: '0 auto',
        width: `${targetWidth}px`,
      },
    });

    if (dataUrl && dataUrl.length > 500) {
      triggerFileDownload(dataUrl, fileName);
      success = true;
    }
  } catch (err) {
    console.warn('html-to-image capture failed, falling back to html2canvas:', err);
  }

  if (success) return;

  // METHOD 2: html2canvas fallback with base64 embedded Prompt font
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: targetWidth,
    windowWidth: targetWidth,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc, clonedElement) => {
      // 1. Remove stylesheets that could trigger parse errors
      clonedDoc.querySelectorAll('style').forEach((st) => {
        if (
          st.textContent &&
          (st.textContent.includes('oklch') || st.textContent.includes('tailwindcss'))
        ) {
          st.remove();
        }
      });
      clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
        const href = l.getAttribute('href') || '';
        if (!href.includes('fonts.googleapis.com')) {
          l.remove();
        }
      });

      // 2. Inject Prompt font base64 stylesheet directly into clone
      const cleanStyle = clonedDoc.createElement('style');
      cleanStyle.textContent = `
        ${PROMPT_FONT_EMBED_CSS}
        * {
          box-sizing: border-box !important;
          font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          -webkit-font-smoothing: antialiased !important;
        }
        body {
          background-color: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          width: ${targetWidth}px !important;
          font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        table {
          border-collapse: collapse !important;
        }
        table th, table td {
          vertical-align: middle !important;
          font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
      `;
      clonedDoc.head.appendChild(cleanStyle);

      // 3. Clear body and mount ONLY the cloned target
      if (clonedElement) {
        clonedDoc.body.innerHTML = '';
        clonedDoc.body.appendChild(clonedElement);

        clonedElement.style.position = 'static';
        clonedElement.style.display = 'block';
        clonedElement.style.visibility = 'visible';
        clonedElement.style.opacity = '1';
        clonedElement.style.zIndex = '1';
        clonedElement.style.left = '0';
        clonedElement.style.top = '0';
        clonedElement.style.margin = '0 auto';
        clonedElement.style.width = `${targetWidth}px`;
        clonedElement.style.backgroundColor = '#ffffff';
      }
    },
  });

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error('ไม่สามารถประมวลผลรูปภาพเอกสารได้');
  }

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (!blob) {
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        triggerFileDownload(dataUrl, fileName);
        return;
      }
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }, 'image/png', 1.0);
  } else {
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    triggerFileDownload(dataUrl, fileName);
  }
}

function triggerFileDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
