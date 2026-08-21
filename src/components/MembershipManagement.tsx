import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import { store } from '../lib/db';
import { User, MembershipType } from '../types';
import { MemberRegistrationForm } from './MemberRegistrationForm';
import { EditMemberModal, cleanBarangayCityAddress } from './EditMemberModal';
import { RoleAvatarBadge } from './RoleAvatarBadge';
import {
  Users,
  User as UserIcon,
  Search,
  Plus,
  ShieldCheck,
  Phone,
  Mail,
  Bike,
  Calendar,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  UserCheck,
  Database,
  Key,
  Copy,
  Check,
  Trash2,
  UserX,
  MoreVertical,
  FileText,
  Pencil,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const exportMembersToExcel = (membersList: User[] = []) => {
  const safeVal = (val: any): string | number => {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.join('; ');
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  };

  const getFirstName = (m: User) => {
    if (m.firstName) return m.firstName;
    if (!m.name) return '';
    const parts = m.name.trim().split(' ');
    return parts[0] || '';
  };

  const getLastName = (m: User) => {
    if (m.lastName) return m.lastName;
    if (!m.name) return '';
    const parts = m.name.trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  };

  // Tab 1: Profile & Account
  const profileRows = membersList.map((m) => ({
    'Member ID': safeVal(m.memberNumber),
    'Last Name': safeVal(getLastName(m)),
    'First Name': safeVal(getFirstName(m)),
    'Username': safeVal(m.username),
    'Role': safeVal(m.role),
    'Approval Status': safeVal(m.approvalStatus || 'Approved'),
    'Join Date': safeVal(m.joinDate),
    'Birthdate': safeVal(m.birthdate),
    'Age': safeVal(m.age),
    'Gender': safeVal(m.gender),
    'Civil Status': safeVal(m.civilStatus),
    'Occupation': safeVal(m.occupation),
    'Occupation Status': safeVal(m.occupationStatus),
    'Life Insurance': safeVal(m.lifeInsurance),
  }));

  // Tab 2: Contact & Emergency
  const contactRows = membersList.map((m) => {
    let fullAddr = m.address || '';
    if (m.streetAddress && m.streetAddress.trim()) {
      const cleanLoc = cleanBarangayCityAddress(m.address, m.streetAddress);
      fullAddr = cleanLoc ? `${m.streetAddress.trim()}, ${cleanLoc}` : m.streetAddress.trim();
    }
    return {
      'Member ID': safeVal(m.memberNumber),
      'Last Name': safeVal(getLastName(m)),
      'First Name': safeVal(getFirstName(m)),
      'Email': safeVal(m.email),
      'Phone': safeVal(m.phone),
      'Mobile No': safeVal(m.mobileNo),
      'Address': safeVal(fullAddr),
      'Emergency Contact Name': safeVal(m.emergencyContact?.name),
      'Emergency Contact Relationship': safeVal(m.emergencyContact?.relationship),
      'Emergency Contact Phone': safeVal(m.emergencyContact?.phone),
    };
  });

  // Tab 3: Organization & Network
  const orgRows = membersList.map((m) => ({
    'Member ID': safeVal(m.memberNumber),
    'Last Name': safeVal(getLastName(m)),
    'First Name': safeVal(getFirstName(m)),
    'Network': safeVal(m.network),
    'Chapter': safeVal(m.chapter),
    'Leaders Name': safeVal(m.leadersName),
    'Leaders Contact No': safeVal(m.leadersContactNo),
    'Affiliation': safeVal(m.affiliation),
    'Reason For Joining': safeVal(m.reasonForJoining),
    'Recommended By': safeVal(m.recommendedBy),
    'Declaration Date': safeVal(m.declarationDate),
  }));

  // Tab 4: License & Riding
  const licenseRows = membersList.map((m) => ({
    'Member ID': safeVal(m.memberNumber),
    'Last Name': safeVal(getLastName(m)),
    'First Name': safeVal(getFirstName(m)),
    'License No': safeVal(m.licenseNo),
    'License Expiry Date': safeVal(m.licenseExpiryDate),
    'Riding Experience': safeVal(m.ridingExperience),
    'Rider Type': safeVal(m.riderType),
    'Restriction Codes': safeVal(m.bikeInfo?.restrictionCodes || m.bikeInfo?.licenseRestrictionCode),
    'LTO Conditions': safeVal(m.bikeInfo?.ltoConditions || m.bikeInfo?.conditionCode),
  }));

  // Tab 5: Motorcycle Details
  const bikeRows = membersList.map((m) => ({
    'Member ID': safeVal(m.memberNumber),
    'Last Name': safeVal(getLastName(m)),
    'First Name': safeVal(getFirstName(m)),
    'Motorcycle Make': safeVal(m.bikeInfo?.make),
    'Motorcycle Model': safeVal(m.bikeInfo?.model),
    'Motorcycle Year': safeVal(m.bikeInfo?.year),
    'Engine CC': safeVal(m.bikeInfo?.engineCc),
    'Engine No': safeVal(m.bikeInfo?.engineNo),
    'Chassis No': safeVal(m.bikeInfo?.chassisNo),
    'CR No': safeVal(m.bikeInfo?.crNo),
    'OR No': safeVal(m.bikeInfo?.orNo),
    'OR Expiry Date': safeVal(m.bikeInfo?.orExpiryDate),
    'Plate No': safeVal(m.bikeInfo?.plateNo || m.bikeInfo?.licensePlate),
    'Color': safeVal(m.bikeInfo?.color),
    'Condition': safeVal(m.bikeInfo?.condition),
    'Years In Service': safeVal(m.bikeInfo?.yearsInService),
  }));

  const wb = XLSX.utils.book_new();

  const sheet1 = XLSX.utils.json_to_sheet(profileRows);
  const sheet2 = XLSX.utils.json_to_sheet(contactRows);
  const sheet3 = XLSX.utils.json_to_sheet(orgRows);
  const sheet4 = XLSX.utils.json_to_sheet(licenseRows);
  const sheet5 = XLSX.utils.json_to_sheet(bikeRows);

  XLSX.utils.book_append_sheet(wb, sheet1, 'Profile & Account');
  XLSX.utils.book_append_sheet(wb, sheet2, 'Contact & Emergency');
  XLSX.utils.book_append_sheet(wb, sheet3, 'BCC Information');
  XLSX.utils.book_append_sheet(wb, sheet4, 'License & Riding');
  XLSX.utils.book_append_sheet(wb, sheet5, 'Motorcycle Details');

  XLSX.writeFile(wb, 'Members_Datasheet.xlsx');
};

interface MembershipManagementProps {
  onOpenDuesModal?: () => void;
}

const DEFAULT_AVATAR = '/avatar.svg';

export const MembershipManagement: React.FC<MembershipManagementProps> = ({ onOpenDuesModal }) => {
  const { currentUser, isAdmin, refreshUserData } = useAuth();
  const { runWithLoader, refreshTick } = useLoader();
  const [members, setMembers] = useState<User[]>(() =>
    store.getUsers().filter((m) => m.role !== 'admin')
  );
  const [search, setSearch] = useState('');

  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [rosterTab, setRosterTab] = useState<'active' | 'pending'>(() => {
    const saved = localStorage.getItem('bcc_roster_tab');
    return (saved === 'pending' || saved === 'active') ? saved : 'active';
  });

  useEffect(() => {
    localStorage.setItem('bcc_roster_tab', rosterTab);
  }, [rosterTab]);

  useEffect(() => {
    setMembers([...store.getUsers().filter((m) => m.role !== 'admin' && m.id !== 'usr_admin')]);
  }, [refreshTick]);

  useEffect(() => {
    // Initial fetch from MongoDB endpoints on mount
    store.fetchAuthenticatedData().then(() => {
      setMembers([...store.getUsers().filter((m) => m.role !== 'admin' && m.id !== 'usr_admin')]);
    }).catch(() => {});

    const handleUsersUpdated = (e: Event) => {
      const updated = (e as CustomEvent).detail || store.getUsers();
      if (Array.isArray(updated)) {
        setMembers([...updated.filter((m: User) => m.role !== 'admin' && m.id !== 'usr_admin')]);
      }
    };

    window.addEventListener('bcc_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('bcc_users_updated', handleUsersUpdated);
  }, []);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [reviewingPendingUser, setReviewingPendingUser] = useState<User | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'approve' | 'reject' | 'delete';
    member: User;
  } | null>(null);

  useModalDismiss(!!confirmModal, () => setConfirmModal(null));
  useModalDismiss(!!reviewingPendingUser, () => setReviewingPendingUser(null));
  useModalDismiss(addModalOpen, () => setAddModalOpen(false));
  useModalDismiss(!!selectedMember, () => setSelectedMember(null));

  const activeDropdownMember = openDropdownId ? members.find((m) => m.id === openDropdownId) : null;

  const handleApproveMember = async (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (target) {
      await runWithLoader(
        async () => {
          target.approvalStatus = 'Approved';
          if (
            !target.memberNumber ||
            target.memberNumber === 'BCC-MEMBER' ||
            target.memberNumber === 'BRC-MEMBER' ||
            target.memberNumber.startsWith('BCC-') ||
            target.memberNumber === 'Pending'
          ) {
            const approvedCount = members.filter((m) => m.approvalStatus === 'Approved').length;
            target.memberNumber = `BRC-${String(approvedCount + 1).padStart(4, '0')}`;
          }
          store.approveRegistration(target);
          if (selectedMember?.id === memberId) setSelectedMember(null);
          if (reviewingPendingUser?.id === memberId) setReviewingPendingUser(null);
          setConfirmModal(null);
          refreshList();
          setRosterTab('active');
        },
        {
          message: 'Approving Member & Refreshing Data...',
          onComplete: () => {
            setSyncStatusMsg({
              type: 'success',
              text: target.email
                ? `Member approved & notification email sent to ${target.email}`
                : 'Member is accepted',
            });
            setTimeout(() => {
              setSyncStatusMsg(null);
            }, 3000);
          },
        }
      );
    }
  };

  const handleRejectMember = async (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    const memberName = target?.name || 'Applicant';
    const memberEmail = target?.email;
    await runWithLoader(
      async () => {
        if (target) {
          store.rejectRegistration(target);
        } else {
          store.deleteUser(memberId);
        }
        if (selectedMember?.id === memberId) setSelectedMember(null);
        if (reviewingPendingUser?.id === memberId) setReviewingPendingUser(null);
        setConfirmModal(null);
        refreshList();
      },
      {
        message: 'Rejecting Application & Sending Notification...',
        onComplete: () => {
          setSyncStatusMsg({
            type: 'success',
            text: memberEmail
              ? `Application rejected & status email sent to ${memberEmail}`
              : `Application for "${memberName}" has been rejected.`,
          });
          setTimeout(() => {
            setSyncStatusMsg(null);
          }, 3000);
        },
      }
    );
  };

  const activeMembersList = members.filter((m) => m.approvalStatus !== 'Pending' && m.role !== 'admin');
  const pendingMembersList = members.filter((m) => m.approvalStatus === 'Pending');

  const refreshList = () => {
    setMembers([...store.getUsers()]);
    refreshUserData();
  };

  const filteredMembers = (rosterTab === 'pending' ? pendingMembersList : activeMembersList).filter((m) => {
    if (m.role === 'admin') return false;

    return (
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.memberNumber.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.bikeInfo.make.toLowerCase().includes(search.toLowerCase()) ||
      m.bikeInfo.model.toLowerCase().includes(search.toLowerCase())
    );
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rosterTab]);

  const paginatedMembers = filteredMembers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {syncStatusMsg && (
        <div
          className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs ${
            syncStatusMsg.type === 'success'
              ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span>{syncStatusMsg.text}</span>
          <button
            onClick={() => setSyncStatusMsg(null)}
            className="text-xs font-bold hover:underline cursor-pointer ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Members & Pending Button Group */}
      <div className="flex items-center justify-start">
        <div className="inline-flex p-1 sm:p-1.5 bg-[#eaf1ea] rounded-xl sm:rounded-2xl border border-[#d8e4d8] shadow-2xs gap-1">
          <button
            type="button"
            onClick={() => setRosterTab('active')}
            className={`py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 sm:gap-2 select-none ${
              rosterTab === 'active'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-white/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Members</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold transition-colors ${
                rosterTab === 'active'
                  ? 'bg-[#d8f3dc] text-[#1b4332]'
                  : 'bg-white text-[#52605d] border border-[#d8e4d8]'
              }`}
            >
              {activeMembersList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRosterTab('pending')}
            className={`py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 sm:gap-2 select-none ${
              rosterTab === 'pending'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-white/60'
            }`}
          >
            <Clock
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                rosterTab === 'pending' ? 'text-[#74c69d]' : 'text-amber-500'
              }`}
            />
            <span>Pending</span>
            {pendingMembersList.length > 0 ? (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  rosterTab === 'pending'
                    ? 'bg-amber-400 text-stone-950 font-black'
                    : 'bg-amber-500 text-white animate-pulse'
                }`}
              >
                {pendingMembersList.length}
              </span>
            ) : (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  rosterTab === 'pending'
                    ? 'bg-[#d8f3dc]/30 text-white'
                    : 'bg-white text-[#52605d] border border-[#d8e4d8]'
                }`}
              >
                0
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Toolbar & Actions */}
      <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-[#e2ece2] shadow-xs flex items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search name, member #, email, or bike model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 sm:pl-9 pr-3.5 py-2 sm:py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-xs focus:outline-none focus:border-[#2d6a4f]"
          />
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#52605d] absolute left-2.5 sm:left-3 top-2.5 sm:top-3" />
        </div>

        {rosterTab === 'active' && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActionDropdownOpen(!actionDropdownOpen)}
              className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span>Actions</span>
              <ChevronDown
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                  actionDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {actionDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setActionDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-44 sm:w-48 bg-white rounded-2xl shadow-xl border border-[#e2ece2] py-1.5 z-50 text-xs font-semibold overflow-hidden"
                  >
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setAddModalOpen(true);
                          setActionDropdownOpen(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-[#1b4332] hover:bg-[#f7f9f7] flex items-center gap-2.5 cursor-pointer font-bold border-b border-[#e2ece2]/60 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                        <span>Add Member</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        exportMembersToExcel(members);
                        setActionDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-[#1b4332] hover:bg-[#f7f9f7] flex items-center gap-2.5 cursor-pointer font-bold transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      <span>Export Excel (.xlsx)</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Invisible backdrop to close 3-dot dropdown when clicking outside */}
      {openDropdownId && (
        <div
          className="fixed inset-0 z-40 bg-black/5"
          onClick={(e) => {
            e.stopPropagation();
            setOpenDropdownId(null);
            setDropdownPos(null);
          }}
        />
      )}

      {/* Floating Top-Level Dropdown Menu */}
      {openDropdownId && activeDropdownMember && dropdownPos && (
        <div
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            right: `${dropdownPos.right}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-52 rounded-2xl bg-white border border-[#e2ece2] shadow-2xl z-50 overflow-hidden py-1 text-left"
        >
          {activeDropdownMember.approvalStatus === 'Pending' ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetMember = activeDropdownMember;
                  setOpenDropdownId(null);
                  setDropdownPos(null);
                  setReviewingPendingUser(targetMember);
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4 text-[#2d6a4f]" />
                <span>Review Application</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetMember = activeDropdownMember;
                  setOpenDropdownId(null);
                  setDropdownPos(null);
                  setConfirmModal({ type: 'approve', member: targetMember });
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2 cursor-pointer transition-colors border-t border-[#f0f4f1]"
              >
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f]" />
                <span>Approve Member</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetMember = activeDropdownMember;
                  setOpenDropdownId(null);
                  setDropdownPos(null);
                  setConfirmModal({ type: 'reject', member: targetMember });
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-[#f0f4f1]"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Reject Application</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetMember = activeDropdownMember;
                  setOpenDropdownId(null);
                  setDropdownPos(null);
                  setSelectedMember(targetMember);
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <UserCheck className="w-4 h-4 text-[#2d6a4f]" />
                <span>View Profile</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetMember = activeDropdownMember;
                    setOpenDropdownId(null);
                    setDropdownPos(null);
                    setEditingMember(targetMember);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2 cursor-pointer transition-colors border-t border-[#f0f4f1]"
                >
                  <Pencil className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Edit Info & Role</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Directory / Pending Table View */}
      {filteredMembers.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-[#e2ece2] text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#2d6a4f] mx-auto" />
          <h4 className="font-heading font-bold text-base text-[#1b4332]">
            {rosterTab === 'pending' ? 'No Pending Registrations' : 'No Members Found'}
          </h4>
          <p className="text-xs text-[#52605d]">
            {rosterTab === 'pending'
              ? 'All member registration applications have been reviewed and processed.'
              : 'Try adjusting your search criteria.'}
          </p>
        </div>
      ) : (
        <>
          {/* Responsive Card Grid View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedMembers.map((m) => {
              const isMe = currentUser?.id === m.id;
              const isPending = m.approvalStatus === 'Pending';

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (isPending) {
                      setReviewingPendingUser(m);
                    } else {
                      setSelectedMember(m);
                    }
                  }}
                  className="p-4 rounded-2xl bg-white border border-[#e2ece2] shadow-xs hover:border-[#2d6a4f] hover:bg-[#f4f9f5] hover:shadow-md transition-all cursor-pointer space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={m.avatar || DEFAULT_AVATAR}
                        alt={m.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                        }}
                        className="w-14 h-14 rounded-full object-cover border-2 border-[#2d6a4f]"
                      />
                      <RoleAvatarBadge role={m.role} size="md" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#1b4332] text-sm truncate flex items-center gap-1.5">
                        <span className="truncate">{m.name}</span>
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#d8f3dc] text-[#1b4332] font-bold shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#2d6a4f] truncate font-medium">
                        {m.network || m.chapter || 'N/A'}
                      </div>
                      <div className="text-[10px] text-[#52605d] font-mono truncate">
                         #{m.memberNumber || 'N/A'} | {m.bikeInfo?.make || m.bikeInfo?.model ? `${m.bikeInfo.make || ''} ${m.bikeInfo.model || ''}`.trim() : 'No info'}
                      </div>
                    </div>
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-200">
                        Review
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-[#e2ece2]">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-4 py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-bold text-[#1b4332] hover:bg-[#f7f9f7] disabled:opacity-50 cursor-pointer transition-colors"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-[#52605d]">Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-4 py-2 rounded-xl bg-white border border-[#e2ece2] text-xs font-bold text-[#1b4332] hover:bg-[#f7f9f7] disabled:opacity-50 cursor-pointer transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Member Detail Drawer Modal */}
      <AnimatePresence>
        {selectedMember && (
          <ModalPortal>
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedMember(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl max-h-[82dvh] sm:max-h-[78dvh] flex flex-col rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-2xl overflow-hidden text-[#2d3a3a] my-auto"
              >
                {/* Sticky Modal Header */}
                <div className="p-3 sm:p-4 bg-[#f7f9f7] border-b border-[#e2ece2] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="relative shrink-0 inline-block">
                      <img
                        src={selectedMember.avatar || DEFAULT_AVATAR}
                        alt={selectedMember.name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                        }}
                        className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-[#2d6a4f]"
                      />
                      <RoleAvatarBadge role={selectedMember.role} size="md" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-heading font-bold text-[#1b4332] text-sm sm:text-base truncate">
                        {selectedMember.name}
                      </h3>
                      <p className="text-[11px] sm:text-xs font-semibold text-[#2d6a4f] truncate">
                        @{selectedMember.username || (selectedMember.email ? selectedMember.email.split('@')[0] : 'rider')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="p-1.5 sm:p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-stone-200 cursor-pointer shrink-0 transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                {/* Scrollable Modal Body */}
                <div className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-3.5 flex-1 overflow-y-auto overscroll-contain pr-2 scroll-smooth">
                  {/* Member Role Card */}
                  <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-[#52605d] uppercase tracking-wider font-bold">
                        Club Membership Info
                      </span>
                      <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                        Member ID: <strong className="text-[#2d6a4f]">#{selectedMember.memberNumber}</strong>
                      </p>
                    </div>

                    <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold uppercase bg-[#d8f3dc] text-[#1b4332]">
                      {selectedMember.approvalStatus || 'Approved'}
                    </span>
                  </div>

                  {/* Contact & Personal Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 text-xs">
                    <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1.5 sm:space-y-2">
                      <span className="text-[#52605d] font-bold block text-[11px] sm:text-xs">Personal & License Info</span>
                      <p className="text-[#2d3a3a] flex items-center gap-2">
                        <UserIcon className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                        Username: <strong className="text-[#1b4332]">{selectedMember.username || (selectedMember.email ? selectedMember.email.split('@')[0] : 'rider')}</strong>
                      </p>
                      <p className="text-[#2d3a3a] flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                        <span className="truncate">{selectedMember.email}</span>
                      </p>
                      <p className="text-[#2d3a3a] flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                        {selectedMember.phone}
                      </p>
                      {selectedMember.birthdate && (
                        <p className="text-[#52605d]">
                          Birthdate: <strong className="text-[#1b4332]">{selectedMember.birthdate}</strong>
                          {selectedMember.age && ` (${selectedMember.age} yrs)`}
                        </p>
                      )}
                      {selectedMember.gender && (
                        <p className="text-[#52605d]">
                          Gender: <strong className="text-[#1b4332]">{selectedMember.gender}</strong>
                        </p>
                      )}
                      {selectedMember.licenseNo && (
                        <p className="text-[#52605d]">
                          License No: <strong className="text-[#1b4332]">{selectedMember.licenseNo}</strong>
                          {selectedMember.licenseExpiryDate && ` (Exp: ${selectedMember.licenseExpiryDate})`}
                        </p>
                      )}
                      {(selectedMember.streetAddress || selectedMember.address) && (
                        <p className="text-[#52605d]">
                          Address:{' '}
                          <strong className="text-[#1b4332]">
                            {[
                              selectedMember.streetAddress,
                              cleanBarangayCityAddress(selectedMember.address, selectedMember.streetAddress)
                            ].filter(Boolean).join(', ')}
                          </strong>
                        </p>
                      )}
                    </div>

                    {(selectedMember.network || selectedMember.chapter || selectedMember.leadersName || selectedMember.leadersContactNo) && (
                      <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1.5 sm:space-y-2 col-span-1 sm:col-span-2">
                        <span className="text-[#52605d] font-bold block text-[11px] sm:text-xs">BCC Information</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[#52605d]">
                          {selectedMember.network && (
                            <p>Network: <strong className="text-[#1b4332]">{selectedMember.network}</strong></p>
                          )}
                          {selectedMember.chapter && (
                            <p>Chapter: <strong className="text-[#1b4332]">{selectedMember.chapter}</strong></p>
                          )}
                          {selectedMember.leadersName && (
                            <p>Leader's Name: <strong className="text-[#1b4332]">{selectedMember.leadersName}</strong></p>
                          )}
                          {selectedMember.leadersContactNo && (
                            <p>Leader's Contact No: <strong className="text-[#1b4332]">{selectedMember.leadersContactNo}</strong></p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1.5 sm:space-y-2 col-span-1 sm:col-span-2">
                      <span className="text-[#52605d] font-bold block text-[11px] sm:text-xs">Emergency Contact</span>
                      <p className="text-[#1b4332] font-semibold">
                        {selectedMember.emergencyContact.name} ({selectedMember.emergencyContact.relationship})
                      </p>
                      <p className="text-[#52605d] flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {selectedMember.emergencyContact.phone}
                      </p>
                    </div>
                  </div>

                  {/* Bike Garage Details */}
                  <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2.5 sm:space-y-3">
                    <span className="text-xs font-bold text-[#1b4332] flex items-center gap-2">
                      <Bike className="w-4 h-4 text-[#2d6a4f]" />
                      Motorcycle Specifications & Documents
                    </span>

                    {/* Motorcycle Photo Display */}
                    <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-[#e2ece2] bg-stone-900 relative shadow-xs group">
                      <img
                        src={
                          selectedMember.bikeInfo.photoUrl ||
                          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=800'
                        }
                        alt={`${selectedMember.bikeInfo.make || 'Motorcycle'} ${selectedMember.bikeInfo.model || ''}`}
                        className="w-full h-32 sm:h-44 object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=800';
                        }}
                      />
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#1b4332]/90 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-extrabold tracking-wide flex items-center gap-1.5 shadow-md border border-white/20">
                        <Bike className="w-3.5 h-3.5 text-[#74c69d]" />
                        <span>{selectedMember.bikeInfo.make} {selectedMember.bikeInfo.model}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-xs">
                      <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">Make</span>
                        <strong className="text-[#1b4332] truncate block">{selectedMember.bikeInfo.make}</strong>
                      </div>
                      <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">Model</span>
                        <strong className="text-[#1b4332] truncate block">{selectedMember.bikeInfo.model}</strong>
                      </div>
                      <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">Engine No.</span>
                        <strong className="text-[#1b4332] truncate block">{selectedMember.bikeInfo.engineNo || 'N/A'}</strong>
                      </div>
                      <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">Chassis No.</span>
                        <strong className="text-[#2d6a4f] truncate block">{selectedMember.bikeInfo.chassisNo || 'N/A'}</strong>
                      </div>
                    </div>

                    {(selectedMember.bikeInfo.plateNo || selectedMember.bikeInfo.licensePlate || selectedMember.bikeInfo.crNo || selectedMember.bikeInfo.orNo || selectedMember.bikeInfo.orExpiryDate) && (
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs pt-2 border-t border-[#e2ece2]">
                        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                          <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">Plate No.</span>
                          <strong className="text-[#1b4332] font-mono break-all">{selectedMember.bikeInfo.plateNo || selectedMember.bikeInfo.licensePlate || 'N/A'}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                          <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">CR No.</span>
                          <strong className="text-[#1b4332] font-mono break-all">{selectedMember.bikeInfo.crNo || 'N/A'}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                          <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">OR No.</span>
                          <strong className="text-[#1b4332] font-mono break-all">{selectedMember.bikeInfo.orNo || 'N/A'}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                          <span className="text-[9.5px] sm:text-[10px] text-[#52605d] block">OR Exp. Date</span>
                          <strong className="text-[#2d6a4f] font-mono break-all">{selectedMember.bikeInfo.orExpiryDate || 'N/A'}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Static Admin Controls at bottom of modal */}
                {isAdmin && (
                  <div className="p-3 sm:p-3.5 bg-[#f7f9f7] border-t border-[#e2ece2] shrink-0">
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="text-xs font-bold text-[#1b4332] flex items-center gap-1.5 shrink-0">
                        <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
                        <span className="hidden xs:inline sm:inline">Admin Controls</span>
                        <span className="xs:hidden sm:hidden">Admin</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedMember;
                            setSelectedMember(null);
                            setEditingMember(target);
                          }}
                          className="py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors active:scale-95 whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#74c69d]" />
                          <span>Edit Info & Role</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedMember;
                            setSelectedMember(null);
                            setConfirmModal({
                              member: target,
                              type: 'delete',
                            });
                          }}
                          className="py-1.5 sm:py-2 px-3 sm:px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors active:scale-95 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-200" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <ModalPortal>
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md"
              onClick={(e) => {
                if (e.target === e.currentTarget) setAddModalOpen(false);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-lg sm:max-w-2xl max-h-[82dvh] sm:max-h-[78dvh] flex flex-col rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-2xl text-[#2d3a3a] overflow-hidden my-auto"
              >
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#e2ece2] bg-[#f7f9f7] shrink-0">
                  <div>
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-lg">
                      Register New Club Member
                    </h3>
                    <p className="text-[10.5px] sm:text-xs text-[#52605d]">
                      Enter member personal, emergency contact, and motorcycle registration details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="p-1.5 sm:p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-stone-200 cursor-pointer shrink-0 transition-colors"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 overscroll-contain pr-2 scroll-smooth">
                  <MemberRegistrationForm
                    isAdminCreation={true}
                    onSuccess={() => {
                      setAddModalOpen(false);
                      refreshList();
                    }}
                    onCancel={() => setAddModalOpen(false)}
                  />
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>



      {/* Floating Action Dropdown Menu Overlay */}
      {openDropdownId && dropdownPos && activeDropdownMember && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10"
            onClick={(e) => {
              e.stopPropagation();
              setOpenDropdownId(null);
              setDropdownPos(null);
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              right: `${dropdownPos.right}px`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-56 rounded-2xl bg-white border border-[#e2ece2] shadow-2xl z-50 overflow-hidden py-1.5 text-left"
          >
            {activeDropdownMember.approvalStatus === 'Pending' ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = activeDropdownMember;
                    setOpenDropdownId(null);
                    setDropdownPos(null);
                    setReviewingPendingUser(target);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Review Application</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = activeDropdownMember;
                    setOpenDropdownId(null);
                    setDropdownPos(null);
                    setConfirmModal({ type: 'approve', member: target });
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2.5 cursor-pointer transition-colors border-t border-[#f0f4f1]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Approve Member</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = activeDropdownMember;
                    setOpenDropdownId(null);
                    setDropdownPos(null);
                    setConfirmModal({ type: 'reject', member: target });
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer transition-colors border-t border-[#f0f4f1]"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Reject Application</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = activeDropdownMember;
                    setOpenDropdownId(null);
                    setDropdownPos(null);
                    setSelectedMember(target);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <UserCheck className="w-4 h-4 text-[#2d6a4f]" />
                  <span>View Profile</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const target = activeDropdownMember;
                      setOpenDropdownId(null);
                      setDropdownPos(null);
                      setEditingMember(target);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#1b4332] hover:bg-[#d8f3dc] flex items-center gap-2.5 cursor-pointer transition-colors border-t border-[#f0f4f1]"
                  >
                    <Pencil className="w-4 h-4 text-[#2d6a4f]" />
                    <span>Edit Info & Role</span>
                  </button>
                )}
                {isAdmin && currentUser.id !== activeDropdownMember.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const target = activeDropdownMember;
                      setOpenDropdownId(null);
                      setDropdownPos(null);
                      if (target) {
                        setConfirmModal({ type: 'delete', member: target });
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer transition-colors border-t border-[#f0f4f1]"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Delete Member</span>
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Review Application Modal (Muted Read-Only Form) */}
      <AnimatePresence>
        {reviewingPendingUser && (
          <ModalPortal>
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md"
              onClick={(e) => {
                if (e.target === e.currentTarget) setReviewingPendingUser(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-lg sm:max-w-2xl max-h-[82dvh] sm:max-h-[78dvh] flex flex-col rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] shadow-2xl text-[#2d3a3a] overflow-hidden my-auto"
              >
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#e2ece2] bg-[#f7f9f7] shrink-0">
                  <div className="min-w-0 pr-2">
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-lg truncate">
                      Review Application: {reviewingPendingUser.name}
                    </h3>
                    <p className="text-[10.5px] sm:text-xs text-[#52605d] mt-0.5 truncate">
                      Applicant details are displayed in read-only mode for review.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewingPendingUser(null)}
                    className="p-1.5 sm:p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-stone-200 cursor-pointer shrink-0 transition-colors"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-3 sm:p-5 space-y-4 overscroll-contain pr-2 scroll-smooth">
                  <MemberRegistrationForm
                    initialData={reviewingPendingUser}
                    isReadOnly={true}
                  />
                </div>

                {/* Action bar inside review modal */}
                <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-t border-[#e2ece2] bg-[#f7f9f7] shrink-0">
                  <button
                    type="button"
                    onClick={() => setReviewingPendingUser(null)}
                    className="py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-white font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({ type: 'reject', member: reviewingPendingUser });
                      }}
                      className="py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({ type: 'approve', member: reviewingPendingUser });
                      }}
                      className="py-1.5 sm:py-2 px-3.5 sm:px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* Edit Active Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onSave={async (updatedUser) => {
              await runWithLoader(
                async () => {
                  store.updateUser(updatedUser);
                  refreshList();
                  setEditingMember(null);
                },
                {
                  message: 'Saving Profile Changes & Refreshing...',
                }
              );
            }}
            onClose={() => setEditingMember(null)}
          />
        )}
      </AnimatePresence>

      {/* Action Confirmation Modal (Approve / Reject / Delete) */}
      <AnimatePresence>
        {confirmModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl bg-white border border-[#e2ece2] p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-2xl text-[#2d3a3a] my-auto"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 pb-2.5 sm:pb-3 border-b border-[#e2ece2]">
                  <div
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${
                      confirmModal.type === 'approve'
                        ? 'bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7]'
                        : 'bg-rose-100 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {confirmModal.type === 'approve' ? (
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#2d6a4f]" />
                    ) : (
                      <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-base sm:text-lg leading-tight">
                      {confirmModal.type === 'approve'
                        ? 'Confirm Approval'
                        : confirmModal.type === 'delete'
                        ? 'Delete Member'
                        : 'Reject Application'}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#52605d]">
                      {confirmModal.type === 'approve'
                        ? 'Approve & activate membership'
                        : confirmModal.type === 'delete'
                        ? 'Permanently remove record'
                        : 'Reject pending application'}
                    </p>
                  </div>
                </div>

                {/* Member Summary Card */}
                <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex items-center gap-2.5 sm:gap-3">
                  <img
                    src={confirmModal.member.avatar || DEFAULT_AVATAR}
                    alt={confirmModal.member.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-[#2d6a4f] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[#1b4332] text-xs sm:text-sm truncate">
                      {confirmModal.member.name}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-[#52605d] truncate">
                      {confirmModal.member.email} • {confirmModal.member.phone || 'No phone'}
                    </p>
                    <p className="text-[10px] text-[#2d6a4f] font-semibold mt-0.5 truncate">
                      Bike: {confirmModal.member.bikeInfo?.make || 'Yamaha'} {confirmModal.member.bikeInfo?.model || ''}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#52605d] leading-relaxed">
                  {confirmModal.type === 'approve' ? (
                    <>
                      Approve <strong>{confirmModal.member.name}</strong>? Member will be activated and an approval email sent to{' '}
                      <strong className="text-[#1b4332]">{confirmModal.member.email || 'member'}</strong>.
                    </>
                  ) : confirmModal.type === 'delete' ? (
                    <>
                      Permanently delete <strong>{confirmModal.member.name}</strong> from the club directory?
                    </>
                  ) : (
                    <>
                      Reject application for <strong>{confirmModal.member.name}</strong>? A status notification email will be sent to{' '}
                      <strong className="text-rose-700">{confirmModal.member.email || 'applicant'}</strong>.
                    </>
                  )}
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-gray-100 font-bold text-xs cursor-pointer transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>

                  {confirmModal.type === 'approve' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = confirmModal.member.id;
                        handleApproveMember(targetId);
                        setConfirmModal(null);
                        if (reviewingPendingUser?.id === targetId) {
                          setReviewingPendingUser(null);
                        }
                      }}
                      className="py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                      <span>Approve</span>
                    </button>
                  ) : confirmModal.type === 'delete' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const targetId = confirmModal.member.id;
                        setConfirmModal(null);
                        if (selectedMember?.id === targetId) {
                          setSelectedMember(null);
                        }
                        if (reviewingPendingUser?.id === targetId) {
                          setReviewingPendingUser(null);
                        }
                        await runWithLoader(
                          async () => {
                            store.deleteUser(targetId);
                            refreshList();
                          },
                          {
                            message: 'Deleting Member Record & Refreshing...',
                            onComplete: () => {
                              setSyncStatusMsg({
                                type: 'success',
                                text: 'Member record deleted.',
                              });
                              setTimeout(() => {
                                setSyncStatusMsg(null);
                              }, 2000);
                            },
                          }
                        );
                      }}
                      className="py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4 text-rose-200" />
                      <span>Delete</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = confirmModal.member.id;
                        handleRejectMember(targetId);
                        setConfirmModal(null);
                        if (reviewingPendingUser?.id === targetId) {
                          setReviewingPendingUser(null);
                        }
                      }}
                      className="py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4 text-rose-200" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </ModalPortal>
        )}
      </AnimatePresence>
    </div>
  );
};
