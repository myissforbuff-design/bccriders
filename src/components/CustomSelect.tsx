import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface DropdownOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (DropdownOption | string)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
  searchable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  label,
  required = false,
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options array
  const normalizedOptions: DropdownOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Grouping check
  const hasGroups = normalizedOptions.some((opt) => Boolean(opt.group));

  // Find currently selected label
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Filter options by search term
  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.group && opt.group.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Group items if groups exist
  const groups: { [groupName: string]: DropdownOption[] } = {};
  if (hasGroups) {
    filteredOptions.forEach((opt) => {
      const gName = opt.group || 'Other';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(opt);
    });
  }

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border transition-all flex items-center justify-between text-[10px] sm:text-xs font-semibold cursor-pointer select-none ${
            disabled
              ? 'bg-[#f0f4f1] border-[#e2ece2] text-gray-400 cursor-not-allowed'
              : isOpen
              ? 'bg-white border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20 text-[#1b4332] shadow-xs'
              : 'bg-white border-[#e2ece2] hover:border-[#2d6a4f] text-[#1b4332]'
          }`}
        >
          <span className={`truncate ${!selectedOption ? 'text-gray-400 font-normal' : ''}`}>
            {displayLabel}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2d6a4f] transition-transform duration-200 shrink-0 ml-1.5 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Options List */}
        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute z-50 left-0 right-0 w-full bg-white border border-[#e2ece2] rounded-xl shadow-xl overflow-hidden max-h-56 sm:max-h-64 flex flex-col"
            >
              {/* Optional Search Input */}
              {searchable && (
                <div className="p-2 border-b border-[#e2ece2] bg-[#f7f9f7] sticky top-0 z-10">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-[#52605d] absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search options..."
                      className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-white border border-[#e2ece2] text-[10px] sm:text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f]"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Options Container */}
              <div className="overflow-y-auto p-1 divide-y divide-[#f0f4f1]">
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2.5 text-center text-[10px] sm:text-xs text-gray-400 italic">
                    No matching options found
                  </div>
                ) : hasGroups ? (
                  Object.keys(groups).map((gName) => (
                    <div key={gName} className="py-1">
                      <div className="px-2.5 py-1 text-[9px] sm:text-[10px] font-extrabold text-[#2d6a4f] uppercase tracking-wider bg-[#f4f8f4] rounded-md mb-1">
                        {gName}
                      </div>
                      {groups[gName].map((opt) => {
                        const isOptDisabled = Boolean(opt.disabled);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isOptDisabled}
                            onClick={() => !isOptDisabled && handleSelect(opt.value)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-between transition-colors ${
                              isOptDisabled
                                ? 'opacity-40 text-gray-400 bg-stone-100/60 cursor-not-allowed select-none'
                                : value === opt.value
                                ? 'bg-[#1b4332] text-white cursor-pointer'
                                : 'hover:bg-[#e8f5e9] text-[#1b4332] cursor-pointer'
                            }`}
                          >
                            <span className="truncate">{opt.label}</span>
                            {value === opt.value && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  filteredOptions.map((opt) => {
                    const isOptDisabled = Boolean(opt.disabled);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isOptDisabled}
                        onClick={() => !isOptDisabled && handleSelect(opt.value)}
                        className={`w-full text-left px-2.5 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-between transition-colors ${
                          isOptDisabled
                            ? 'opacity-40 text-gray-400 bg-stone-100/60 cursor-not-allowed select-none'
                            : value === opt.value
                            ? 'bg-[#1b4332] text-white cursor-pointer'
                            : 'hover:bg-[#e8f5e9] text-[#1b4332] cursor-pointer'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {value === opt.value && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
