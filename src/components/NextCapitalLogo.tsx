import React from 'react';

interface NextCapitalLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const NextCapitalLogo: React.FC<NextCapitalLogoProps> = ({
  className = '',
  size = 32,
  showText = false,
}) => {
  // Blue Upper Shape (Royal Blue)
  const bluePath = `
    M 112 72
    L 416 72
    L 398 138
    L 332 138
    L 286 264
    L 240 138
    L 160 138
    L 102 348
    L 38 348
    Z
  `;

  // Yellow Lower Shape (Golden Amber/Yellow) - Exact 180° Rotational Symmetry coordinates
  const yellowPath = `
    M 388 428
    L 84 428
    L 102 362
    L 168 362
    L 214 236
    L 260 362
    L 340 362
    L 398 152
    L 462 152
    Z
  `;

  return (
    <div className={`flex items-center justify-center leading-none ${showText ? 'gap-2' : ''} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 block"
        style={{ display: 'block' }}
      >
        {/* Blue Upper Shape (Royal Blue) */}
        <path
          d={bluePath}
          fill="#1C449C"
        />

        {/* Yellow Lower Shape (Golden Amber/Yellow) */}
        <path
          d={yellowPath}
          fill="#F5A81C"
        />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-sm tracking-tight text-slate-900 uppercase font-sans">
            Next Capital
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            บมจ. เน็กซ์ แคปปิตอล
          </span>
        </div>
      )}
    </div>
  );
};
