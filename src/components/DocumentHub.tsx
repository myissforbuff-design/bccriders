import React, { useState } from 'react';
import { User } from '../types';
import { MembershipAgreementPaper } from './MembershipAgreementPaper';
import { NovelConstitutionReader } from './NovelConstitutionReader';
import { FileText, BookOpen, Printer, Download, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface DocumentHubProps {
  user: User;
  exportPdfTrigger?: number;
  printTrigger?: number;
  initialSubTab?: 'agreement' | 'constitution';
}

export const DocumentHub: React.FC<DocumentHubProps> = ({
  user,
  exportPdfTrigger,
  printTrigger,
  initialSubTab = 'agreement',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'agreement' | 'constitution'>(initialSubTab);

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* Sub-Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/85 backdrop-blur-md p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
        {/* Sub-Tabs */}
        <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-[#f0f4f0] rounded-lg sm:rounded-xl border border-[#e2ece2] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('agreement')}
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-heading text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'agreement'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />
            <span className="truncate">Agreement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('constitution')}
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-heading text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'constitution'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#74c69d] shrink-0" />
            <span className="truncate">Cons &amp; by Laws</span>
          </button>
        </div>

        {/* Informative Sub-Title / Status Badge */}
        <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-center sm:justify-end text-[10px] sm:text-[11px] font-medium text-[#52605d]">
          {activeSubTab === 'agreement' ? (
            <span className="bg-[#f7f9f7] text-[#2d6a4f] px-2.5 py-1 rounded-lg sm:rounded-xl border border-[#e2ece2] font-bold flex items-center gap-1.5 w-full sm:w-auto justify-center">
              <span>Signed Record:</span>
              <span className="font-mono text-[#1b4332]">{user.memberNumber || 'BRC-0000'}</span>
            </span>
          ) : (
            <span className="bg-[#fffbe6] text-[#7a5c10] px-2.5 py-1 rounded-lg sm:rounded-xl border border-[#e6d875] font-bold flex items-center gap-1.5 w-full sm:w-auto justify-center">
              <Sparkles className="w-3 h-3 text-[#b38600] shrink-0" />
              <span>Novel Reader Mode (Swipe Left/Right)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Sub-Tab Views */}
      <div className="w-full">
        {activeSubTab === 'agreement' ? (
          <motion.div
            key="agreement"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <MembershipAgreementPaper
              user={user}
              exportPdfTrigger={exportPdfTrigger}
              printTrigger={printTrigger}
            />
          </motion.div>
        ) : (
          <motion.div
            key="constitution"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <NovelConstitutionReader />
          </motion.div>
        )}
      </div>
    </div>
  );
};
