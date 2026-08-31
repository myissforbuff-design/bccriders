import React, { useState, useRef, useEffect } from 'react';
import { User, Search, ChevronDown, Check, Shield, Users, Award, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType } from '../types';

export interface InteractiveMemberPickerProps {
  members: UserType[];
  value?: string;
  selectedMemberId?: string;
  onChange?: (memberId: string) => void;
  onSelectMember?: (memberId: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export const InteractiveMemberPicker: React.FC<InteractiveMemberPickerProps> = ({
  members,
  value,
  selectedMemberId,
  onChange,
  onSelectMember,
  label = 'Select Club Member',
  placeholder = 'Choose a member to mark present...',
  disabled = false,
  className = '',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeSelectedId = value !== undefined ? value : selectedMemberId || '';

  const handleSelect = (memberId: string) => {
    if (onChange) onChange(memberId);
    if (onSelectMember) onSelectMember(memberId);
  };

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedMember = members.find(
    (m) => m.id === activeSelectedId || m.memberNumber === activeSelectedId
  );

  const filteredMembers = members.filter((m) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const name = (m.name || '').toLowerCase();
    const id = (m.memberNumber || m.id || '').toLowerCase();
    const chapter = (m.chapter || '').toLowerCase();
    const role = (m.role || '').toLowerCase();
    return (
      name.includes(term) ||
      id.includes(term) ||
      chapter.includes(term) ||
      role.includes(term)
    );
  });

  const getRoleBadge = (role?: string) => {
    const r = role || 'Member';
    const isPresident = r.toLowerCase().includes('pres');
    const isOfficer =
      isPresident ||
      ['vice', 'treas', 'secr', 'audit', 'officer', 'lead', 'marshal', 'sgt'].some((k) =>
        r.toLowerCase().includes(k)
      );

    if (isPresident) {
      return (
        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5">
          <Award className="w-2.5 h-2.5 text-amber-700" />
          <span>{r}</span>
        </span>
      );
    }
    if (isOfficer) {
      return (
        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-0.5">
          <Shield className="w-2.5 h-2.5 text-emerald-700" />
          <span>{r}</span>
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
        {r}
      </span>
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'BCC';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`space-y-1 relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[10.5px] font-extrabold text-[#1b4332] block">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2ece2] rounded-xl text-xs font-semibold text-stone-800 transition-all cursor-pointer shadow-2xs hover:border-[#b7d2b7] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-left ${
          disabled ? 'opacity-50 cursor-not-allowed bg-stone-50' : ''
        } ${isOpen ? 'ring-2 ring-emerald-500/30 border-[#2d6a4f]' : ''}`}
      >
        {selectedMember ? (
          <div className="flex items-center gap-2 min-w-0 truncate">
            {selectedMember.profileImage ? (
              <img
                src={selectedMember.profileImage}
                alt={selectedMember.name}
                className="w-6 h-6 rounded-full object-cover border border-[#b7d2b7] shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#1b4332] text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                {getInitials(selectedMember.name)}
              </div>
            )}
            <div className="min-w-0 truncate">
              <span className="font-extrabold text-stone-900 truncate">
                {selectedMember.name}
              </span>
              <span className="text-[10.5px] text-stone-500 ml-1.5 font-mono">
                #{selectedMember.memberNumber || selectedMember.id}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-stone-400">
            <User className="w-4 h-4 text-stone-400 shrink-0" />
            <span className="truncate">{placeholder}</span>
          </div>
        )}

        <ChevronDown
          className={`w-4 h-4 text-stone-400 transition-transform shrink-0 ${
            isOpen ? 'rotate-180 text-[#2d6a4f]' : ''
          }`}
        />
      </button>

      {/* Interactive Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 z-50 w-full bg-white border border-[#e2ece2] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-72"
          >
            {/* Search Input Bar */}
            <div className="p-2 border-b border-[#e2ece2] bg-[#f7f9f7] sticky top-0 z-10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search member name, ID, or chapter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#e2ece2] rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 placeholder:text-stone-400 font-medium"
                />
              </div>
            </div>

            {/* Member List */}
            <div className="overflow-y-auto flex-1 p-1 divide-y divide-stone-100">
              {filteredMembers.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400 font-medium">
                  {searchTerm ? `No members found matching "${searchTerm}".` : 'No members available to add.'}
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const isSelected =
                    m.id === activeSelectedId || m.memberNumber === activeSelectedId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleSelect(m.id);
                        setIsOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-[#d8f3dc] text-[#1b4332]'
                          : 'hover:bg-[#f7f9f7] text-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {m.profileImage ? (
                          <img
                            src={m.profileImage}
                            alt={m.name}
                            className="w-8 h-8 rounded-full object-cover border border-[#b7d2b7] shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#1b4332] text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                            {getInitials(m.name)}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-stone-900 truncate">
                              {m.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-[#2d6a4f] bg-[#e2ece2] px-1.5 py-0.2 rounded">
                              #{m.memberNumber || m.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5 flex-wrap">
                            {getRoleBadge(m.role)}
                            <span className="flex items-center gap-0.5 text-stone-400">
                              <MapPin className="w-2.5 h-2.5" />
                              <span className="truncate">{m.chapter || 'Main Chapter'}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#1b4332] text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
