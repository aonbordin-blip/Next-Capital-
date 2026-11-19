import React, { useEffect, useState } from 'react';

function formatTenureThai(totalMonths: number, compact = false): string {
  const safe = Math.max(0, Math.round(totalMonths));
  const years = Math.floor(safe / 12);
  const months = safe % 12;
  if (years > 0 && months > 0) {
    return compact ? `${years} ปี ${months} ด.` : `${years} ปี ${months} เดือน`;
  }
  if (years > 0) {
    return `${years} ปี`;
  }
  return compact ? `${months} ด.` : `${months} เดือน`;
}

interface YearsMonthsInputProps {
  label: string;
  criteriaHint: string;
  value: string;
  onChange: (totalMonths: string) => void;
  status: 'empty' | 'pass' | 'fail';
}

function parseExternalMonths(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function splitMonthsToParts(total: number | null): { years: string; months: string } {
  if (total === null) {
    return { years: '', months: '' };
  }
  const y = Math.floor(total / 12);
  const m = total % 12;
  return {
    years: y > 0 ? String(y) : '',
    months: m > 0 || y === 0 ? String(m) : '',
  };
}

export const YearsMonthsInput: React.FC<YearsMonthsInputProps> = ({
  label,
  criteriaHint,
  value,
  onChange,
  status,
}) => {
  const externalTotal = parseExternalMonths(value);
  const initialParts = splitMonthsToParts(externalTotal);

  const [yearsText, setYearsText] = useState<string>(initialParts.years);
  const [monthsText, setMonthsText] = useState<string>(initialParts.months);

  useEffect(() => {
    const ext = parseExternalMonths(value);
    const hasLocal = yearsText.trim() !== '' || monthsText.trim() !== '';
    const localTotal = hasLocal
      ? (Number(yearsText || 0) || 0) * 12 + (Number(monthsText || 0) || 0)
      : null;

    if (ext !== localTotal) {
      const next = splitMonthsToParts(ext);
      setYearsText(next.years);
      setMonthsText(next.months);
    }
  }, [value, yearsText, monthsText]);

  const emitChange = (nextYears: string, nextMonths: string) => {
    if (nextYears === '' && nextMonths === '') {
      onChange('');
      return;
    }
    const y = Number(nextYears || 0) || 0;
    const m = Number(nextMonths || 0) || 0;
    onChange(String(y * 12 + m));
  };

  const handleYearsChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setYearsText(digits);
    emitChange(digits, monthsText);
  };

  const handleMonthsChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setMonthsText(digits);
    emitChange(yearsText, digits);
  };

  const handleMonthsBlur = () => {
    if (yearsText === '' && monthsText === '') return;
    const y = Number(yearsText || 0) || 0;
    const m = Number(monthsText || 0) || 0;
    if (m >= 12) {
      const normalizedTotal = y * 12 + m;
      const next = splitMonthsToParts(normalizedTotal);
      setYearsText(next.years);
      setMonthsText(next.months);
      onChange(String(normalizedTotal));
    }
  };

  const borderStatusClass =
    status === 'fail'
      ? 'border-rose-400 bg-rose-50/60 text-rose-900'
      : status === 'pass'
      ? 'border-emerald-400 text-emerald-950'
      : 'text-slate-900';

  const summaryBadgeClass =
    status === 'fail'
      ? 'text-rose-700'
      : status === 'pass'
      ? 'text-emerald-700'
      : 'text-slate-500';

  const summaryLabel =
    externalTotal !== null
      ? externalTotal >= 12
        ? `${formatTenureThai(externalTotal, true)} (${externalTotal} ด.)`
        : `${externalTotal} ด.`
      : '';

  return (
    <div>
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <label className="text-[10px] text-slate-600 font-medium truncate">
          {label}{' '}
          <span className="text-[9px] text-slate-400">({criteriaHint})</span>
        </label>
        {summaryLabel && (
          <span className={`text-[9.5px] font-bold shrink-0 ${summaryBadgeClass}`}>
            {summaryLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="99"
            aria-label={`${label} (ปี)`}
            value={yearsText}
            onChange={(e) => handleYearsChange(e.target.value)}
            placeholder="0"
            className={`w-full glass-input-field rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-bold outline-none ${borderStatusClass}`}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">
            ปี
          </span>
        </div>

        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="99"
            aria-label={`${label} (เดือน)`}
            value={monthsText}
            onChange={(e) => handleMonthsChange(e.target.value)}
            onBlur={handleMonthsBlur}
            placeholder="0"
            className={`w-full glass-input-field rounded-xl pl-2.5 pr-10 py-1.5 text-xs font-bold outline-none ${borderStatusClass}`}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 pointer-events-none">
            เดือน
          </span>
        </div>
      </div>
    </div>
  );
};
