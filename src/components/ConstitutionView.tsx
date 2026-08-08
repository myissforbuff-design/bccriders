import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, FileText, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

interface ConstitutionViewProps {
  onProceed: () => void;
  onCancel: () => void;
}

export const ConstitutionView: React.FC<ConstitutionViewProps> = ({ onProceed, onCancel }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current || hasScrolledToBottom) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Check if scrolled within 20px of the bottom (hitting the last sentence)
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="min-h-screen bg-white text-[#2d3a3a] font-sans flex flex-col justify-between p-3 sm:p-6 lg:p-10"
    >
      <div className="max-w-4xl mx-auto w-full space-y-4 sm:space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#e2ece2] gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] p-1.5 sm:p-2 flex items-center justify-center shadow-xs shrink-0">
              <img src="/logo.png" alt="BCC Riders Club Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-heading font-black text-sm sm:text-2xl text-[#1b4332] tracking-tight">
                BCC RIDERS CLUB
              </h1>
              <p className="text-[9px] sm:text-xs font-bold text-[#2d6a4f] uppercase tracking-wider">
                Constitution & By-Laws Agreement
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white border border-[#e2ece2] hover:bg-gray-100 text-[#52605d] text-[10px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Back to Login</span>
          </button>
        </div>

        {/* Scrollable Constitution Document Box */}
        <div className="relative rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-xl overflow-hidden">
          <div className="p-3 sm:p-5 bg-[#1b4332] text-white flex items-center justify-between">
            <div className="flex items-center gap-2 w-full justify-center">
              <span className="block text-center font-heading font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                Club Code of Governance
              </span>
            </div>
          </div>

          {/* Scrollable Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="p-4 sm:p-10 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto space-y-4 sm:space-y-6 text-[11px] sm:text-sm text-[#2d3a3a] leading-relaxed text-justify select-none font-sans"
          >
            <div className="text-center space-y-1.5 pb-3 sm:pb-4 border-b border-[#e2ece2]">
              <h2 className="font-heading font-black text-xs sm:text-xl text-[#1b4332] tracking-wide uppercase">
                CONSTITUTION AND BY-LAWS <br/> OF THE <br />BCC RIDERS CLUB
              </h2>
              <p className="text-[10px] sm:text-xs text-[#52605d] font-bold">
                Palm Drive Ext., Km5 Buhangin, Davao City
              </p>
            </div>

            {/* ARTICLE I – NAME */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE I – NAME</h3>
              <p className="indent-3 sm:indent-4 leading-relaxed">
                The name of this organization shall be Bearers of Christ Cause to Rescue the harassed and hopeless, INJECT God's words and presence, DISCIPLE them to do what we do, ENCOURAGE the troubled fellow, motivate and empower them, REJECT any demonic influences and attacks in a person's life, SHARE with them the true essence of Christianity Christ Leaders Unstoppable Brigade, hereinafter referred to as the <strong>BCC Riders Club</strong>.
              </p>
            </div>

            {/* ARTICLE II – PURPOSE AND OBJECTIVES */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE II – PURPOSE AND OBJECTIVES</h3>
              <p>The Club is established for the following purposes:</p>
              <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>To promote safe and responsible motorcycle riding.</li>
                <li>To build camaraderie, friendship, and brotherhood/sisterhood among riders.</li>
                <li>To organize group rides, touring activities, and motorcycle events for charity, satellite churches visitation, and impartation as well as coaching and training.</li>
                <li>To promote road safety awareness within the community.</li>
                <li>To represent Christ in places of his choice.</li>
              </ol>
            </div>

            {/* ARTICLE III – MEMBERSHIP */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE III – MEMBERSHIP</h3>
              
              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 1 – Eligibility</h4>
                <p>Membership in the Club shall be open to individuals who:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 sm:pl-2">
                  <li>Are 18 years old or older.</li>
                  <li>Have an updated license and registration.</li>
                  <li>Own or regularly ride a motorcycle.</li>
                  <li>Agree to abide by the constitution, by-laws, and club rules.</li>
                  <li>Show respect, discipline, and responsibility.</li>
                  <li>Are an active leader/member of a life group or a house church.</li>
                  <li>May have customized motorcycles, provided they do not violate LTO rules.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 2 – Types of Membership</h4>
                <p>The Club may have the following membership categories:</p>
                <div className="space-y-1 pl-1 sm:pl-2">
                  <p><strong>1. Full Member:</strong> Has full rights, including voting and holding office.</p>
                  <p><strong>2. Associate Member:</strong> Non-riding supporters or individuals without motorcycles. Has limited voting rights.</p>
                  <p><strong>3. Probationary Member:</strong> A new member undergoing an evaluation period (usually 3–6 months).</p>
                  <p><strong>4. Honorary Member:</strong> Individuals recognized for significant contributions to the club.</p>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 3 – Admission</h4>
                <p>A person may become a member by:</p>
                <ol className="list-decimal list-inside space-y-0.5 pl-1 sm:pl-2">
                  <li>Submitting a membership application.</li>
                  <li>Being recommended by an existing member, leader or network leader.</li>
                  <li>Approval by the designated Club Officers or Majority Vote.</li>
                </ol>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 4 – Termination of Membership</h4>
                <p>Membership may be terminated for:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 sm:pl-2">
                  <li>Violation of club rules</li>
                  <li>Unsafe riding behavior</li>
                  <li>Disrespect toward members</li>
                  <li>Illegal activities while representing the club</li>
                  <li>Non-payment of dues</li>
                  <li>Failure to follow the protocols of suspension</li>
                </ul>
                <p className="pt-0.5 text-[#52605d]">Termination requires majority approval of the officers or members.</p>
              </div>
            </div>

            {/* ARTICLE IV – OFFICERS */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE IV – OFFICERS</h3>
              
              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 1 – Officers of the Club</h4>
                <p>The officers of the Club shall include:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 sm:pl-2">
                  <li>President</li>
                  <li>Vice President</li>
                  <li>Secretary</li>
                  <li>Treasurer</li>
                  <li>Road Captain</li>
                  <li>Safety Officer (optional)</li>
                  <li>Sergeant-at-Arms</li>
                  <li>Members Representative</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 2 – Duties of Officers</h4>
                <div className="space-y-1 pl-1 sm:pl-2">
                  <p><strong>President:</strong> Leads the club and presides over meetings. Represents the club in official matters. Oversees club activities.</p>
                  <p><strong>Vice President:</strong> Assists the President. Acts as President in absence of the President.</p>
                  <p><strong>Secretary:</strong> Keeps records of meetings. Handles club correspondence. Maintains membership records.</p>
                  <p><strong>Treasurer:</strong> Manages club funds. Collects dues. Prepares the financial reports.</p>
                  <p><strong>Road Captain:</strong> Plans and leads group rides. Ensures ride safety and coordination.</p>
                  <p><strong>Safety Officer:</strong> Promotes safe riding practices. Conducts safety briefings.</p>
                  <p><strong>Sergeant-at-Arms:</strong> Maintains order during meetings. Ensures that members follow club rules.</p>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 3 – Term of Office</h4>
                <ul className="list-disc list-inside space-y-0.5 pl-1 sm:pl-2">
                  <li>Officers serve a term of three (3) years.</li>
                  <li>Officers may be re-elected.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">Section 4 – Election of Officers</h4>
                <ul className="list-disc list-inside space-y-0.5 pl-1 sm:pl-2">
                  <li>Elections shall be held every three years.</li>
                  <li>Voting shall be by majority vote of active members.</li>
                </ul>
              </div>
            </div>

            {/* ARTICLE V – MEETINGS */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE V – MEETINGS</h3>
              <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>Regular meetings shall be held monthly or as scheduled by the club.</li>
                <li>Special/emergency meetings may be called by the President or majority of officers.</li>
                <li>A quorum shall consist of 50% of active members.</li>
                <li>A riding member's absence from a regular meeting must be reported at least three (3) days in advance through any means of communication.</li>
                <li>A one (1) day notice of absence or excuse for regular meetings is allowed only in cases of emergency.</li>
              </ol>
            </div>

            {/* ARTICLE VI – RIDING RULES */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE VI – RIDING RULES</h3>
              <p>Members must:</p>
              <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>Follow traffic laws and safety regulations.</li>
                <li>Wear proper riding gear.</li>
                <li>Follow instructions from the Road Captain during rides.</li>
                <li>Avoid reckless riding.</li>
                <li>Respect fellow riders and other motorists.</li>
              </ol>
            </div>

            {/* ARTICLE VII – CLUB FUNDS */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE VII – CLUB FUNDS</h3>
              <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>The club may collect membership dues or contributions of one hundred pesos (P100).</li>
                <li>
                  Funds shall be used for:
                  <ul className="list-disc list-inside space-y-0.5 pl-3 sm:pl-5 pt-0.5">
                    <li>Club activities</li>
                    <li>Charity events</li>
                    <li>Club merchandise</li>
                    <li>Administrative expenses</li>
                  </ul>
                </li>
                <li>All financial transactions shall be recorded by the Treasurer.</li>
                <li>Funds shall be deposited in a bank, cooperative, or other non-banking institution.</li>
                <li>Funds shall be withdrawn only by the knowledge and signatories of the president, treasurer, and elected representative of the riding members.</li>
              </ol>
            </div>

            {/* ARTICLE VIII – CLUB IDENTITY */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE VIII – CLUB IDENTITY</h3>
              <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>The Club may adopt an official logo, patch, or emblem of the full armor of God.</li>
                <li>Club colors and insignia shall be respected by members.</li>
                <li>Unauthorized use of the club logo is prohibited.</li>
                <li>Any riding-member caught lending his/her uniform to non-members will be subject to disciplinary action as stated under Article IX, after undergoing a thorough investigation.</li>
              </ol>
            </div>

            {/* ARTICLE IX – DISCIPLINE */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE IX – DISCIPLINE</h3>
              <p>Members may be disciplined for:</p>
              <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>Disrespectful conduct</li>
                <li>Unsafe riding</li>
                <li>Violating club rules</li>
                <li>Actions that damage the club's reputation</li>
                <li>Engagement in vices such as smoking, drinking liquor, or gambling</li>
              </ul>

              <p className="pt-0.5 font-bold text-[#1b4332]">Disciplinary actions may include:</p>
              
              <div className="space-y-1.5 pl-1 sm:pl-2">
                <div>
                  <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">• Warning</h4>
                  <p className="pl-2 sm:pl-3 text-[10px] sm:text-xs leading-relaxed">
                    A riding member shall undergo a series of counseling sessions with his/her leader or mentor, continuing until he/she is permitted to rejoin and be reinstated.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">• Suspension</h4>
                  <ul className="list-disc list-inside space-y-0.5 pl-2 sm:pl-3 text-[10px] sm:text-xs leading-relaxed">
                    <li>When a riding member receives three (3) successive warnings, he/she shall be suspended for one (1) year.</li>
                    <li>The logo and uniform, though owned and personally paid for by a suspended riding-member, shall be surrendered to the officer-in-charge to prevent their use in future rides with other clubs.</li>
                    <li>A suspended member must attend and commit to a life group (closed/open cell, house church, plug-in, 5 am corporate prayer, or deliverance).</li>
                    <li>A suspended riding-member may be reinstated only when permitted by his/her leader and approved by his/her network leader or senior pastors.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-[#2d6a4f] text-[10px] sm:text-xs">• Removal from membership</h4>
                  <ul className="list-disc list-inside space-y-0.5 pl-2 sm:pl-3 text-[10px] sm:text-xs leading-relaxed">
                    <li>Any suspended riding-member who shows no sign of spiritual renewal or commitment.</li>
                    <li>Frequent absences from his/her life group, house church, cell group, gathering, plug-in, or corporate prayer, despite prior notice through any means of communication.</li>
                    <li>No prior notice of disengagement and absence from any club activities.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ARTICLE X – AMENDMENTS */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE X – AMENDMENTS</h3>
              <p>This Constitution and By-Laws may be amended by:</p>
              <ul className="list-disc list-inside space-y-0.5 sm:space-y-1 pl-1 sm:pl-2">
                <li>Two-thirds (2/3) vote of active members, and</li>
                <li>Notice of proposed amendment given during a prior meeting.</li>
              </ul>
            </div>

            {/* ARTICLE XI – RATIFICATION */}
            <div className="space-y-1.5">
              <h3 className="font-bold text-[#1b4332] text-[11px] sm:text-sm uppercase">ARTICLE XI – RATIFICATION</h3>
              <p className="indent-3 sm:indent-4 leading-relaxed font-semibold text-[#1b4332]">
                This Constitution and By-Laws shall take effect upon approval by most of the founding members of the BCC Riders Club.
              </p>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-3.5 sm:p-6 bg-[#f7f9f7] border-t border-[#e2ece2] space-y-3">
            {/* Scroll Indicator Prompt if not scrolled yet */}
            {!hasScrolledToBottom && (
              <p className="text-[10px] sm:text-[11px] text-center text-amber-800 font-semibold bg-amber-50 border border-amber-200 p-2 sm:p-2.5 rounded-xl">
                Scroll down inside the document box to the last sentence to unlock agreement options.
              </p>
            )}

            {/* Checkbox */}
            <label
              className={`flex items-start gap-2.5 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all select-none ${
                !hasScrolledToBottom
                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                  : isAgreed
                  ? 'bg-[#d8f3dc] border-[#2d6a4f] text-[#1b4332] font-semibold cursor-pointer shadow-2xs'
                  : 'bg-white border-[#e2ece2] text-[#2d3a3a] hover:border-[#2d6a4f]/60 cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                disabled={!hasScrolledToBottom}
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-[#1b4332] focus:ring-[#2d6a4f] cursor-pointer disabled:cursor-not-allowed shrink-0"
              />
              <span className="text-[10px] sm:text-xs leading-relaxed">
                I agree to the BCC Riders Club Constitution & By-Laws.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] hover:bg-gray-100 text-[#52605d] text-[11px] sm:text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!hasScrolledToBottom || !isAgreed}
                onClick={onProceed}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-extrabold shadow-md transition-all flex items-center gap-1.5 sm:gap-2 ${
                  !hasScrolledToBottom || !isAgreed
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                    : 'bg-[#1b4332] hover:bg-[#2d6a4f] text-white cursor-pointer hover:scale-[1.01]'
                }`}
              >
                <span>Proceed</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
