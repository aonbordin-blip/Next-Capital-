import React from 'react';
import { createPortal } from 'react-dom';
import { useModalTransition } from '../hooks/useModalTransition';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  accentBarClass?: string;
}

export const CardModalOverlay: React.FC<Props> = ({
  isOpen,
  onClose,
  children,
  maxWidthClass = 'max-w-3xl',
  accentBarClass,
}) => {
  const { shouldRender, isClosing, backdropAnimClass, sheetAnimClass } = useModalTransition(
    isOpen,
    onClose
  );

  if (!shouldRender || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-modal-portal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClosing) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 overflow-y-auto ${backdropAnimClass}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-white dark:bg-slate-900 rounded-3xl w-full ${maxWidthClass} max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 my-auto ${sheetAnimClass}`}
      >
        {accentBarClass && (
          <div className={`absolute inset-x-0 top-0 h-[3px] z-20 ${accentBarClass}`} />
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};
