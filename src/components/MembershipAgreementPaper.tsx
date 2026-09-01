import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ShieldCheck, FileCheck2, Printer, Download, Loader2, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { store } from '../lib/db';

interface MembershipAgreementPaperProps {
  user: User;
  exportPdfTrigger?: number;
  printTrigger?: number;
}

export const MembershipAgreementPaper: React.FC<MembershipAgreementPaperProps> = ({
  user,
  exportPdfTrigger,
  printTrigger,
}) => {
  const [signaturePng, setSignaturePng] = useState<string>('');
  const [presidentSignaturePng, setPresidentSignaturePng] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  useModalDismiss(showExportModal, () => setShowExportModal(false));
  const paperRef = useRef<HTMLDivElement | null>(null);

  // Retrieve user tagged as President from store
  const president = useMemo(() => {
    if (user.role === 'President' || user.role?.toLowerCase() === 'president') {
      return user;
    }
    const allUsers = store.getUsers();
    return (
      allUsers.find(
        (u) =>
          u.role === 'President' ||
          u.role?.toLowerCase() === 'president'
      ) || null
    );
  }, [user]);

  const presidentDisplayName = useMemo(() => {
    if (!president) return '';
    return (president.name || '').toUpperCase();
  }, [president]);

  useEffect(() => {
    if (exportPdfTrigger && exportPdfTrigger > 0) {
      setShowExportModal(true);
    }
  }, [exportPdfTrigger]);

  const handleOpenPrintWindow = () => {
    if (!paperRef.current) return;

    const stylesHtml = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank', 'width=950,height=1000');
    if (!printWindow) {
      // Fallback if popups are blocked
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BCC Membership Agreement - ${user.memberNumber || 'BRC-0000'}</title>
          ${stylesHtml}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            html, body {
              background-color: #ffffff !important;
              color: #1a231e !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
          </style>
        </head>
        <body class="bg-white">
          <div class="print-wrapper">
            ${paperRef.current.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 400);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (printTrigger && printTrigger > 0) {
      handleOpenPrintWindow();
    }
  }, [printTrigger]);

  // Derive Last Name, First Name format
  const getFormattedName = () => {
    if (user.lastName && user.firstName) {
      return `${user.lastName.toUpperCase()}, ${user.firstName.toUpperCase()}`;
    }
    if (user.name) {
      const parts = user.name.trim().split(' ');
      if (parts.length > 1) {
        const lastName = parts[parts.length - 1];
        const firstName = parts.slice(0, -1).join(' ');
        return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}`;
      }
      return user.name.toUpperCase();
    }
    return 'MEMBER NAME';
  };

  // Derive date submitted
  const getSubmittedDate = () => {
    if (user.declarationDate) return user.declarationDate;
    if (user.joinDate) return user.joinDate;
    return new Date().toISOString().split('T')[0];
  };

  // Generate black ink cursive signatures if raw image canvas is missing
  useEffect(() => {
    // 1. Applicant Signature
    let applicantSig = '';
    if (user.applicantSignature && user.applicantSignature.startsWith('data:image')) {
      applicantSig = user.applicantSignature;
    } else {
      // Create black ink PNG signature from name
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'italic 38px "Dancing Script", "Brush Script MT", "Caveat", cursive';
        ctx.fillStyle = '#000000'; // Pure black ink
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Render stylized signature text
        const sigName = user.name || 'Applicant Signature';
        ctx.fillText(sigName, 200, 60);

        // Add subtle handwritten flourish line
        ctx.beginPath();
        ctx.moveTo(80, 85);
        ctx.bezierCurveTo(150, 100, 250, 75, 320, 90);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        applicantSig = canvas.toDataURL('image/png');
      }
    }
    setSignaturePng(applicantSig);

    // 2. President Signature
    if (!president) {
      setPresidentSignaturePng('');
    } else if (president.applicantSignature && president.applicantSignature.trim()) {
      setPresidentSignaturePng(president.applicantSignature);
    } else if (president.name) {
      const presCanvas = document.createElement('canvas');
      presCanvas.width = 400;
      presCanvas.height = 120;
      const presCtx = presCanvas.getContext('2d');
      if (presCtx) {
        presCtx.clearRect(0, 0, presCanvas.width, presCanvas.height);
        presCtx.font = 'italic 38px "Dancing Script", "Brush Script MT", "Great Vibes", cursive';
        presCtx.fillStyle = '#000000'; // Pure black ink
        presCtx.textAlign = 'center';
        presCtx.textBaseline = 'middle';
        presCtx.fillText(presidentDisplayName, 200, 55);

        // President flourish stroke
        presCtx.beginPath();
        presCtx.moveTo(60, 80);
        presCtx.bezierCurveTo(160, 105, 260, 70, 340, 85);
        presCtx.strokeStyle = '#000000';
        presCtx.lineWidth = 2.5;
        presCtx.stroke();

        setPresidentSignaturePng(presCanvas.toDataURL('image/png'));
      }
    } else {
      setPresidentSignaturePng('');
    }
  }, [user, president, presidentDisplayName]);

  const handleExportPdf = async () => {
    if (!paperRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const element = paperRef.current;
      const fileName = `BCC_Membership_Agreement_${user.memberNumber || 'BRC-0000'}.pdf`;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export failed, falling back to print dialog:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Centered Document Stage matching the Novel Constitution Reader Size */}
      <div className="relative w-full flex items-center justify-center px-0 sm:px-4 py-2 print:p-0">
        <div
          className="relative w-full max-w-[620px] rounded-2xl shadow-xl p-2 sm:p-4 bg-[#e8dfc8] border-4 border-[#2b2416]/60 flex flex-col justify-between overflow-hidden print:p-0 print:border-none print:shadow-none print:bg-transparent print:max-w-none"
          style={{
            boxShadow: '0 25px 50px -12px rgba(27, 67, 50, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.4), inset 0 -4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Authentic Document Spine Shadow & Texture */}
          <div className="absolute top-0 bottom-0 left-0 w-5 sm:w-7 bg-gradient-to-r from-black/20 via-black/10 to-transparent pointer-events-none z-20 rounded-l-xl print:hidden" />
          <div className="absolute top-0 bottom-0 right-0 w-3 bg-gradient-to-l from-black/15 to-transparent pointer-events-none z-20 rounded-r-xl print:hidden" />

          {/* Ribbon Bookmark */}
          <div
            className="absolute top-0 right-8 z-30 w-5 sm:w-6 h-12 sm:h-14 bg-[#1b4332] shadow-md print:hidden"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
            }}
            title="Official Certified Document Ribbon"
          />

          {/* Physical Document Canvas Container */}
          <div
            ref={paperRef}
            className="relative w-full bg-[#fbf8ee] text-[#1a231e] p-4 sm:p-6 md:p-7 shadow-md rounded-xl space-y-4 font-serif leading-relaxed border border-[#dfd5be] overflow-hidden print:p-2 print:shadow-none print:m-0 print:border-none print:bg-white"
            style={{
              backgroundImage: `radial-gradient(#1b433206 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          >
            {/* Subtle Watermark Background Badge */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
              <img src="/logo.png" alt="Watermark" className="w-80 h-80 object-contain" />
            </div>

            {/* Paper Header */}
            <div className="pb-3 sm:pb-4 border-b border-[#1b4332]/20 relative z-10 flex flex-row items-center justify-between gap-2 sm:gap-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="BCC Riders Club Logo" className="w-full h-full object-contain" />
              </div>

              <div className="text-center flex-1 space-y-0.5">
                <h1 className="font-heading font-black text-base sm:text-xl text-[#1b4332] tracking-wider uppercase leading-tight whitespace-nowrap">
                  BCC RIDERS CLUB
                </h1>
                <p className="text-[10px] sm:text-xs font-sans font-bold text-[#2d6a4f] uppercase tracking-widest whitespace-nowrap">
                  BUHANGIN COMMUNITY CHURCH
                </p>
                <p className="text-[9px] sm:text-[10.5px] font-sans text-[#52605d] whitespace-nowrap">
                  469 Palm Drive, Buhangin, Davao City, Philippines
                </p>
                <p className="text-[9px] sm:text-[10px] font-sans text-[#52605d] italic whitespace-nowrap">
                  Official Record Ref: <span className="font-mono font-bold text-[#1b4332]">{user.memberNumber || 'BRC-0000'}</span>
                </p>
              </div>

              <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
                <img src="/bcc-logo.png" alt="Buhangin Community Church Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            {/* Legal & Conduct Agreement Body */}
            <div className="space-y-3 text-xs sm:text-[13px] text-[#2d3a3a] text-justify relative z-10 font-sans leading-relaxed">
              <div className="text-center pb-1">
                <span className="font-serif font-black text-xs sm:text-sm text-[#1b4332] uppercase tracking-wider block">
                  OFFICIAL MEMBERSHIP AGREEMENT
                </span>
                <span className="text-[9.5px] sm:text-[10.5px] font-serif italic text-[#52605d] block">
                  Declaration of Commitment &amp; Release of Liability
                </span>
              </div>

              <p className="indent-6 sm:indent-8">
                I hereby agree to abide by the rules, regulations, and code of conduct of the BCC Riders Club.
                I understand that motorcycle riding involves inherent risks, and I voluntarily assume full
                responsibility for my actions during all club activities and events.
              </p>

              <p className="indent-6 sm:indent-8">
                I further release and hold harmless the Buhangin Community Church Congregation, the BCC Riders
                Club, and its officers from any claims or liabilities arising from accidents, injuries, or
                incidents related to my participation.
              </p>

              <p className="indent-6 sm:indent-8">
                However, in the spirit of Christian brotherhood and humanitarian concern, members are encouraged,
                though not obligated, to extend help and support to one another as led by personal conviction and
                God's guidance.
              </p>

              <p className="indent-6 sm:indent-8 font-semibold text-[#1b4332] text-[11.5px] sm:text-xs">
                By signing below, I acknowledge that I have read, understood, and accepted these terms.
              </p>
            </div>

            {/* Signatures & Approvals Section */}
            <div className="pt-4 border-t border-[#2d6a4f]/20 grid grid-cols-2 gap-4 items-end relative z-10 font-sans">
              {/* Applicant Signature Box */}
              <div className="space-y-1 text-left relative">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#1b4332] block">
                  Applicant's Signature:
                </span>

                <div className="relative flex flex-col items-start justify-end pt-1 pb-1 min-h-[70px] sm:min-h-[85px]">
                  {/* Signed Signature Image behind printed name */}
                  {signaturePng ? (
                    <img
                      src={signaturePng}
                      alt="Applicant Signature"
                      className="absolute top-1/2 left-0 -translate-y-1/2 max-h-16 sm:max-h-20 object-contain filter brightness-0 contrast-200 pointer-events-none select-none z-0"
                      style={{ filter: 'brightness(0) contrast(200%)' }}
                    />
                  ) : null}

                  {/* Printed Name Line layered on top of signature */}
                  <div className="relative z-10 space-y-0.5 w-full text-left pt-4">
                    <strong className="block text-xs sm:text-sm font-black text-[#1b4332] tracking-wide truncate">
                      {getFormattedName()}
                    </strong>
                    <p className="text-[10px] font-semibold text-[#52605d]">
                      Date: <span className="font-mono text-[#1b4332]">{getSubmittedDate()}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Approved By President Box */}
              <div className="space-y-1 text-right relative">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#1b4332] block">
                  Approved By:
                </span>

                <div className="relative flex flex-col items-end justify-end pt-1 pb-1 min-h-[70px] sm:min-h-[85px]">
                  {president ? (
                    <>
                      {/* Signed President Signature Image and Approval Seal behind printed name */}
                      {presidentSignaturePng ? (
                        <>
                          <img
                            src="/approved.png"
                            alt="Official Approval Seal"
                            className="absolute top-1/2 right-0 -translate-y-1/2 w-36 sm:w-44 max-w-none opacity-25 pointer-events-none select-none z-0"
                          />
                          <img
                            src={presidentSignaturePng}
                            alt="President Signature"
                            className="absolute top-1/2 right-0 -translate-y-1/2 max-h-16 sm:max-h-20 object-contain filter brightness-0 contrast-200 pointer-events-none select-none z-0"
                            style={{ filter: 'brightness(0) contrast(200%)' }}
                          />
                        </>
                      ) : null}

                      {/* Name Content Layered on top of seal */}
                      <div className="relative z-10 space-y-0.5 w-full text-right pt-4">
                        <strong className="block text-xs sm:text-sm font-black text-[#1b4332] tracking-wide truncate">
                          {presidentDisplayName}
                        </strong>
                        <p className="text-[10px] font-extrabold text-[#2d6a4f] uppercase tracking-wider">
                          BCC Riders Club President
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Blank Signatory when no president is tagged or appointed or president was deleted */
                    <div className="relative z-10 space-y-0.5 w-full text-right pt-4">
                      <div className="border-b border-[#1b4332]/40 w-36 sm:w-44 ml-auto mb-1 h-6"></div>
                      <p className="text-[10px] font-extrabold text-[#2d6a4f] uppercase tracking-wider">
                        BCC Riders Club President
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bible Verse Footer Block */}
            <div className="pt-3 border-t border-[#e2ece2] text-center space-y-0.5 relative z-10">
              <p className="font-serif italic text-[10.5px] sm:text-xs text-[#1b4332] max-w-lg mx-auto leading-relaxed">
                “Then I saw heaven opened, and suddenly a white horse appeared. The name of the one riding it was Faithful and True, and with pure righteousness he judges and rides to battle.”
              </p>
              <p className="font-sans text-[9.5px] sm:text-[10px] font-extrabold text-[#2d6a4f] uppercase tracking-wider">
                — Revelation 19:11 (TPT)
              </p>
            </div>

            {/* Paper Footer Stamp */}
            <div className="pt-2 border-t border-[#e2ece2]/60 flex flex-row items-center justify-between text-[9.5px] sm:text-[10px] font-sans text-[#52605d] gap-2 relative z-10">
              <div className="flex items-center gap-1.5 truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                <span className="truncate">Digital Auth Hash: <code className="font-mono text-[#1b4332]">BCC-AUTH-{user.id.toUpperCase().slice(0, 8)}</code></span>
              </div>
              <span className="font-bold text-[#1b4332] shrink-0">Status: APPROVED &amp; SIGNED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md print:hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative w-full max-w-md rounded-3xl bg-white border border-[#e2ece2] p-6 shadow-xl space-y-5 text-[#1b4332]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#d8f3dc] text-[#1b4332]">
                    <Download className="w-6 h-6 text-[#2d6a4f]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-base text-[#1b4332]">
                      Confirm PDF Export
                    </h3>
                    <p className="text-xs text-[#52605d]">
                      Official Membership Document
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 rounded-full hover:bg-[#f7f9f7] text-[#52605d] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[#2d3a3a]">
                <p>
                  Are you sure you want to generate and download the official signed <strong>Membership Agreement & Liability Release</strong> for <strong>{getFormattedName()}</strong>?
                </p>

                <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1.5 font-sans">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">Member No.:</span>
                    <span className="font-mono font-bold text-[#1b4332]">{user.memberNumber || 'BRC-0000'}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">File Format:</span>
                    <span className="font-bold text-[#2d6a4f]">PDF (.pdf)</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#52605d]">File Name:</span>
                    <span className="font-mono text-[#1b4332] truncate max-w-[200px]">
                      BCC_Membership_Agreement_{user.memberNumber || 'BRC-0000'}.pdf
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#1b4332] text-xs font-bold border border-[#e2ece2] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExportModal(false);
                    handleExportPdf();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-4 h-4 text-[#74c69d]" />
                  Download PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
