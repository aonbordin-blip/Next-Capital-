import { useEffect, useState } from 'react';

export function useModalTransition(
  isOpen: boolean,
  onClose?: () => void,
  durationMs: number = 160
) {
  const [isRendered, setIsRendered] = useState<boolean>(isOpen);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, durationMs);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, isRendered, durationMs]);

  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const shouldRender = isOpen || isRendered;

  return {
    shouldRender,
    isClosing,
    backdropAnimClass: isClosing
      ? 'animate-backdrop-out pointer-events-none'
      : 'animate-backdrop-in',
    sheetAnimClass: isClosing ? 'animate-modal-sheet-out' : 'animate-modal-sheet-in',
  };
}
