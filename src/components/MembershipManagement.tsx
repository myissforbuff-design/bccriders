import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store } from '../lib/db';
import { User, MembershipType } from '../types';
import { MemberRegistrationForm } from './MemberRegistrationForm';
import { EditMemberModal } from './EditMemberModal';
import { RoleAvatarBadge } from './RoleAvatarBadge';
import {
  Users,
  Search,
  Plus,
  ShieldCheck,
  Phone,
  Mail,
  Bike,
  Calendar,
  Download,
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

interface MembershipManagementProps {
  onOpenDuesModal?: () => void;
}

const DEFAULT_AVATAR = '/avatar.svg';

export const MembershipManagement: React.FC<MembershipManagementProps> = ({ onOpenDuesModal }) => {
  const { currentUser, isAdmin, refreshUserData } = useAuth();
  const [members, setMembers] = useState<User[]>(() =>
    store.getUsers().filter((m) => m.role !== 'admin')
  );
  const [search, setSearch] = useState('');

  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [actionDropdownOpen, setActionDropdownOpen] = useState(false);
  const [rosterTab, setRosterTab] = useState<'active' | 'pending'>('active');
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

  const handleApproveMember = (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    if (target) {
      target.approvalStatus = 'Approved';
      if (!target.memberNumber || target.memberNumber === 'BCC-MEMBER' || target.memberNumber === 'BRC-MEMBER' || target.memberNumber.startsWith('BCC-') || target.memberNumber === 'Pending') {
        const approvedCount = members.filter((m) => m.approvalStatus === 'Approved').length;
        target.memberNumber = `BRC-${String(approvedCount + 1).padStart(4, '0')}`;
      }
      store.approveRegistration(target);
      refreshList();
      setRosterTab('active');
      setSyncStatusMsg({
        type: 'success',
        text: 'Member is accepted',
      });
      setTimeout(() => {
        setSyncStatusMsg(null);
      }, 2000);
    }
  };

  const handleRejectMember = (memberId: string) => {
    const target = members.find((m) => m.id === memberId);
    const memberName = target?.name || 'Applicant';
    store.deleteUser(memberId);
    refreshList();
    setSyncStatusMsg({
      type: 'success',
      text: `Application for "${memberName}" has been rejected and removed from pending requests.`,
    });
    setTimeout(() => {
      setSyncStatusMsg(null);
    }, 2000);
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

  const exportCSV = () => {
    const headers = [
      'Member Number',
      'Full Name',
      'First Name',
      'Last Name',
      'Username',
      'Email',
      'Phone',
      'Mobile No',
      'Role',
      'Membership Type',
      'Approval Status',
      'Join Date',
      'Birthdate',
      'Age',
      'Gender',
      'Civil Status',
      'Address',
      'Occupation',
      'Occupation Status',
      'Life Insurance',
      'Network',
      'Chapter',
      'Leaders Name',
      'Leaders Contact No',
      'Affiliation',
      'License No',
      'License Expiry Date',
      'Riding Experience',
      'Rider Type',
      'Reason For Joining',
      'Recommended By',
      'Declaration Date',
      'Bio',
      'Emergency Contact Name',
      'Emergency Contact Relationship',
      'Emergency Contact Phone',
      'Motorcycle Make',
      'Motorcycle Model',
      'Motorcycle Year',
      'Engine CC',
      'Engine No',
      'Chassis No',
      'CR No',
      'OR No',
      'OR Expiry Date',
      'Plate No',
      'Color',
      'Condition',
      'Years In Service',
      'Restriction Codes',
      'LTO Conditions',
    ];

    const escapeCSV = (val: any): string => {
      if (val === undefined || val === null) return '""';
      let str = '';
      if (Array.isArray(val)) {
        str = val.join('; ');
      } else if (typeof val === 'object') {
        str = JSON.stringify(val);
      } else {
        str = String(val);
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = members.map((m) => [
      escapeCSV(m.memberNumber),
      escapeCSV(m.name),
      escapeCSV(m.firstName || ''),
      escapeCSV(m.lastName || ''),
      escapeCSV(m.username),
      escapeCSV(m.email),
      escapeCSV(m.phone),
      escapeCSV(m.mobileNo || ''),
      escapeCSV(m.role),
      escapeCSV(m.membershipType || 'Standard'),
      escapeCSV(m.approvalStatus || 'Approved'),
      escapeCSV(m.joinDate),
      escapeCSV(m.birthdate || ''),
      escapeCSV(m.age ?? ''),
      escapeCSV(m.gender || ''),
      escapeCSV(m.civilStatus || ''),
      escapeCSV(m.address || ''),
      escapeCSV(m.occupation || ''),
      escapeCSV(m.occupationStatus || ''),
      escapeCSV(m.lifeInsurance || ''),
      escapeCSV(m.network || ''),
      escapeCSV(m.chapter || ''),
      escapeCSV(m.leadersName || ''),
      escapeCSV(m.leadersContactNo || ''),
      escapeCSV(m.affiliation || ''),
      escapeCSV(m.licenseNo || ''),
      escapeCSV(m.licenseExpiryDate || ''),
      escapeCSV(m.ridingExperience || ''),
      escapeCSV(m.riderType || ''),
      escapeCSV(m.reasonForJoining || ''),
      escapeCSV(m.recommendedBy || ''),
      escapeCSV(m.declarationDate || ''),
      escapeCSV(m.bio || ''),
      escapeCSV(m.emergencyContact?.name || ''),
      escapeCSV(m.emergencyContact?.relationship || ''),
      escapeCSV(m.emergencyContact?.phone || ''),
      escapeCSV(m.bikeInfo?.make || ''),
      escapeCSV(m.bikeInfo?.model || ''),
      escapeCSV(m.bikeInfo?.year || ''),
      escapeCSV(m.bikeInfo?.engineCc || ''),
      escapeCSV(m.bikeInfo?.engineNo || ''),
      escapeCSV(m.bikeInfo?.chassisNo || ''),
      escapeCSV(m.bikeInfo?.crNo || ''),
      escapeCSV(m.bikeInfo?.orNo || ''),
      escapeCSV(m.bikeInfo?.orExpiryDate || ''),
      escapeCSV(m.bikeInfo?.plateNo || m.bikeInfo?.licensePlate || ''),
      escapeCSV(m.bikeInfo?.color || ''),
      escapeCSV(m.bikeInfo?.condition || ''),
      escapeCSV(m.bikeInfo?.yearsInService || ''),
      escapeCSV(m.bikeInfo?.restrictionCodes || m.bikeInfo?.licenseRestrictionCode || ''),
      escapeCSV(m.bikeInfo?.ltoConditions || m.bikeInfo?.conditionCode || ''),
    ]);

    const csvString = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `club_members_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

      {/* Roster & Pending Approvals Tab Selector */}
      <div className="flex items-center gap-2 border-b border-[#e2ece2] pb-2 overflow-x-auto">
        <button
          onClick={() => setRosterTab('active')}
          className={`py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
            rosterTab === 'active'
              ? 'bg-[#1b4332] text-white shadow-xs'
              : 'bg-white text-[#52605d] hover:bg-[#f7f9f7] border border-[#e2ece2]'
          }`}
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="sm:hidden">Members</span>
          <span className="hidden sm:inline">Active Member</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#d8f3dc] text-[#1b4332] text-[10px] font-extrabold">
            {activeMembersList.length}
          </span>
        </button>

        <button
          onClick={() => setRosterTab('pending')}
          className={`py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl text-[11px] sm:text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 shrink-0 ${
            rosterTab === 'pending'
              ? 'bg-[#1b4332] text-white shadow-xs'
              : 'bg-white text-[#52605d] hover:bg-[#f7f9f7] border border-[#e2ece2]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
          <span className="sm:hidden">Pending</span>
          <span className="hidden sm:inline">Pending Approvals</span>
          {pendingMembersList.length > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold animate-pulse">
              {pendingMembersList.length}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-[#52605d] text-[10px] font-bold">
              0
            </span>
          )}
        </button>
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
                        exportCSV();
                        setActionDropdownOpen(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-[#1b4332] hover:bg-[#f7f9f7] flex items-center gap-2.5 cursor-pointer font-bold transition-colors"
                    >
                      <Download className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      <span>Export CSV</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl rounded-3xl bg-white border border-[#e2ece2] shadow-2xl overflow-hidden my-8 text-[#2d3a3a]"
            >
              <div className="p-6 bg-[#f7f9f7] border-b border-[#e2ece2] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0 inline-block">
                    <img
                      src={selectedMember.avatar || DEFAULT_AVATAR}
                      alt={selectedMember.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                      }}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#2d6a4f]"
                    />
                    <RoleAvatarBadge role={selectedMember.role} size="md" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-[#1b4332] text-lg">
                      {selectedMember.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Member Role Card */}
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#52605d] uppercase tracking-wider font-bold">
                      Club Membership Info
                    </span>
                    <p className="text-xs text-[#52605d] mt-1">
                      Member ID: <strong className="text-[#2d6a4f]">#{selectedMember.memberNumber}</strong>
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-[#d8f3dc] text-[#1b4332]">
                    {selectedMember.approvalStatus || 'Approved'}
                  </span>
                </div>

                {/* Contact & Personal Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2">
                    <span className="text-[#52605d] font-bold block">Personal & License Info</span>
                    <p className="text-[#2d3a3a] flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                      {selectedMember.email}
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
                  </div>

                  {(selectedMember.network || selectedMember.chapter || selectedMember.leadersName || selectedMember.leadersContactNo) && (
                    <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2 col-span-1 sm:col-span-2">
                      <span className="text-[#52605d] font-bold block">Church & Leadership Info</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#52605d]">
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

                  <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2">
                    <span className="text-[#52605d] font-bold block">Emergency Contact</span>
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
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-3">
                  <span className="text-xs font-bold text-[#1b4332] flex items-center gap-2">
                    <Bike className="w-4 h-4 text-[#2d6a4f]" />
                    Motorcycle Specifications & Documents
                  </span>

                  {/* Motorcycle Photo Display */}
                  <div className="rounded-2xl overflow-hidden border border-[#e2ece2] bg-stone-900 relative shadow-xs group">
                    <img
                      src={
                        selectedMember.bikeInfo.photoUrl ||
                        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=800'
                      }
                      alt={`${selectedMember.bikeInfo.make || 'Motorcycle'} ${selectedMember.bikeInfo.model || ''}`}
                      className="w-full h-48 sm:h-56 object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=800';
                      }}
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-[#1b4332]/90 backdrop-blur-md text-white text-[11px] font-extrabold tracking-wide flex items-center gap-1.5 shadow-md border border-white/20">
                      <Bike className="w-3.5 h-3.5 text-[#74c69d]" />
                      <span>{selectedMember.bikeInfo.make} {selectedMember.bikeInfo.model}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                      <span className="text-[10px] text-[#52605d] block">Make</span>
                      <strong className="text-[#1b4332]">{selectedMember.bikeInfo.make}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                      <span className="text-[10px] text-[#52605d] block">Model</span>
                      <strong className="text-[#1b4332]">{selectedMember.bikeInfo.model}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                      <span className="text-[10px] text-[#52605d] block">Engine No.</span>
                      <strong className="text-[#1b4332]">{selectedMember.bikeInfo.engineNo || 'N/A'}</strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                      <span className="text-[10px] text-[#52605d] block">Chassis No.</span>
                      <strong className="text-[#2d6a4f]">{selectedMember.bikeInfo.chassisNo || 'N/A'}</strong>
                    </div>
                  </div>

                  {(selectedMember.bikeInfo.plateNo || selectedMember.bikeInfo.licensePlate || selectedMember.bikeInfo.crNo || selectedMember.bikeInfo.orNo || selectedMember.bikeInfo.orExpiryDate) && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#e2ece2]">
                      <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[10px] text-[#52605d] block">Plate No.</span>
                        <strong className="text-[#1b4332] font-mono break-all">{selectedMember.bikeInfo.plateNo || selectedMember.bikeInfo.licensePlate || 'N/A'}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[10px] text-[#52605d] block">CR No.</span>
                        <strong className="text-[#1b4332] font-mono break-all">{selectedMember.bikeInfo.crNo || 'N/A'}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[10px] text-[#52605d] block">OR No.</span>
                        <strong className="text-[#1b4332] font-mono break-all">{selectedMember.bikeInfo.orNo || 'N/A'}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-[#e2ece2]">
                        <span className="text-[10px] text-[#52605d] block">OR Exp. Date</span>
                        <strong className="text-[#2d6a4f] font-mono break-all">{selectedMember.bikeInfo.orExpiryDate || 'N/A'}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Quick Override Buttons */}
                {isAdmin && (
                  <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-[#1b4332] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#2d6a4f]" />
                        Admin Controls
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const target = selectedMember;
                            setSelectedMember(null);
                            setEditingMember(target);
                          }}
                          className="py-1.5 px-3.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#74c69d]" />
                          <span>Edit Info & Role</span>
                        </button>
                        <button
                          onClick={() => {
                            const target = selectedMember;
                            setSelectedMember(null);
                            setConfirmModal({
                              member: target,
                              type: 'delete',
                            });
                          }}
                          className="py-1.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-200" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Member Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl text-[#2d3a3a] my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2] sticky top-0 bg-white z-10">
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-xl">
                    Register New Club Member
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Enter member personal, emergency contact, and motorcycle registration details.
                  </p>
                </div>
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <MemberRegistrationForm
                isAdminCreation={true}
                onSuccess={() => {
                  setAddModalOpen(false);
                  refreshList();
                }}
                onCancel={() => setAddModalOpen(false)}
              />
            </motion.div>
          </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl text-[#2d3a3a] my-8 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2] shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-[#1b4332] text-xl">
                      Review Application: {reviewingPendingUser.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[#52605d] mt-0.5">
                    Applicant details are displayed in read-only mode to prevent accidental edits during review.
                  </p>
                </div>
                <button
                  onClick={() => setReviewingPendingUser(null)}
                  className="p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-4">
                <MemberRegistrationForm
                  initialData={reviewingPendingUser}
                  isReadOnly={true}
                />
              </div>

              {/* Action bar inside review modal */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#e2ece2] shrink-0">
                <button
                  type="button"
                  onClick={() => setReviewingPendingUser(null)}
                  className="py-2.5 px-5 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-gray-100 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal({ type: 'reject', member: reviewingPendingUser });
                    }}
                    className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal({ type: 'approve', member: reviewingPendingUser });
                    }}
                    className="py-2.5 px-5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Active Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onSave={(updatedUser) => {
              store.updateUser(updatedUser);
              refreshList();
              setEditingMember(null);
            }}
            onClose={() => setEditingMember(null)}
          />
        )}
      </AnimatePresence>

      {/* Action Confirmation Modal (Approve / Reject) */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl text-[#2d3a3a]"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#e2ece2]">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    confirmModal.type === 'approve'
                      ? 'bg-[#d8f3dc] text-[#1b4332] border border-[#b7e4c7]'
                      : 'bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  {confirmModal.type === 'approve' ? (
                    <CheckCircle2 className="w-6 h-6 text-[#2d6a4f]" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-[#1b4332] text-lg">
                    {confirmModal.type === 'approve'
                      ? 'Confirm Approval'
                      : confirmModal.type === 'delete'
                      ? 'Confirm Member Deletion'
                      : 'Confirm Rejection'}
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    {confirmModal.type === 'approve'
                      ? 'Approve application & activate membership'
                      : confirmModal.type === 'delete'
                      ? 'Permanently delete member record from database'
                      : 'Reject & remove registration request'}
                  </p>
                </div>
              </div>

              {/* Member Summary Card */}
              <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] flex items-center gap-3">
                <img
                  src={confirmModal.member.avatar || DEFAULT_AVATAR}
                  alt={confirmModal.member.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                  }}
                  className="w-11 h-11 rounded-full object-cover border-2 border-[#2d6a4f]"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-[#1b4332] text-xs truncate">
                    {confirmModal.member.name}
                  </h4>
                  <p className="text-[11px] text-[#52605d] truncate">
                    {confirmModal.member.email} • {confirmModal.member.phone || 'No phone'}
                  </p>
                  <p className="text-[10px] text-[#2d6a4f] font-semibold mt-0.5">
                    Bike: {confirmModal.member.bikeInfo?.make || 'Yamaha'} {confirmModal.member.bikeInfo?.model || ''}
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#52605d] leading-relaxed">
                {confirmModal.type === 'approve' ? (
                  <>
                    Are you sure you want to approve <strong>{confirmModal.member.name}</strong>?
                    Upon confirmation, their application will be approved and they will be moved to the{' '}
                    <strong className="text-[#1b4332]">Active Members</strong> roster.
                  </>
                ) : confirmModal.type === 'delete' ? (
                  <>
                    Are you sure you want to delete <strong>{confirmModal.member.name}</strong> from the club directory?
                    This will permanently remove their profile and database record.
                  </>
                ) : (
                  <>
                    Are you sure you want to reject <strong>{confirmModal.member.name}</strong>'s
                    application? This will permanently delete their pending request.
                  </>
                )}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="py-2.5 px-4 rounded-xl border border-[#e2ece2] text-[#52605d] hover:bg-gray-100 font-bold text-xs cursor-pointer transition-colors"
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
                    className="py-2.5 px-5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                    <span>Confirm & Move to Active</span>
                  </button>
                ) : confirmModal.type === 'delete' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = confirmModal.member.id;
                      store.deleteUser(targetId);
                      refreshList();
                      setConfirmModal(null);
                      if (selectedMember?.id === targetId) {
                        setSelectedMember(null);
                      }
                      if (reviewingPendingUser?.id === targetId) {
                        setReviewingPendingUser(null);
                      }
                    }}
                    className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-rose-200" />
                    <span>Yes, Delete Member</span>
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
                    className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-rose-200" />
                    <span>Yes, Reject Application</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
