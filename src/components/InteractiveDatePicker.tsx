import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface InteractiveDatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
  id?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const InteractiveDatePicker: React.FC<InteractiveDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select date (MM/DD/YYYY)',
  disabled = false,
  required = false,
  minDate,
  maxDate,
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date or default to today
  const parseDate = (dStr: string) => {
    if (!dStr) return null;
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const selectedDate = parseDate(value);
  const today = new Date();

  // Current view month & year in the calendar
  const [viewYear, setViewYear] = useState<number>(() => selectedDate ? selectedDate.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => selectedDate ? selectedDate.getMonth() : today.getMonth());
  const [showMonthYearPicker, setShowMonthYearPicker] = useState<boolean>(false);

  // Synchronize view when value changes from outside
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMonthYearPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatDateToIso = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dStr: string): string => {
    if (!dStr) return '';
    const d = parseDate(dStr);
    if (!d) return dStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number, monthOffset: number = 0) => {
    let targetYear = viewYear;
    let targetMonth = viewMonth + monthOffset;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }

    const newDate = new Date(targetYear, targetMonth, day);
    const isoString = formatDateToIso(newDate);
    onChange(isoString);
    setIsOpen(false);
    setShowMonthYearPicker(false);
  };

  const handleTodayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    const isoString = formatDateToIso(now);
    onChange(isoString);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
    setShowMonthYearPicker(false);
  };

  const handleClearClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setShowMonthYearPicker(false);
  };

  // Generate days grid
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInCurrentMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayIndex = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1);

  // Year options for selection dropdown
  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[9.5px] sm:text-[10.5px] font-bold text-[#1b4332]">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Input Trigger Button */}
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(prev => !prev);
              setShowMonthYearPicker(false);
            }
          }}
          className={`w-full px-2.5 py-1.5 sm:py-2 bg-[#f7f9f7] disabled:bg-[#f0f4f1] disabled:text-gray-400 border border-[#e2ece2] rounded-lg text-xs text-[#1b4332] font-medium flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:border-[#2d6a4f] focus:bg-white focus:ring-1 focus:ring-[#2d6a4f]/20 ${
            isOpen ? 'border-[#2d6a4f] bg-white ring-1 ring-[#2d6a4f]/20' : 'hover:border-[#b7d5be]'
          }`}
        >
          <span className={`truncate ${value ? 'text-[#1b4332] font-semibold' : 'text-stone-400'}`}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            {value && !required && !disabled && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                title="Clear date"
                className="p-0.5 text-stone-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-colors"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <CalendarIcon className={`w-3.5 h-3.5 ${isOpen ? 'text-[#2d6a4f]' : 'text-[#52605d]'}`} />
          </div>
        </button>

        {/* Interactive Calendar Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute left-0 top-full mt-1.5 z-[100] w-[270px] sm:w-[290px] bg-white rounded-xl shadow-2xl border border-[#d2e3d5] p-3 text-stone-800 space-y-2 select-none"
            >
              {/* Header: Month / Year with Navigation */}
              <div className="flex items-center justify-between border-b border-[#eef5f0] pb-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="p-1 rounded-md hover:bg-[#eef5f0] text-[#1b4332] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Month & Year Title / Dropdown Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMonthYearPicker(prev => !prev);
                  }}
                  className="px-2 py-1 rounded-md hover:bg-[#eef5f0] font-heading font-black text-xs text-[#1b4332] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
                  <span className="text-[10px] text-[#2d6a4f] opacity-80">▾</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="p-1 rounded-md hover:bg-[#eef5f0] text-[#1b4332] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Month & Year Selection Overlay */}
              {showMonthYearPicker ? (
                <div className="py-2 space-y-2 animate-in fade-in duration-150">
                  <div className="grid grid-cols-3 gap-1 max-h-[140px] overflow-y-auto pr-1">
                    {MONTH_NAMES.map((mName, idx) => (
                      <button
                        key={mName}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMonth(idx);
                          setShowMonthYearPicker(false);
                        }}
                        className={`px-1.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                          viewMonth === idx
                            ? 'bg-[#1b4332] text-white'
                            : 'hover:bg-[#eef5f0] text-[#1b4332]'
                        }`}
                      >
                        {mName.substring(0, 3)}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#eef5f0] flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-500">Year:</span>
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] py-1">
                      {yearOptions.map(y => (
                        <button
                          key={y}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewYear(y);
                            setShowMonthYearPicker(false);
                          }}
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                            viewYear === y
                              ? 'bg-[#1b4332] text-white'
                              : 'hover:bg-[#eef5f0] text-stone-700'
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {SHORT_DAYS.map(day => (
                      <div key={day} className="text-[10px] font-extrabold text-[#52605d] py-0.5">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Previous month filler days */}
                    {Array.from({ length: firstDayIndex }).map((_, i) => {
                      const dayNum = daysInPrevMonth - firstDayIndex + i + 1;
                      return (
                        <button
                          key={`prev-${i}`}
                          type="button"
                          onClick={() => handleSelectDay(dayNum, -1)}
                          className="h-7 text-[11px] font-medium text-stone-300 hover:text-stone-500 hover:bg-stone-50 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                        >
                          {dayNum}
                        </button>
                      );
                    })}

                    {/* Current month days */}
                    {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const isSelected =
                        selectedDate &&
                        selectedDate.getFullYear() === viewYear &&
                        selectedDate.getMonth() === viewMonth &&
                        selectedDate.getDate() === dayNum;

                      const isToday =
                        today.getFullYear() === viewYear &&
                        today.getMonth() === viewMonth &&
                        today.getDate() === dayNum;

                      return (
                        <button
                          key={`curr-${dayNum}`}
                          type="button"
                          onClick={() => handleSelectDay(dayNum, 0)}
                          className={`h-7 text-[11px] font-bold rounded-lg flex items-center justify-center relative transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1b4332] text-white font-black shadow-sm ring-2 ring-[#74c69d]/40'
                              : isToday
                              ? 'bg-[#e2ece2] text-[#1b4332] font-black border border-[#74c69d]'
                              : 'hover:bg-[#eef5f0] text-[#1b4332]'
                          }`}
                        >
                          <span>{dayNum}</span>
                          {isToday && !isSelected && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#2d6a4f] rounded-full" />
                          )}
                        </button>
                      );
                    })}

                    {/* Next month filler days */}
                    {(() => {
                      const totalCells = firstDayIndex + daysInCurrentMonth;
                      const nextMonthCells = (7 - (totalCells % 7)) % 7;
                      return Array.from({ length: nextMonthCells }).map((_, i) => {
                        const dayNum = i + 1;
                        return (
                          <button
                            key={`next-${i}`}
                            type="button"
                            onClick={() => handleSelectDay(dayNum, 1)}
                            className="h-7 text-[11px] font-medium text-stone-300 hover:text-stone-500 hover:bg-stone-50 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          >
                            {dayNum}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {/* Footer Actions: Clear & Today */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#eef5f0] text-[11px]">
                    <button
                      type="button"
                      onClick={handleClearClick}
                      className="px-2 py-0.5 text-stone-500 hover:text-stone-800 font-semibold hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      onClick={handleTodayClick}
                      className="px-2 py-0.5 text-[#1b4332] hover:text-[#2d6a4f] font-extrabold hover:bg-[#eef5f0] rounded-md transition-colors cursor-pointer"
                    >
                      Today
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
