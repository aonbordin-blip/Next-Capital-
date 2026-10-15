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
  // Exact vector path of Next Capital's iconic 'N' monogram:
  // Interlocking 180-degree rotationally symmetric blue & yellow polygons
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

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Blue Upper Shape (Royal Blue) */}
        <path
          d={bluePath}
          fill="#1C449C"
        />

        {/* Yellow Lower Shape (Golden Amber/Yellow) - Exact 180° Rotational Symmetry */}
        <path
          d={bluePath}
          fill="#F5A81C"
          transform="rotate(180 250 250)"
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
