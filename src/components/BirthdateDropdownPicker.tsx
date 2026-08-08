import React, { useState, useEffect, useMemo } from 'react';
import { CustomSelect, DropdownOption } from './CustomSelect';
import { Calendar } from 'lucide-react';

interface BirthdateDropdownPickerProps {
  value: string; // Expected format: 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const MONTHS: DropdownOption[] = [
  { value: '01', label: 'January (01)' },
  { value: '02', label: 'February (02)' },
  { value: '03', label: 'March (03)' },
  { value: '04', label: 'April (04)' },
  { value: '05', label: 'May (05)' },
  { value: '06', label: 'June (06)' },
  { value: '07', label: 'July (07)' },
  { value: '08', label: 'August (08)' },
  { value: '09', label: 'September (09)' },
  { value: '10', label: 'October (10)' },
  { value: '11', label: 'November (11)' },
  { value: '12', label: 'December (12)' },
];

export const BirthdateDropdownPicker: React.FC<BirthdateDropdownPickerProps> = ({
  value,
  onChange,
  label = 'Birthdate',
  required = false,
  disabled = false,
  className = '',
}) => {
  // Local state for month, day, year dropdowns
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [day, setDay] = useState<string>('');

  // Synchronize local dropdown state when `value` prop is set or updated externally
  useEffect(() => {
    if (value && value.trim().length >= 8) {
      const cleanStr = value.trim().substring(0, 10);
      const parts = cleanStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        const y = parts[0];
        const m = String(Number(parts[1])).padStart(2, '0');
        const d = String(Number(parts[2])).padStart(2, '0');
        if (!isNaN(Number(y)) && !isNaN(Number(m)) && !isNaN(Number(d))) {
          setYear(y);
          setMonth(m);
          setDay(d);
          return;
        }
      }
      const dt = new Date(value);
      if (!isNaN(dt.getTime())) {
        setYear(String(dt.getFullYear()));
        setMonth(String(dt.getMonth() + 1).padStart(2, '0'));
        setDay(String(dt.getDate()).padStart(2, '0'));
        return;
      }
    } else if (!value) {
      // If external value is reset to empty string and local state was complete, reset dropdowns
      if (year && month && day) {
        setYear('');
        setMonth('');
        setDay('');
      }
    }
  }, [value]);

  // Calculate maximum valid days in the selected month & year
  const maxDays = useMemo(() => {
    const y = Number(year) || 2000;
    const m = Number(month) || 1;
    return new Date(y, m, 0).getDate();
  }, [year, month]);

  // Generate Days options (1 to maxDays)
  const dayOptions: DropdownOption[] = useMemo(() => {
    const options: DropdownOption[] = [];
    for (let i = 1; i <= maxDays; i++) {
      const formatted = String(i).padStart(2, '0');
      options.push({ value: formatted, label: `Day ${i}` });
    }
    return options;
  }, [maxDays]);

  // Generate Years options (Current year down to 1920)
  const yearOptions: DropdownOption[] = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const options: DropdownOption[] = [];
    for (let y = currentYear; y >= 1920; y--) {
      options.push({ value: String(y), label: String(y) });
    }
    return options;
  }, []);

  const triggerChange = (y: string, m: string, d: string) => {
    if (y && m && d) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange('');
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    let currentDay = day;
    if (year && newMonth && currentDay) {
      const daysInMonth = new Date(Number(year), Number(newMonth), 0).getDate();
      if (Number(currentDay) > daysInMonth) {
        currentDay = String(daysInMonth).padStart(2, '0');
        setDay(currentDay);
      }
    }
    triggerChange(year, newMonth, currentDay);
  };

  const handleDayChange = (newDay: string) => {
    setDay(newDay);
    triggerChange(year, month, newDay);
  };

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    let currentDay = day;
    if (newYear && month && currentDay) {
      const daysInMonth = new Date(Number(newYear), Number(month), 0).getDate();
      if (Number(currentDay) > daysInMonth) {
        currentDay = String(daysInMonth).padStart(2, '0');
        setDay(currentDay);
      }
    }
    triggerChange(newYear, month, currentDay);
  };

  // Badge formatted display
  const displayFormattedDate = useMemo(() => {
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
    if (year || month || day) {
      return [month ? `MM:${month}` : '', day ? `DD:${day}` : '', year ? `YYYY:${year}` : '']
        .filter(Boolean)
        .join(' / ');
    }
    return value || '';
  }, [year, month, day, value]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
            <span>{label}</span> {required && <span className="text-rose-500">*</span>}
          </label>
          {displayFormattedDate && (
            <span className="text-[9px] sm:text-[10px] font-mono font-semibold text-[#2d6a4f] bg-[#e8f5e9] px-2 py-0.5 rounded-full">
              {displayFormattedDate}
            </span>
          )}
        </div>
      )}

      {/* 3 Interactive Dropdowns for Month, Day, Year */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <CustomSelect
          placeholder="Month"
          value={month}
          disabled={disabled}
          onChange={handleMonthChange}
          options={MONTHS}
        />

        <CustomSelect
          placeholder="Day"
          value={day}
          disabled={disabled}
          onChange={handleDayChange}
          options={dayOptions}
          searchable={dayOptions.length > 10}
        />

        <CustomSelect
          placeholder="Year"
          value={year}
          disabled={disabled}
          onChange={handleYearChange}
          options={yearOptions}
          searchable
        />
      </div>
    </div>
  );
};
