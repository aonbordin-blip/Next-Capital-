import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { sanitizeCustomerPhotoDataUrl } from '../utils/thaiIdUtils';

export interface CustomerAvatarProps {
  photoUrl?: string | null;
  customerName?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallbackMode?: 'initial' | 'icon';
  fallbackClassName?: string;
  imgRingClassName?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CustomerAvatarProps['size']>, string> = {
  xs: 'w-7 h-7 rounded-lg text-[11px]',
  sm: 'w-8 h-8 rounded-xl text-xs',
  md: 'w-9 h-9 rounded-xl text-xs sm:text-sm',
  lg: 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl text-sm sm:text-base',
  xl: 'w-14 h-14 rounded-2xl text-lg',
};

const ICON_SIZE_CLASSES: Record<NonNullable<CustomerAvatarProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
};

export const CustomerAvatar: React.FC<CustomerAvatarProps> = ({
  photoUrl,
  customerName,
  size = 'md',
  fallbackMode = 'initial',
  fallbackClassName = 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/70',
  imgRingClassName = 'border-emerald-300/90 dark:border-emerald-600/80 ring-1 ring-emerald-500/20',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const validPhoto = sanitizeCustomerPhotoDataUrl(photoUrl);

  useEffect(() => {
    setImgError(false);
  }, [validPhoto]);

  const sizeCls = SIZE_CLASSES[size];
  const cleanName = (customerName || '').trim();
  const initial = cleanName.slice(0, 1) || 'ค';

  if (validPhoto && !imgError) {
    return (
      <div
        className={`${sizeCls} relative overflow-hidden shrink-0 border bg-slate-100 dark:bg-slate-800 shadow-2xs ${imgRingClassName} ${className}`}
      >
        <img
          src={validPhoto}
          alt={cleanName ? `รูปโปรไฟล์ ${cleanName}` : 'รูปโปรไฟล์ลูกค้า'}
          onError={() => setImgError(true)}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeCls} flex items-center justify-center font-black shrink-0 shadow-2xs border ${fallbackClassName} ${className}`}
    >
      {fallbackMode === 'icon' ? (
        <User className={ICON_SIZE_CLASSES[size]} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};
