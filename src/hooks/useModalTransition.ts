import { useEffect, useState } from 'react';

export function useModalTransition(
  isOpen: boolean,
  onClose?: () => void,
  durationMs: number = 220
) {
  const [shouldRender, setShouldRender] = useState<boolean>(isOpen);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, durationMs);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, shouldRender, durationMs]);

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

  return {
    shouldRender,
    isClosing,
    backdropAnimClass: isClosing
      ? 'animate-backdrop-out pointer-events-none'
      : 'animate-backdrop-in',
    sheetAnimClass: isClosing ? 'animate-modal-sheet-out' : 'animate-modal-sheet-in',
  };
}
