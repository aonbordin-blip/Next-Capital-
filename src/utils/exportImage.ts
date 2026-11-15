import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { PROMPT_FONT_EMBED_CSS } from '../data/promptFontBase64';

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function generateElementPngBlob(
  element: HTMLElement,
  targetWidth = 780,
  backgroundColor = '#ffffff'
): Promise<Blob> {
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

  // METHOD 1: html-to-image (Native browser SVG foreignObject rendering with embedded Prompt font)
  try {
    const dataUrl = await toPng(element, {
      quality: 1.0,
      pixelRatio: 2, // 2x high resolution retina quality
      width: targetWidth,
      skipFonts: true,
      fontEmbedCSS: PROMPT_FONT_EMBED_CSS,
      cacheBust: false,
      backgroundColor,
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
      return dataUrlToBlob(dataUrl);
    }
  } catch (err) {
    console.warn('html-to-image capture failed, falling back to html2canvas:', err);
  }

  // METHOD 2: html2canvas fallback with base64 embedded Prompt font
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor,
    width: targetWidth,
    windowWidth: targetWidth,
    x: 0,
    y: 0,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDoc, clonedElement) => {
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

      const cleanStyle = clonedDoc.createElement('style');
      cleanStyle.textContent = `
        ${PROMPT_FONT_EMBED_CSS}
        * {
          box-sizing: border-box !important;
          font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          -webkit-font-smoothing: antialiased !important;
        }
        body {
          background-color: ${backgroundColor} !important;
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
        clonedElement.style.backgroundColor = backgroundColor;
      }
    },
  });

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    throw new Error('ไม่สามารถประมวลผลรูปภาพเอกสารได้');
  }

  return new Promise<Blob>((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(dataUrlToBlob(canvas.toDataURL('image/png', 1.0)));
          }
        },
        'image/png',
        1.0
      );
    } else {
      try {
        resolve(dataUrlToBlob(canvas.toDataURL('image/png', 1.0)));
      } catch (e) {
        reject(e);
      }
    }
  });
}

export async function downloadElementAsImage(
  element: HTMLElement,
  fileName: string,
  targetWidth = 780,
  backgroundColor = '#ffffff'
): Promise<void> {
  const blob = await generateElementPngBlob(element, targetWidth, backgroundColor);
  const blobUrl = URL.createObjectURL(blob);
  triggerFileDownload(blobUrl, fileName);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

function triggerFileDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
