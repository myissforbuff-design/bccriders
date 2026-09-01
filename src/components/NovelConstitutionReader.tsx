import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Sparkles,
  List,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Volume2,
  VolumeX,
  Share2,
  PenTool,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface BookPage {
  id: number;
  chapterTitle?: string;
  pageNumber: number;
  title: string;
  subtitle?: string;
  type: 'cover' | 'toc' | 'content' | 'back';
  content: React.ReactNode;
  scribbleNote?: {
    text: string;
    rotation?: string;
    position?: 'top-right' | 'bottom-right' | 'margin-left' | 'bottom-left';
    sketch?: 'helmet' | 'cross' | 'shield' | 'arrow' | 'star' | 'heart';
  };
}

export const NovelConstitutionReader: React.FC = () => {
  // Saved reading bookmark
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const saved = localStorage.getItem('bcc_novel_bookmark');
    return saved ? Math.max(0, parseInt(saved, 10)) : 0;
  });

  const [direction, setDirection] = useState<number>(0);
  const [showToc, setShowToc] = useState<boolean>(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'compact'>('normal');
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const bookContainerRef = useRef<HTMLDivElement>(null);

  // Audio effect: gentle paper rustle via Web Audio API
  const playPageTurnSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const bufferSize = ctx.sampleRate * 0.12; // 120ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pinkish noise curve with gentle envelope for paper rustle
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const pink = (lastOut + 0.02 * white) / 1.02;
        lastOut = pink;
        const envelope = Math.sin((i / bufferSize) * Math.PI);
        data[i] = pink * envelope * 0.18;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Filter to emulate soft parchment friction
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      noise.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context may be restricted before user gesture
    }
  };

  // 12 Well-Paced Novel Pages
  const pages: BookPage[] = useMemo(
    () => [
      // Page 0: Front Cover
      {
        id: 0,
        pageNumber: 0,
        type: 'cover',
        title: 'BCC RIDERS CLUB',
        subtitle: 'CONSTITUTION AND BY-LAWS',
        content: (
          <div className="flex flex-col items-center justify-between h-full py-4 text-center select-none">
            {/* Vintage Book Frame Border */}
            <div className="w-full h-full border-2 border-[#1b4332]/40 rounded-xl p-4 sm:p-8 flex flex-col items-center justify-between relative bg-gradient-to-b from-[#faf6eb] via-[#f7f2e4] to-[#f4ecd8] shadow-inner">
              {/* Corner Ornaments */}
              <div className="absolute top-2 left-2 text-[#1b4332]/40 text-xs select-none">❧</div>
              <div className="absolute top-2 right-2 text-[#1b4332]/40 text-xs select-none">❧</div>
              <div className="absolute bottom-2 left-2 text-[#1b4332]/40 text-xs select-none">❧</div>
              <div className="absolute bottom-2 right-2 text-[#1b4332]/40 text-xs select-none">❧</div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] sm:text-xs font-serif uppercase tracking-[0.25em] text-[#2d6a4f] font-bold block">
                  Official Code of Governance
                </span>
                <div className="w-16 h-[1.5px] bg-[#1b4332]/30 mx-auto" />
              </div>

              {/* Center Emblem */}
              <div className="space-y-4 my-auto py-4">
                <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto p-3 rounded-full bg-white/80 border-2 border-[#1b4332]/30 shadow-md flex items-center justify-center transform hover:scale-105 transition-transform">
                  <img src="/logo.png" alt="BCC Emblem" className="w-full h-full object-contain" />
                </div>

                <div className="space-y-1.5">
                  <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#1b4332] tracking-wider leading-tight">
                    CONSTITUTION <br />
                    <span className="text-xl sm:text-2xl font-normal italic font-serif">&amp;</span> <br />
                    BY-LAWS
                  </h1>
                  <p className="font-serif italic text-xs sm:text-sm text-[#2d6a4f] pt-1">
                    of the Bearers of Christ Cause
                  </p>
                </div>
              </div>

              <div className="space-y-2 pb-2 w-full">
                <div className="w-full border-t border-dashed border-[#1b4332]/25 pt-3">
                  <p className="font-serif text-[11px] sm:text-xs text-[#52605d]">
                    Buhangin Community Church • Davao City
                  </p>
                  <p className="font-serif text-[10px] text-[#52605d]/80 italic">
                    Palm Drive Ext., Km5 Buhangin, Davao City
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-[10px] text-[#2d6a4f] font-sans font-bold bg-[#1b4332]/10 px-3 py-1 rounded-full">
                  <span>Swipe or tap right to open book</span>
                  <ChevronRight className="w-3 h-3 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: '“Faithful & True”',
          position: 'top-right',
          rotation: 'rotate-3',
          sketch: 'cross',
        },
      },

      // Page 1: Table of Contents & Preamble
      {
        id: 1,
        pageNumber: 1,
        type: 'toc',
        title: 'Table of Articles',
        chapterTitle: 'Foreword & Index',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            <div className="border-b border-[#1b4332]/20 pb-2 text-center">
              <span className="text-[10px] uppercase font-sans tracking-widest text-[#2d6a4f] font-bold">
                Table of Contents
              </span>
              <h2 className="font-serif text-lg sm:text-xl font-black text-[#1b4332]">
                Structure of the Governance
              </h2>
            </div>

            <div className="space-y-2 text-[11px] sm:text-[13px] divide-y divide-[#1b4332]/10">
              {[
                { title: 'Article I – Name & Identity', page: 2 },
                { title: 'Article II – Purpose and Objectives', page: 2 },
                { title: 'Article III – Membership & Eligibility', page: 3 },
                { title: 'Article III – Admission & Termination', page: 4 },
                { title: 'Article IV – Officers of the Club', page: 5 },
                { title: 'Article IV – Duties & Elections', page: 6 },
                { title: 'Article V – Meetings & Quorum', page: 6 },
                { title: 'Article VI – Riding Rules & Safety', page: 7 },
                { title: 'Article VII – Club Funds & Dues', page: 7 },
                { title: 'Article VIII – Club Identity & Uniforms', page: 8 },
                { title: 'Article IX – Discipline & Counseling', page: 8 },
                { title: 'Article IX – Suspension & Removal', page: 9 },
                { title: 'Article X & XI – Amendments & Ratification', page: 10 },
                { title: 'Benediction & Signatures', page: 11 },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(item.page > currentPage ? 1 : -1);
                    setCurrentPage(item.page);
                    playPageTurnSound();
                  }}
                  className="w-full pt-1.5 flex items-center justify-between hover:text-[#1b4332] hover:font-bold transition-colors group cursor-pointer text-left"
                >
                  <span className="group-hover:translate-x-1 transition-transform">
                    {item.title}
                  </span>
                  <span className="font-mono text-[10px] text-[#2d6a4f] font-bold">
                    p. {item.page}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-[#f0f7f2] border border-[#d8ecd8] text-[11px] italic text-[#1b4332] leading-snug">
              “Riding in unity with Christ as our leader, representing faith on every road we traverse.”
            </div>
          </div>
        ),
        scribbleNote: {
          text: '11 Articles of Faith & Brotherhood',
          position: 'bottom-right',
          rotation: '-rotate-2',
          sketch: 'shield',
        },
      },

      // Page 2: Article I & II
      {
        id: 2,
        pageNumber: 2,
        type: 'content',
        chapterTitle: 'Articles I & II',
        title: 'Name and Objectives',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            {/* Article I */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article I – Name
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <p className="text-justify leading-relaxed indent-4">
                <span className="float-left text-3xl sm:text-4xl font-serif font-black text-[#1b4332] mr-2 leading-none">
                  T
                </span>
                he name of this organization shall be <strong>Bearers of Christ Cause</strong> to rescue the harassed and hopeless, <strong>INJECT</strong> God's words and presence, <strong>DISCIPLE</strong> them to do what we do, <strong>ENCOURAGE</strong> the troubled fellow, motivate and empower them, <strong>REJECT</strong> any demonic influences and attacks in a person's life, <strong>SHARE</strong> with them the true essence of Christianity Christ Leaders Unstoppable Brigade, hereinafter referred to as the <strong className="text-[#1b4332]">BCC Riders Club</strong>.
              </p>
            </div>

            {/* Article II */}
            <div className="space-y-2 pt-2 border-t border-[#1b4332]/15">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article II – Purpose &amp; Objectives
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <p className="italic text-[11px] text-[#52605d]">
                The Club is established for the following sacred and civic purposes:
              </p>
              <ol className="list-decimal list-outside pl-5 space-y-1.5 text-justify text-[11.5px] sm:text-xs">
                <li>To promote safe, disciplined, and responsible motorcycle riding across all public highways and trails.</li>
                <li>To build steadfast camaraderie, friendship, and genuine Christian brotherhood/sisterhood among riders.</li>
                <li>To organize group rides, touring activities, and motorcycle events for charity, satellite churches visitation, impartation, coaching, and spiritual training.</li>
                <li>To actively promote road safety awareness within the broader community and motorists.</li>
                <li>To represent Jesus Christ in places of His divine appointment and calling.</li>
              </ol>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'Mission: Rescue • Inject • Disciple • Encourage',
          position: 'top-right',
          rotation: 'rotate-2',
          sketch: 'helmet',
        },
      },

      // Page 3: Article III - Membership (Part 1)
      {
        id: 3,
        pageNumber: 3,
        type: 'content',
        chapterTitle: 'Article III',
        title: 'Membership & Eligibility',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                Article III – Membership
              </span>
              <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
            </div>

            {/* Section 1 */}
            <div className="space-y-1.5">
              <h3 className="font-serif font-bold text-[#2d6a4f] text-xs sm:text-sm">
                Section 1 – Eligibility
              </h3>
              <p className="text-[11.5px] sm:text-xs text-[#52605d]">
                Membership in the Club shall be open to individuals who meet the following standards:
              </p>
              <ul className="list-disc list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>Are eighteen (18) years of age or older.</li>
                <li>Hold an updated, valid driver's license and official vehicle registration (OR/CR).</li>
                <li>Own or regularly operate a motorcycle in roadworthy condition.</li>
                <li>Agree without reservation to abide by the constitution, by-laws, and club rules.</li>
                <li>Demonstrate personal respect, moral discipline, and road responsibility.</li>
                <li>Are an active leader or member of a life group or house church.</li>
                <li>May ride customized motorcycles, provided they do not violate official LTO rules.</li>
              </ul>
            </div>

            {/* Section 2 */}
            <div className="space-y-1.5 pt-2 border-t border-[#1b4332]/15">
              <h3 className="font-serif font-bold text-[#2d6a4f] text-xs sm:text-sm">
                Section 2 – Types of Membership
              </h3>
              <div className="space-y-1.5 text-[11px] sm:text-xs">
                <p>
                  <strong>1. Full Member:</strong> Enjoys full rights, including voting in elections, participating in official tours, and holding elective office.
                </p>
                <p>
                  <strong>2. Associate Member:</strong> Non-riding supporters or individuals without motorcycles, with limited voting privileges.
                </p>
                <p>
                  <strong>3. Probationary Member:</strong> A newly admitted candidate undergoing an evaluation period of three to six (3–6) months.
                </p>
                <p>
                  <strong>4. Honorary Member:</strong> Distinguished individuals recognized for outstanding service or contributions to the club.
                </p>
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'Active in Life Group is required!',
          position: 'bottom-right',
          rotation: '-rotate-3',
          sketch: 'star',
        },
      },

      // Page 4: Article III - Membership (Part 2)
      {
        id: 4,
        pageNumber: 4,
        type: 'content',
        chapterTitle: 'Article III (Cont.)',
        title: 'Admission & Termination',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            {/* Section 3 */}
            <div className="space-y-2">
              <h3 className="font-serif font-bold text-[#2d6a4f] text-xs sm:text-sm">
                Section 3 – Admission Procedure
              </h3>
              <p className="text-justify text-[11.5px] sm:text-xs">
                A candidate may attain membership by completing the following governance steps:
              </p>
              <ol className="list-decimal list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>Submitting a formal membership application with true credentials.</li>
                <li>Being endorsed and recommended by an existing active member, cell leader, or network pastor.</li>
                <li>Undergoing evaluation and receiving approval by designated Club Officers or majority vote.</li>
              </ol>
            </div>

            {/* Section 4 */}
            <div className="space-y-2 pt-3 border-t border-[#1b4332]/15">
              <h3 className="font-serif font-bold text-rose-800 text-xs sm:text-sm">
                Section 4 – Termination of Membership
              </h3>
              <p className="text-justify text-[11.5px] sm:text-xs">
                Membership may be revoked or terminated on any of the following grounds:
              </p>
              <ul className="list-disc list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>Willful violation of club rules and constitution.</li>
                <li>Reckless or unsafe riding endangering self and others.</li>
                <li>Gross disrespect toward fellow brothers and sisters in the faith.</li>
                <li>Engagement in illegal activities while representing the club insignia.</li>
                <li>Protracted non-payment of monthly dues without valid cause.</li>
                <li>Failure to observe the formal protocols and counseling of suspension.</li>
              </ul>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[10.5px] text-rose-900 italic mt-2">
                * Note: Final termination requires majority approval of the official executive officers or members assembly.
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'Respect & Discipline at all times',
          position: 'top-right',
          rotation: 'rotate-1',
          sketch: 'arrow',
        },
      },

      // Page 5: Article IV - Officers & Duties
      {
        id: 5,
        pageNumber: 5,
        type: 'content',
        chapterTitle: 'Article IV',
        title: 'Officers of the Club',
        content: (
          <div className="space-y-3 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                Article IV – Officers
              </span>
              <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
            </div>

            <div className="space-y-1">
              <h3 className="font-serif font-bold text-[#2d6a4f] text-xs sm:text-sm">
                Section 1 – Executive Council
              </h3>
              <p className="text-[11px] text-[#52605d]">
                The leadership council shall consist of the following trusted servants:
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-[#1b4332]">
                President • Vice President • Secretary • Treasurer • Road Captain • Safety Officer • Sergeant-at-Arms • Members Representative
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#1b4332]/15">
              <h3 className="font-serif font-bold text-[#2d6a4f] text-xs sm:text-sm">
                Section 2 – Duties and Responsibilities
              </h3>
              <div className="space-y-1.5 text-[10.5px] sm:text-[11.5px] text-justify">
                <p>
                  <strong>President:</strong> Leads the ministry and presides over official assemblies. Represents the club in external relations and oversees all activities.
                </p>
                <p>
                  <strong>Vice President:</strong> Assists the President in administrative matters and assumes presidential duties during the President's absence.
                </p>
                <p>
                  <strong>Secretary:</strong> Keeps accurate minutes, handles correspondence, and maintains updated membership rosters and records.
                </p>
                <p>
                  <strong>Treasurer:</strong> Manages treasury funds, collects membership dues, and prepares transparent periodic financial statements.
                </p>
                <p>
                  <strong>Road Captain:</strong> Plans touring itineraries, commands ride formations, and enforces road convoy discipline.
                </p>
                <p>
                  <strong>Safety Officer:</strong> Conducts pre-ride inspections, safety briefings, and promotes emergency readiness.
                </p>
                <p>
                  <strong>Sergeant-at-Arms:</strong> Maintains order during gatherings and ensures compliance with club ethics.
                </p>
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'Servant leadership in Christ',
          position: 'bottom-right',
          rotation: '-rotate-2',
          sketch: 'cross',
        },
      },

      // Page 6: Article IV (Part 2) & Article V - Meetings
      {
        id: 6,
        pageNumber: 6,
        type: 'content',
        chapterTitle: 'Articles IV & V',
        title: 'Elections & Meetings',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            {/* Article IV Sections 3 & 4 */}
            <div className="space-y-2">
              <h3 className="font-serif font-bold text-[#2d6a4f] text-xs sm:text-sm">
                Article IV – Term &amp; Elections
              </h3>
              <div className="space-y-1 text-[11px] sm:text-xs text-justify">
                <p>
                  <strong>Section 3 – Term of Office:</strong> Officers shall serve a term of three (3) years and may be eligible for re-election based on performance and spiritual maturity.
                </p>
                <p>
                  <strong>Section 4 – Election Procedure:</strong> Elections occur triennially via secret ballot or majority consensus of active riding members in good standing.
                </p>
              </div>
            </div>

            {/* Article V */}
            <div className="space-y-2 pt-3 border-t border-[#1b4332]/15">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article V – Meetings &amp; Quorum
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-1.5 text-[11px] sm:text-xs text-justify">
                <li>Regular assemblies shall be held monthly or as scheduled by the executive leadership.</li>
                <li>Special or emergency meetings may be convoked by the President or a majority of officers.</li>
                <li>A legal quorum shall consist of fifty percent (50%) of active members.</li>
                <li>Absence from a scheduled regular meeting must be officially filed at least three (3) days in advance through any verified communication channel.</li>
                <li>A short notice of one (1) day is excused exclusively in cases of proven medical or personal emergency.</li>
              </ol>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'Notice of absence: 3 days in advance',
          position: 'top-right',
          rotation: 'rotate-2',
          sketch: 'star',
        },
      },

      // Page 7: Article VI - Riding Rules & Article VII - Club Funds
      {
        id: 7,
        pageNumber: 7,
        type: 'content',
        chapterTitle: 'Articles VI & VII',
        title: 'Road Safety & Treasury',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            {/* Article VI */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article VI – Riding Rules
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <p className="text-[11px] text-[#52605d]">All riders must strictly comply with:</p>
              <ol className="list-decimal list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>Observing all national traffic laws and highway speed regulations.</li>
                <li>Wearing standard protective riding gear (DOT/ECE helmet, riding jacket, gloves, and closed shoes).</li>
                <li>Adhering strictly to hand signals and directions from the Road Captain during group rides.</li>
                <li>Avoiding reckless maneuvers, lane splitting at high velocity, or exhibitionist stunts.</li>
                <li>Showing respect and courtesy to fellow riders, pedestrians, and public motorists.</li>
              </ol>
            </div>

            {/* Article VII */}
            <div className="space-y-2 pt-3 border-t border-[#1b4332]/15">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article VII – Club Funds
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>Monthly membership dues are set at One Hundred Pesos (₱100.00).</li>
                <li>
                  Funds are allocated for ministry tours, charity outreach, club merchandise, and administrative essentials.
                </li>
                <li>All disbursements shall be audited and logged by the Treasurer.</li>
                <li>Monies must be deposited into recognized banking or cooperative accounts.</li>
                <li>
                  <strong>Three-Signatory Rule:</strong> Withdrawals require the explicit knowledge and signatures of the President, Treasurer, and elected Members Representative.
                </li>
              </ol>
            </div>
          </div>
        ),
        scribbleNote: {
          text: '₱100/month dues • Full PPE gear mandatory',
          position: 'bottom-right',
          rotation: '-rotate-2',
          sketch: 'shield',
        },
      },

      // Page 8: Article VIII - Identity & Article IX - Discipline (Part 1)
      {
        id: 8,
        pageNumber: 8,
        type: 'content',
        chapterTitle: 'Articles VIII & IX',
        title: 'Identity & Discipline',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            {/* Article VIII */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article VIII – Club Identity
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <ol className="list-decimal list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>The official insignia embodies the Full Armor of God (Ephesians 6).</li>
                <li>Club colors and official jerseys must be worn with dignity and Christian modesty.</li>
                <li>Unauthorized commercial reproduction of the logo is prohibited.</li>
                <li>
                  <strong>Lending Prohibition:</strong> Any rider caught lending their uniform/vest to non-members shall face disciplinary sanctions after due investigation.
                </li>
              </ol>
            </div>

            {/* Article IX */}
            <div className="space-y-2 pt-3 border-t border-[#1b4332]/15">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article IX – Discipline &amp; Restoration
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <p className="text-[11px] text-[#52605d]">
                Disciplinary actions are instituted for conduct harmful to the testimony of Christ:
              </p>
              <ul className="list-disc list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>Disrespectful conduct or divisive speech.</li>
                <li>Reckless and endangering riding.</li>
                <li>Damage to the club's Christian reputation in the public eye.</li>
                <li>Engagement in vices such as smoking, drinking liquor, or gambling.</li>
              </ul>
              <div className="p-2 bg-[#f0f7f2] border border-[#74c69d] rounded-lg text-[11px] mt-1">
                <strong>First Action – Warning &amp; Counseling:</strong> The rider enters restorative counseling with their mentor until permitted to resume active duties.
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'No lending uniforms to non-members!',
          position: 'top-right',
          rotation: 'rotate-3',
          sketch: 'arrow',
        },
      },

      // Page 9: Article IX - Suspension & Removal
      {
        id: 9,
        pageNumber: 9,
        type: 'content',
        chapterTitle: 'Article IX (Cont.)',
        title: 'Suspension & Removal',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            <div className="space-y-3">
              <h3 className="font-serif font-bold text-amber-900 text-xs sm:text-sm">
                • Suspension Protocols
              </h3>
              <ul className="list-disc list-outside pl-5 space-y-1.5 text-[11px] sm:text-xs text-justify">
                <li>
                  Upon receiving three (3) successive unheeded warnings, the member shall be suspended for a period of one (1) year.
                </li>
                <li>
                  <strong>Surrender of Insignia:</strong> Official patches, uniforms, and insignias—though personally acquired—must be surrendered to the officer-in-charge during suspension to prevent unauthorized use.
                </li>
                <li>
                  The suspended member is required to attend and faithfully commit to a designated life group, cell group, 5 AM corporate prayer, or deliverance ministry.
                </li>
                <li>
                  Reinstatement is contingent upon mentor recommendation and senior pastor approval.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-3 border-t border-[#1b4332]/15">
              <h3 className="font-serif font-bold text-rose-900 text-xs sm:text-sm">
                • Removal from Membership
              </h3>
              <p className="text-[11px] text-[#52605d]">
                Permanent severance of membership occurs when:
              </p>
              <ul className="list-disc list-outside pl-5 space-y-1.5 text-[11px] sm:text-xs text-justify">
                <li>A suspended member exhibits no evidence of repentance or spiritual renewal.</li>
                <li>Frequent unexcused absences persist from life group, house church, or corporate fellowship despite counseling.</li>
                <li>Total disengagement and unnotified absence from club assemblies occurs over an extended period.</li>
              </ul>
            </div>
          </div>
        ),
        scribbleNote: {
          text: 'Restoration & Life Group commitment',
          position: 'bottom-right',
          rotation: '-rotate-2',
          sketch: 'cross',
        },
      },

      // Page 10: Article X & XI - Amendments & Ratification
      {
        id: 10,
        pageNumber: 10,
        type: 'content',
        chapterTitle: 'Articles X & XI',
        title: 'Amendments & Ratification',
        content: (
          <div className="space-y-4 font-serif text-[#2d3a3a] leading-relaxed text-xs sm:text-sm">
            {/* Article X */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article X – Amendments
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <p className="text-justify text-[11.5px] sm:text-xs">
                This Constitution and By-Laws may be modified or amended by:
              </p>
              <ul className="list-disc list-outside pl-5 space-y-1 text-[11px] sm:text-xs text-justify">
                <li>A two-thirds (2/3) supermajority vote of active voting members in good standing; and</li>
                <li>Formal written notice of proposed amendments presented at a prior regular assembly.</li>
              </ul>
            </div>

            {/* Article XI */}
            <div className="space-y-2 pt-3 border-t border-[#1b4332]/15">
              <div className="flex items-center gap-2">
                <span className="font-serif font-black text-sm sm:text-base text-[#1b4332] uppercase tracking-wide">
                  Article XI – Ratification
                </span>
                <div className="h-[1px] flex-1 bg-[#1b4332]/20" />
              </div>
              <p className="text-justify text-[11.5px] sm:text-xs leading-relaxed font-semibold text-[#1b4332] indent-4">
                This Constitution and By-Laws shall take full effect immediately upon formal ratification and approval by the majority of the founding council members of the BCC Riders Club.
              </p>
            </div>

            {/* Seal Box */}
            <div className="mt-4 p-3 rounded-xl border border-dashed border-[#2d6a4f]/40 bg-[#f7fbf8] flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-[#2d6a4f] shrink-0" />
              <div>
                <span className="text-[11px] font-sans font-bold text-[#1b4332] block">
                  Official Club Seal of Governance
                </span>
                <p className="text-[10px] text-[#52605d]">
                  Promulgated under Buhangin Community Church • Davao City, Philippines
                </p>
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: '2/3 Supermajority vote required',
          position: 'top-right',
          rotation: 'rotate-2',
          sketch: 'shield',
        },
      },

      // Page 11: Back Cover & Scripture Benediction
      {
        id: 11,
        pageNumber: 11,
        type: 'back',
        title: 'Benediction & Epilogue',
        chapterTitle: 'Epilogue',
        content: (
          <div className="flex flex-col items-center justify-between h-full py-4 text-center select-none font-serif">
            <div className="w-full h-full border-2 border-[#1b4332]/40 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-between relative bg-gradient-to-b from-[#f7f2e4] via-[#faf6eb] to-[#f4ecd8] shadow-inner">
              <div className="space-y-1 pt-2">
                <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#2d6a4f] font-bold">
                  BCC Riders Motto &amp; Scripture
                </span>
                <div className="w-12 h-[1px] bg-[#1b4332]/30 mx-auto" />
              </div>

              <div className="my-auto space-y-4 max-w-sm px-2">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/90 p-2 shadow-xs border border-[#1b4332]/20 flex items-center justify-center">
                  <img src="/bcc-logo.png" alt="BCC" className="w-full h-full object-contain" />
                </div>

                <blockquote className="italic text-xs sm:text-sm text-[#1b4332] leading-relaxed">
                  “Then I saw heaven opened, and suddenly a white horse appeared. The name of the one riding it was Faithful and True, and with pure righteousness he judges and rides to battle.”
                </blockquote>
                <p className="text-[11px] font-sans font-extrabold text-[#2d6a4f] uppercase tracking-wider">
                  — Revelation 19:11 (TPT)
                </p>
              </div>

              <div className="space-y-2 pb-2 w-full">
                <div className="w-full border-t border-dashed border-[#1b4332]/25 pt-2">
                  <p className="text-[10px] sm:text-[11px] text-[#52605d]">
                    Bearers of Christ Cause • Unstoppable Brigade
                  </p>
                  <p className="text-[9px] text-[#52605d]/70">
                    Davao City, Philippines • Year of the Lord 2026
                  </p>
                </div>
              </div>
            </div>
          </div>
        ),
        scribbleNote: {
          text: '“Riding for the Glory of God”',
          position: 'bottom-right',
          rotation: '-rotate-3',
          sketch: 'heart',
        },
      },
    ],
    [currentPage]
  );

  const totalPages = pages.length;

  // Save bookmark to localStorage
  useEffect(() => {
    localStorage.setItem('bcc_novel_bookmark', currentPage.toString());
    const saved = localStorage.getItem('bcc_novel_bookmark');
    setIsBookmarked(saved === currentPage.toString());
  }, [currentPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setDirection(1);
      setCurrentPage((prev) => prev + 1);
      playPageTurnSound();
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage((prev) => prev - 1);
      playPageTurnSound();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

  // Touch Swipe Handlers for mobile & tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStartX;
    setSwipeOffset(diffX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartX;
    const diffY = endY - touchStartY;

    // Determine if horizontal swipe is dominant (minimum 40px delta)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        // Swiped Left -> Turn forward (next page)
        handleNextPage();
      } else {
        // Swiped Right -> Turn backward (previous page)
        handlePrevPage();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setSwipeOffset(0);
  };

  const activePageData = pages[currentPage] || pages[0];

  return (
    <div className="w-full flex flex-col items-center space-y-4 max-w-4xl mx-auto select-none">
      {/* Novel Toolbar & Reading Controls */}
      <div className="w-full bg-white/90 backdrop-blur-md border border-[#e2ece2] rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Table of Contents & Chapter Indicator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowToc(!showToc)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
              showToc
                ? 'bg-[#1b4332] text-white border-[#1b4332]'
                : 'bg-[#f7f9f7] text-[#1b4332] border-[#e2ece2] hover:bg-[#e2ece2]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Contents</span>
          </button>

          <span className="text-[11px] font-serif font-bold text-[#2d6a4f] truncate max-w-[150px] sm:max-w-[220px]">
            {activePageData.chapterTitle || activePageData.title}
          </span>
        </div>

        {/* Center: Reading Progress & Page Indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-[#1b4332] bg-[#f7f9f7] px-2.5 py-1 rounded-lg border border-[#e2ece2]">
            <span>{currentPage === 0 ? 'Cover' : `p. ${currentPage}`}</span>
            <span className="text-[#52605d] font-normal">/ {totalPages - 1}</span>
          </div>

          <div className="hidden md:block w-24 bg-[#e2ece2] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#2d6a4f] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentPage / (totalPages - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Right: Sound, Font Size & Bookmark */}
        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <button
            type="button"
            title={soundEnabled ? 'Mute page rustle sound' : 'Enable page rustle sound'}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#2d6a4f] transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
          </button>

          {/* Font Size Toggle */}
          <div className="flex items-center bg-[#f7f9f7] rounded-lg border border-[#e2ece2] p-0.5">
            <button
              type="button"
              onClick={() => setFontSizeLevel('compact')}
              title="Compact Font"
              className={`px-1.5 py-0.5 rounded text-[10px] font-serif font-bold ${
                fontSizeLevel === 'compact' ? 'bg-[#1b4332] text-white' : 'text-[#52605d]'
              }`}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSizeLevel('normal')}
              title="Standard Font"
              className={`px-1.5 py-0.5 rounded text-[10px] font-serif font-bold ${
                fontSizeLevel === 'normal' ? 'bg-[#1b4332] text-white' : 'text-[#52605d]'
              }`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSizeLevel('large')}
              title="Large Font"
              className={`px-1.5 py-0.5 rounded text-[10px] font-serif font-bold ${
                fontSizeLevel === 'large' ? 'bg-[#1b4332] text-white' : 'text-[#52605d]'
              }`}
            >
              A+
            </button>
          </div>

          {/* Quick Bookmark Reset */}
          <button
            type="button"
            onClick={() => {
              setCurrentPage(0);
              playPageTurnSound();
            }}
            title="Return to Cover"
            className="p-1.5 rounded-lg bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#2d6a4f] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table of Contents Overlay Dropdown */}
      <AnimatePresence>
        {showToc && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full bg-[#faf7ef] border-2 border-[#1b4332]/30 rounded-2xl p-4 sm:p-5 shadow-xl font-serif text-[#1b4332] z-30"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1b4332]/20 mb-3">
              <span className="font-heading font-black text-sm uppercase tracking-wider">
                Table of Contents &amp; Quick Jump
              </span>
              <button
                type="button"
                onClick={() => setShowToc(false)}
                className="text-xs font-sans font-bold text-[#52605d] hover:text-[#1b4332] cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {pages.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentPage ? 1 : -1);
                    setCurrentPage(idx);
                    setShowToc(false);
                    playPageTurnSound();
                  }}
                  className={`p-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                    currentPage === idx
                      ? 'bg-[#1b4332] text-white font-bold shadow-xs'
                      : 'bg-white/70 hover:bg-white text-[#2d3a3a] border border-[#e2ece2]'
                  }`}
                >
                  <span className="truncate">
                    {idx === 0 ? 'Cover Page' : `${p.pageNumber}. ${p.chapterTitle || p.title}`}
                  </span>
                  <span className="font-mono text-[10px] opacity-75 shrink-0 ml-2">
                    {idx === 0 ? 'Cover' : `p.${idx}`}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Novel Book Stage / Viewport */}
      <div className="relative w-full flex items-center justify-center px-0 sm:px-4 py-2">
        {/* Previous Page Desktop Margin Button */}
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage === 0}
          title="Previous Page (Swipe Right or Left Arrow)"
          className="hidden md:flex absolute left-0 z-20 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-[#1b4332] border border-[#d8ecd8] shadow-md items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-6 h-6 text-[#2d6a4f]" />
        </button>

        {/* Next Page Desktop Margin Button */}
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage === totalPages - 1}
          title="Next Page (Swipe Left or Right Arrow)"
          className="hidden md:flex absolute right-0 z-20 w-11 h-11 rounded-full bg-white/95 hover:bg-white text-[#1b4332] border border-[#d8ecd8] shadow-md items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="w-6 h-6 text-[#2d6a4f]" />
        </button>

        {/* Physical Novel Book Container Frame */}
        <div
          ref={bookContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-full max-w-[620px] aspect-[1/1.42] min-h-[580px] sm:min-h-[660px] md:min-h-[720px] rounded-2xl shadow-2xl p-2 sm:p-4 bg-[#e8dfc8] border-4 border-[#2b2416]/60 flex flex-col justify-between overflow-hidden transition-transform touch-pan-y"
          style={{
            perspective: 1200,
            boxShadow: '0 25px 50px -12px rgba(27, 67, 50, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.4), inset 0 -4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Authentic Book Spine Shadow & Texture */}
          <div className="absolute top-0 bottom-0 left-0 w-6 sm:w-8 bg-gradient-to-r from-black/25 via-black/10 to-transparent pointer-events-none z-20 rounded-l-xl" />
          <div className="absolute top-0 bottom-0 right-0 w-3 bg-gradient-to-l from-black/15 to-transparent pointer-events-none z-20 rounded-r-xl" />

          {/* Book Ribbon Bookmark */}
          <div
            className="absolute top-0 right-8 z-30 w-5 sm:w-6 h-12 sm:h-16 bg-[#b02a37] shadow-md transition-transform duration-300"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
            }}
            title="Satin Bookmark Ribbon"
          />

          {/* Animated Turning Page Canvas */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentPage}
              custom={direction}
              initial={{
                opacity: 0,
                rotateY: direction > 0 ? 35 : -35,
                x: direction > 0 ? 40 : -40,
              }}
              animate={{
                opacity: 1,
                rotateY: 0,
                x: 0,
              }}
              exit={{
                opacity: 0,
                rotateY: direction > 0 ? -35 : 35,
                x: direction > 0 ? -40 : 40,
              }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative w-full h-full flex flex-col justify-between bg-[#fbf8ee] rounded-xl p-4 sm:p-7 md:p-8 shadow-md border border-[#dfd5be] overflow-y-auto text-[#2d3a3a]"
              style={{
                backgroundImage: `radial-gradient(#1b433206 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
                fontSize:
                  fontSizeLevel === 'compact'
                    ? '0.82rem'
                    : fontSizeLevel === 'large'
                    ? '1.05rem'
                    : '0.92rem',
              }}
            >
              {/* Page Header (Running Head) */}
              {activePageData.type !== 'cover' && (
                <div className="pb-2 border-b border-[#1b4332]/15 flex items-center justify-between text-[9px] sm:text-[10.5px] font-serif uppercase tracking-widest text-[#52605d]/80 select-none">
                  <span>BCC Constitution &amp; By-Laws</span>
                  <span className="text-[#2d6a4f] font-bold">
                    {activePageData.chapterTitle || 'Bearers of Christ Cause'}
                  </span>
                </div>
              )}

              {/* Scribble / Handwritten Annotation Stamp */}
              {activePageData.scribbleNote && (
                <div
                  className={`absolute z-10 pointer-events-none select-none max-w-[140px] sm:max-w-[170px] ${
                    activePageData.scribbleNote.position === 'top-right'
                      ? 'top-8 right-5'
                      : activePageData.scribbleNote.position === 'bottom-right'
                      ? 'bottom-10 right-5'
                      : activePageData.scribbleNote.position === 'bottom-left'
                      ? 'bottom-10 left-5'
                      : 'top-20 left-4'
                  } ${activePageData.scribbleNote.rotation || 'rotate-2'}`}
                >
                  <div className="relative p-2 rounded-lg bg-[#fffbe6]/90 border border-[#e6d875] text-[#7a5c10] shadow-sm transform rotate-[-2deg]">
                    <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-serif italic font-bold">
                      <PenTool className="w-3 h-3 text-[#b38600] shrink-0" />
                      <span>{activePageData.scribbleNote.text}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Page Content Body */}
              <div className="my-auto py-2 relative z-0">
                {activePageData.content}
              </div>

              {/* Page Footer */}
              {activePageData.type !== 'cover' && (
                <div className="pt-2 border-t border-[#1b4332]/15 flex items-center justify-between text-[10px] sm:text-xs font-serif text-[#52605d] select-none">
                  <span className="italic text-[9.5px]">Official Member Edition</span>
                  <span className="font-mono font-bold text-[#1b4332]">
                    — {currentPage} —
                  </span>
                  <span className="italic text-[9.5px]">BCC Riders Club</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Swipe Navigation Controls Bar */}
      <div className="w-full flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage === 0}
          className="flex-1 py-3 px-4 rounded-xl bg-white border border-[#e2ece2] text-[#1b4332] font-heading font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4 text-[#2d6a4f]" />
          <span>Previous Page</span>
        </button>

        <div className="text-center px-2">
          <span className="text-[10px] text-[#52605d] font-sans font-bold block uppercase tracking-wider">
            Swipe left / right
          </span>
          <span className="text-[9px] text-[#2d6a4f] italic">to turn pages</span>
        </div>

        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage === totalPages - 1}
          className="flex-1 py-3 px-4 rounded-xl bg-[#1b4332] text-white font-heading font-extrabold text-xs flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none hover:bg-[#2d6a4f]"
        >
          <span>Next Page</span>
          <ChevronRight className="w-4 h-4 text-[#74c69d]" />
        </button>
      </div>
    </div>
  );
};
