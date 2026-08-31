import React, { useState, useRef, useEffect } from 'react';
import { Clock, Check, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface InteractiveTimePickerProps {
  value: string; // e.g. "08:30:00 AM", "08:30", "14:30"
  onChange: (timeStr: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const COMMON_PRESETS = [
  { label: 'Now', time: 'NOW' },
  { label: '08:00 AM', time: '08:00:00 AM' },
  { label: '08:30 AM', time: '08:30:00 AM' },
  { label: '09:00 AM', time: '09:00:00 AM' },
  { label: '10:00 AM', time: '10:00:00 AM' },
  { label: '01:00 PM', time: '01:00:00 PM' },
  { label: '02:00 PM', time: '02:00:00 PM' },
  { label: '05:00 PM', time: '05:00:00 PM' },
  { label: '06:00 PM', time: '06:00:00 PM' },
];

export const InteractiveTimePicker: React.FC<InteractiveTimePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select scan time...',
  disabled = false,
  className = '',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse time into hour (1-12), minute (0-59), period (AM/PM)
  const parseCurrentTime = (val: string) => {
    if (!val) {
      const now = new Date();
      let hours = now.getHours();
      const mins = now.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return {
        hour: String(hours).padStart(2, '0'),
        minute: String(mins).padStart(2, '0'),
        second: '00',
        period: period as 'AM' | 'PM',
      };
    }

    // Match patterns like "08:30:00 AM", "8:30 PM", "14:30", "08:30"
    const ampmMatch = val.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2];
      const s = ampmMatch[3] || '00';
      let p = (ampmMatch[4] || '').toUpperCase() as 'AM' | 'PM' | '';

      if (!p) {
        p = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
      }

      return {
        hour: String(h).padStart(2, '0'),
        minute: m,
        second: s,
        period: (p || 'AM') as 'AM' | 'PM',
      };
    }

    return { hour: '08', minute: '00', second: '00', period: 'AM' as 'AM' | 'PM' };
  };

  const parsed = parseCurrentTime(value);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(parsed.period);

  useEffect(() => {
    if (value) {
      const p = parseCurrentTime(value);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
      setSelectedPeriod(p.period);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFormattedTimeString = (h: string, m: string, p: 'AM' | 'PM') => {
    return `${h}:${m}:00 ${p}`;
  };

  const handleApplyTime = (h: string, m: string, p: 'AM' | 'PM') => {
    const formatted = getFormattedTimeString(h, m, p);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectPreset = (presetTime: string) => {
    if (presetTime === 'NOW') {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      onChange(timeStr);
    } else {
      onChange(presetTime);
    }
    setIsOpen(false);
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <div className={`relative space-y-1 ${className}`} ref={containerRef} id={id}>
      {label && (
        <label className="text-[10.5px] font-extrabold text-[#1b4332] block">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2ece2] rounded-xl text-xs font-semibold text-stone-800 transition-all cursor-pointer shadow-2xs hover:border-[#b7d2b7] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
          disabled ? 'opacity-50 cursor-not-allowed bg-stone-50' : ''
        } ${isOpen ? 'ring-2 ring-emerald-500/30 border-[#2d6a4f]' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <Clock className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
          <span className={`truncate font-mono ${value ? 'text-[#1b4332] font-bold' : 'text-stone-400'}`}>
            {value || placeholder}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 z-50 w-72 sm:w-80 bg-white border border-[#e2ece2] rounded-2xl shadow-xl p-3 space-y-3"
          >
            {/* Quick Presets */}
            <div>
              <div className="text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#2d6a4f]" />
                <span>Quick Presets</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset.time)}
                    className="px-2 py-1 rounded-lg bg-[#f7f9f7] hover:bg-[#e2ece2] border border-[#e2ece2] text-[10px] font-extrabold text-[#1b4332] transition-colors cursor-pointer active:scale-95"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#e2ece2] pt-2.5">
              <div className="text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider mb-2">
                Custom Time Picker
              </div>

              {/* Hour & Minute Selectors */}
              <div className="grid grid-cols-3 gap-2">
                {/* Hours */}
                <div>
                  <div className="text-[9.5px] font-bold text-stone-500 text-center mb-1">Hour</div>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-[#e2ece2] bg-[#f7f9f7] p-1 space-y-0.5">
                    {hoursList.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSelectedHour(h)}
                        className={`w-full py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                          selectedHour === h
                            ? 'bg-[#1b4332] text-white shadow-2xs'
                            : 'hover:bg-white text-stone-700'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minutes */}
                <div>
                  <div className="text-[9.5px] font-bold text-stone-500 text-center mb-1">Minute</div>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-[#e2ece2] bg-[#f7f9f7] p-1 space-y-0.5">
                    {minutesList.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMinute(m)}
                        className={`w-full py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                          selectedMinute === m
                            ? 'bg-[#1b4332] text-white shadow-2xs'
                            : 'hover:bg-white text-stone-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM / PM Toggle */}
                <div>
                  <div className="text-[9.5px] font-bold text-stone-500 text-center mb-1">Period</div>
                  <div className="flex flex-col gap-1">
                    {(['AM', 'PM'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSelectedPeriod(period)}
                        className={`py-3 rounded-xl text-xs font-extrabold transition-colors ${
                          selectedPeriod === period
                            ? 'bg-[#1b4332] text-white shadow-2xs'
                            : 'bg-[#f7f9f7] hover:bg-stone-200 text-stone-700 border border-[#e2ece2]'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-stone-500 hover:text-stone-800"
                >
                  Clear (Now)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTime(selectedHour, selectedMinute, selectedPeriod)}
                  className="px-3.5 py-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-[11px] font-extrabold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                >
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span>Set Time</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
