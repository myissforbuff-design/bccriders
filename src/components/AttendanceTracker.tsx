import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { OfficialDotSpinner } from './OfficialLoader';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  Calendar,
  X,
  Users,
  Percent,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Award,
  AlertCircle,
  ArrowUpDown,
  Filter,
  ChevronDown,
  Check,
} from 'lucide-react';

export interface Attendance {
  name: string;
  memberId: string;
  network: string;
  date: string;
  time: string;
  avatar?: string;
}

export interface Activity {
  id: string;
  name: string;
  date: string;
  status: 'Open' | 'Closed';
  attendance: Attendance[];
}

export interface AttendanceLogDoc {
  id: string;
  'Event Name'?: string;
  'Event Date'?: string;
  'Member ID'?: string;
  'Last Name'?: string;
  'First Name'?: string;
  'Network'?: string;
  'Date Stamp'?: string;
  'Time Stamp'?: string;
  eventName?: string;
  eventDate?: string;
  memberId?: string;
  lastName?: string;
  firstName?: string;
  network?: string;
  dateStamp?: string;
  timeStamp?: string;
  createdAt?: string;
  'Activity ID'?: string;
  activityId?: string;
  [key: string]: any;
}

interface AttendanceTrackerProps {
  activities: Activity[];
  attendanceLogs: AttendanceLogDoc[];
  users: User[];
  isLoading?: boolean;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  activities,
  attendanceLogs,
  users,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [performanceFilter, setPerformanceFilter] = useState<'All' | 'Perfect' | 'High' | 'Low' | 'Needs Attention'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'id' | 'present' | 'absent' | 'rate'>('present');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [modalEventFilter, setModalEventFilter] = useState<'All' | 'Present' | 'Absent' | 'Upcoming'>('All');
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Interactive Dropdown States
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setIsRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortOptions: {
    value: 'present' | 'absent' | 'rate' | 'name' | 'id';
    label: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    { value: 'present', label: 'Most Present', description: 'Highest attendance counts', icon: TrendingUp },
    { value: 'absent', label: 'Most Absent', description: 'Most missed activity events', icon: XCircle },
    { value: 'rate', label: 'Highest Rate (%)', description: 'Best compliance percentage', icon: Percent },
    { value: 'name', label: 'Name (A-Z)', description: 'Alphabetical rider order', icon: Users },
    { value: 'id', label: 'Member ID', description: 'Sequential club roster ID', icon: Award },
  ];

  const currentSortOption = sortOptions.find((opt) => opt.value === sortBy) || sortOptions[0];
  const CurrentSortIcon = currentSortOption.icon;

  useModalDismiss(Boolean(selectedMember), () => setSelectedMember(null));

  // Helper to determine single member's status for a given activity
  const getMemberRecordForActivity = (activity: Activity, user: User) => {
    const memNo = (user.memberNumber || '').toLowerCase().trim();
    const userId = (user.id || '').toLowerCase().trim();
    const userName = (user.name || '').toLowerCase().trim();
    const userUsername = (user.username || '').toLowerCase().trim();
    const actNameLower = activity.name.toLowerCase().trim();

    // 1. Search in MongoDB attendanceLogs
    const logMatch = attendanceLogs.find((log) => {
      const eName = (log['Event Name'] || log.eventName || '').toLowerCase().trim();
      if (eName !== actNameLower) return false;

      const logMemId = (log['Member ID'] || log.memberId || '').toLowerCase().trim();
      if (logMemId && (logMemId === memNo || logMemId === userId)) return true;

      const firstName = (log['First Name'] || log.firstName || '').toLowerCase().trim();
      const lastName = (log['Last Name'] || log.lastName || '').toLowerCase().trim();
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName && (fullName === userName || fullName.includes(userName) || userName.includes(fullName))) return true;

      return false;
    });

    if (logMatch) {
      const dateStamp = logMatch['Date Stamp'] || logMatch.dateStamp || logMatch['Event Date'] || activity.date;
      const timeStamp = logMatch['Time Stamp'] || logMatch.timeStamp || 'Recorded';
      return {
        attended: true,
        timestamp: `${dateStamp} ${timeStamp}`.trim(),
        dateStamp,
        timeStamp,
        isFinished: true,
      };
    }

    // 2. Search in activity.attendance array
    if (activity.attendance && activity.attendance.length > 0) {
      const attMatch = activity.attendance.find((att) => {
        const attMemId = (att.memberId || '').toLowerCase().trim();
        if (attMemId && (attMemId === memNo || attMemId === userId)) return true;

        const attName = (att.name || '').toLowerCase().trim();
        if (attName && (attName === userName || attName === userUsername)) return true;

        return false;
      });

      if (attMatch) {
        return {
          attended: true,
          timestamp: `${attMatch.date || activity.date} ${attMatch.time || ''}`.trim(),
          dateStamp: attMatch.date || activity.date,
          timeStamp: attMatch.time || 'Recorded',
          isFinished: true,
        };
      }
    }

    // Determine if event is finished
    let isFinished = activity.status === 'Closed';
    if (!isFinished && activity.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(activity.date);
      if (!isNaN(eventDate.getTime())) {
        eventDate.setHours(23, 59, 59, 999);
        if (eventDate < today) {
          isFinished = true;
        }
      }
    }

    return {
      attended: false,
      timestamp: null,
      dateStamp: null,
      timeStamp: null,
      isFinished,
    };
  };

  // Compile member stats
  const memberStatsList = useMemo(() => {
    return users.map((u) => {
      const activityRecords = activities.map((act) => ({
        activity: act,
        record: getMemberRecordForActivity(act, u),
      }));

      const totalEvents = activityRecords.length;
      const presentCount = activityRecords.filter((item) => item.record.attended).length;
      const absentCount = activityRecords.filter((item) => !item.record.attended && item.record.isFinished).length;
      const upcomingCount = activityRecords.filter((item) => !item.record.attended && !item.record.isFinished).length;
      const finishedEventsCount = presentCount + absentCount;
      const attendanceRate = finishedEventsCount > 0 ? Math.round((presentCount / finishedEventsCount) * 100) : 0;

      return {
        user: u,
        activityRecords,
        totalEvents,
        presentCount,
        absentCount,
        upcomingCount,
        finishedEventsCount,
        attendanceRate,
      };
    });
  }, [users, activities, attendanceLogs]);

  // Overall Global Summary Stats
  const globalSummary = useMemo(() => {
    const totalMembers = memberStatsList.length;
    const totalEvents = activities.length;
    const totalPresentScans = memberStatsList.reduce((acc, m) => acc + m.presentCount, 0);
    const totalAbsences = memberStatsList.reduce((acc, m) => acc + m.absentCount, 0);
    const avgRate = totalMembers > 0
      ? Math.round(memberStatsList.reduce((acc, m) => acc + m.attendanceRate, 0) / totalMembers)
      : 0;

    return {
      totalMembers,
      totalEvents,
      totalPresentScans,
      totalAbsences,
      avgRate,
    };
  }, [memberStatsList, activities]);

  // Extract unique roles for filter dropdown
  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.role) set.add(u.role);
    });
    return Array.from(set);
  }, [users]);

  // Filtered & Sorted Members
  const filteredMembers = useMemo(() => {
    return memberStatsList
      .filter(({ user, attendanceRate, presentCount, absentCount }) => {
        // Search term
        const q = searchTerm.toLowerCase().trim();
        if (q) {
          const matchName = user.name?.toLowerCase().includes(q);
          const matchId = user.memberNumber?.toLowerCase().includes(q) || user.id?.toLowerCase().includes(q);
          const matchRole = user.role?.toLowerCase().includes(q);
          const matchNetwork = user.network?.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchRole && !matchNetwork) return false;
        }

        // Role filter
        if (roleFilter !== 'All' && user.role !== roleFilter) {
          return false;
        }

        // Performance filter
        if (performanceFilter === 'Perfect' && (attendanceRate < 100 || presentCount === 0)) return false;
        if (performanceFilter === 'High' && (attendanceRate < 75 || attendanceRate === 100)) return false;
        if (performanceFilter === 'Low' && (attendanceRate >= 75 || attendanceRate < 40)) return false;
        if (performanceFilter === 'Needs Attention' && (attendanceRate >= 40 && absentCount > 0)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'present') return b.presentCount - a.presentCount;
        if (sortBy === 'absent') return b.absentCount - a.absentCount;
        if (sortBy === 'rate') return b.attendanceRate - a.attendanceRate;
        if (sortBy === 'id') return (a.user.memberNumber || '').localeCompare(b.user.memberNumber || '');
        return (a.user.name || '').localeCompare(b.user.name || '');
      });
  }, [memberStatsList, searchTerm, roleFilter, performanceFilter, sortBy]);

  // Selected member details data for modal
  const selectedMemberStats = useMemo(() => {
    if (!selectedMember) return null;
    return memberStatsList.find((m) => m.user.id === selectedMember.id) || null;
  }, [selectedMember, memberStatsList]);

  // Filtered activities inside member modal
  const modalFilteredActivities = useMemo(() => {
    if (!selectedMemberStats) return [];
    return selectedMemberStats.activityRecords.filter(({ activity, record }) => {
      const q = modalSearchTerm.toLowerCase().trim();
      if (q && !activity.name.toLowerCase().includes(q) && !activity.date.includes(q)) {
        return false;
      }
      if (modalEventFilter === 'Present') return record.attended;
      if (modalEventFilter === 'Absent') return !record.attended && record.isFinished;
      if (modalEventFilter === 'Upcoming') return !record.attended && !record.isFinished;
      return true;
    });
  }, [selectedMemberStats, modalSearchTerm, modalEventFilter]);

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Top Global Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        <div className="bg-white p-2.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border border-[#e2ece2] shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-[#52605d]">
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">Total Members</span>
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2d6a4f]" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#1b4332]">{globalSummary.totalMembers}</div>
          <div className="text-[9.5px] sm:text-[11px] text-[#52605d] font-semibold truncate">{globalSummary.totalEvents} Activities Recorded</div>
        </div>

        <div className="bg-emerald-50/70 p-2.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border border-emerald-200/80 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">Total Present</span>
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-900">{globalSummary.totalPresentScans}</div>
          <div className="text-[9.5px] sm:text-[11px] text-emerald-700 font-semibold truncate">Active attendances logged</div>
        </div>

        <div className="bg-rose-50/70 p-2.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border border-rose-200/80 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">Total Absences</span>
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-900">{globalSummary.totalAbsences}</div>
          <div className="text-[9.5px] sm:text-[11px] text-rose-700 font-semibold truncate">Missed completed events</div>
        </div>

        <div className="bg-emerald-800 text-white p-2.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border border-emerald-900 shadow-2xs space-y-0.5 sm:space-y-1">
          <div className="flex items-center justify-between text-emerald-200">
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider">Avg Attendance</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white">{globalSummary.avgRate}%</div>
          <div className="text-[9.5px] sm:text-[11px] text-emerald-100 font-semibold truncate">Overall club compliance</div>
        </div>
      </div>

      {/* Search, Filters, and Sorting Controls */}
      <div className="bg-white p-3 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl border border-[#e2ece2] shadow-xs space-y-2.5 sm:space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member by name, ID (e.g. BRC-0001), role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 border border-[#e2ece2] rounded-xl text-[11px] sm:text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Quick Selects (Role and Sort Interactive Dropdowns) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2.5">
            {/* Interactive Role Filter Dropdown */}
            <div className="relative min-w-0" ref={roleRef}>
              <button
                type="button"
                onClick={() => {
                  setIsRoleOpen(!isRoleOpen);
                  setIsSortOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer select-none ${
                  isRoleOpen
                    ? 'bg-white border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20 text-[#1b4332] shadow-xs'
                    : roleFilter !== 'All'
                    ? 'bg-emerald-50/80 border-emerald-300 text-[#1b4332]'
                    : 'bg-[#f7f9f7] hover:bg-stone-200/60 border-[#e2ece2] text-[#52605d] hover:text-[#1b4332]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Filter className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span className="text-[#52605d] font-semibold hidden xs:inline shrink-0">Role:</span>
                  <span className="font-extrabold text-[#1b4332] truncate">
                    {roleFilter === 'All' ? 'All Roles' : roleFilter}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
                    isRoleOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {isRoleOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-52 sm:w-56 bg-white rounded-2xl border border-[#e2ece2] shadow-xl p-1.5 z-40 max-h-60 overflow-y-auto"
                  >
                    <div className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[#52605d] border-b border-[#e2ece2] mb-1">
                      Filter By Role
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRoleFilter('All');
                        setIsRoleOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        roleFilter === 'All'
                          ? 'bg-[#1b4332] text-white font-bold'
                          : 'hover:bg-[#f7f9f7] text-[#1b4332]'
                      }`}
                    >
                      <span>All Roles</span>
                      {roleFilter === 'All' && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                    {uniqueRoles.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRoleFilter(r);
                          setIsRoleOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          roleFilter === r
                            ? 'bg-[#1b4332] text-white font-bold'
                            : 'hover:bg-[#f7f9f7] text-[#1b4332]'
                        }`}
                      >
                        <span className="truncate">{r}</span>
                        {roleFilter === r && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Interactive Sort Dropdown */}
            <div className="relative min-w-0" ref={sortRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSortOpen(!isSortOpen);
                  setIsRoleOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer select-none ${
                  isSortOpen
                    ? 'bg-white border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20 text-[#1b4332] shadow-xs'
                    : 'bg-[#f7f9f7] hover:bg-stone-200/60 border-[#e2ece2] text-[#52605d] hover:text-[#1b4332]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <CurrentSortIcon className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span className="text-[#52605d] font-semibold hidden xs:inline shrink-0">Sort:</span>
                  <span className="font-extrabold text-[#1b4332] truncate">
                    {currentSortOption.label}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#2d6a4f] shrink-0 transition-transform duration-200 ${
                    isSortOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {isSortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 w-60 sm:w-64 bg-white rounded-2xl border border-[#e2ece2] shadow-xl p-1.5 z-40 max-h-72 overflow-y-auto"
                  >
                    <div className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-[#52605d] border-b border-[#e2ece2] mb-1 flex items-center justify-between">
                      <span>Sort Members By</span>
                      <ArrowUpDown className="w-3 h-3 text-[#2d6a4f]" />
                    </div>
                    <div className="space-y-0.5">
                      {sortOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = sortBy === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setSortBy(opt.value);
                              setIsSortOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-[#1b4332] text-white shadow-xs'
                                : 'hover:bg-[#f7f9f7] text-[#2d3a3a]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-emerald-50 text-[#2d6a4f] border border-emerald-100'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-[#1b4332]'}`}>
                                  {opt.label}
                                </div>
                                <div className={`text-[10px] truncate ${isSelected ? 'text-emerald-200' : 'text-[#52605d]'}`}>
                                  {opt.description}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-white shrink-0 ml-1.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Quick Filter Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          <span className="text-[9.5px] sm:text-[11px] font-extrabold text-[#52605d] uppercase tracking-wider shrink-0 mr-0.5">
            Status:
          </span>
          {(['All', 'Perfect', 'High', 'Low', 'Needs Attention'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setPerformanceFilter(filter)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-extrabold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap ${
                performanceFilter === filter
                  ? 'bg-[#1b4332] text-white shadow-2xs'
                  : 'bg-[#f7f9f7] text-[#52605d] hover:bg-stone-200/70 border border-[#e2ece2]'
              }`}
            >
              {filter === 'Perfect' ? '🌟 100% Perfect' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* MEMBER CARDS GRID */}
      {isLoading ? (
        <div className="p-10 sm:p-16 text-center text-xs text-[#2d6a4f] bg-white rounded-2xl sm:rounded-3xl border border-[#e2ece2] flex flex-col items-center justify-center gap-3 shadow-2xs">
          <OfficialDotSpinner />
          <span className="font-extrabold text-[#1b4332] mt-2 text-xs">Loading member attendance records...</span>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="p-8 sm:p-12 text-center text-stone-500 bg-white rounded-2xl sm:rounded-3xl border border-[#e2ece2] space-y-1.5">
          <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-stone-400 mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-[#1b4332]">No member records found matching your filters</p>
          <p className="text-[11px] text-stone-500">Try adjusting your search keywords or filter options.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {filteredMembers.map(({ user, presentCount, absentCount, upcomingCount, attendanceRate, totalEvents }) => {
            const memberNumber = user.memberNumber || user.id || 'N/A';
            const role = user.role || 'Member';
            const network = user.network || 'Main Chapter';

            return (
              <div
                key={user.id}
                onClick={() => {
                  setSelectedMember(user);
                  setModalEventFilter('All');
                  setModalSearchTerm('');
                }}
                className="bg-white rounded-2xl sm:rounded-3xl border border-[#e2ece2] hover:border-[#74c69d] transition-all duration-200 overflow-hidden shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between group p-3 sm:p-4 md:p-5 hover:bg-[#f7f9f7]/50 active:scale-[0.99]"
              >
                <div className="space-y-2.5 sm:space-y-3.5">
                  {/* Card Header: Avatar & Details */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-100/70 border border-emerald-200 text-[#1b4332] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{(user.name || 'U').slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs sm:text-sm text-[#1b4332] group-hover:text-[#2d6a4f] transition-colors truncate">
                          {user.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-stone-500">
                          <span className="font-mono text-[#2d6a4f] font-bold">{memberNumber}</span>
                          <span>•</span>
                          <span className="truncate">{network}</span>
                        </div>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-[#f7f9f7] border border-[#e2ece2] text-[#1b4332] shrink-0">
                      {role}
                    </span>
                  </div>

                  {/* Attendance Performance Metric Badges */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-0.5">
                    {/* Present Badge */}
                    <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-800">
                        <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-[10px] sm:text-[11px] font-extrabold">Present</span>
                      </div>
                      <span className="font-black text-xs sm:text-sm text-emerald-900">{presentCount}</span>
                    </div>

                    {/* Absent Badge */}
                    <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl bg-rose-50/80 border border-rose-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-rose-800">
                        <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600 shrink-0" />
                        <span className="text-[10px] sm:text-[11px] font-extrabold">Absent</span>
                      </div>
                      <span className="font-black text-xs sm:text-sm text-rose-900">{absentCount}</span>
                    </div>
                  </div>

                  {/* Progress Bar & Rate */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
                      <span className="font-bold text-[#52605d]">Attendance Rate:</span>
                      <span
                        className={`font-black ${
                          attendanceRate >= 80
                            ? 'text-emerald-700'
                            : attendanceRate >= 50
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {attendanceRate}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 sm:h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          attendanceRate >= 80
                            ? 'bg-emerald-600'
                            : attendanceRate >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Action Hint */}
                <div className="pt-2.5 sm:pt-3.5 mt-2 sm:mt-3 border-t border-[#e2ece2] flex items-center justify-between text-[10px] sm:text-[11px] text-[#2d6a4f] font-extrabold group-hover:text-[#1b4332]">
                  <span>View detailed activity log</span>
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MEMBER ATTENDANCE BREAKDOWN MODAL */}
      {selectedMember && selectedMemberStats && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-5 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMember(null);
          }}
        >
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#e2ece2] w-full max-w-2xl lg:max-w-3xl max-h-[60dvh] sm:max-h-[72dvh] flex flex-col shadow-2xl overflow-hidden relative my-auto">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 border-b border-[#e2ece2] bg-[#f7f9f7] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-100 border border-emerald-200 text-[#1b4332] font-black text-xs sm:text-base flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {selectedMember.avatar ? (
                    <img
                      src={selectedMember.avatar}
                      alt={selectedMember.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{(selectedMember.name || 'U').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm sm:text-base text-[#1b4332] truncate">{selectedMember.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-[#1b4332] text-white shadow-2xs">
                      {selectedMember.role || 'Member'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-[#52605d] mt-0.5">
                    <span className="font-mono text-[#2d6a4f] font-bold">
                      {selectedMember.memberNumber || selectedMember.id}
                    </span>
                    <span>•</span>
                    <span className="truncate">{selectedMember.network || 'Main Chapter'}</span>
                    {selectedMember.email && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="truncate hidden sm:inline">{selectedMember.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="p-1.5 sm:p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Close Modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Modal Body: Stats & Activity Table */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-3.5 sm:space-y-4 overscroll-contain pr-2 scroll-smooth">
              {/* Member KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200/80 space-y-0.5">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-[9px] sm:text-[10px] font-extrabold uppercase">Present</span>
                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-base sm:text-xl font-black text-emerald-900">{selectedMemberStats.presentCount}</div>
                  <div className="text-[9px] sm:text-[10px] text-emerald-700 font-semibold truncate">Activities attended</div>
                </div>

                <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200/80 space-y-0.5">
                  <div className="flex items-center justify-between text-rose-800">
                    <span className="text-[9px] sm:text-[10px] font-extrabold uppercase">Absent</span>
                    <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600" />
                  </div>
                  <div className="text-base sm:text-xl font-black text-rose-900">{selectedMemberStats.absentCount}</div>
                  <div className="text-[9px] sm:text-[10px] text-rose-700 font-semibold truncate">Completed missed</div>
                </div>

                <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-200/80 space-y-0.5">
                  <div className="flex items-center justify-between text-amber-800">
                    <span className="text-[9px] sm:text-[10px] font-extrabold uppercase">Upcoming</span>
                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                  </div>
                  <div className="text-base sm:text-xl font-black text-amber-900">{selectedMemberStats.upcomingCount}</div>
                  <div className="text-[9px] sm:text-[10px] text-amber-700 font-semibold truncate">Scheduled events</div>
                </div>

                <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#1b4332] text-white border border-[#1b4332] space-y-0.5">
                  <div className="flex items-center justify-between text-emerald-200">
                    <span className="text-[9px] sm:text-[10px] font-extrabold uppercase">Rate</span>
                    <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" />
                  </div>
                  <div className="text-base sm:text-xl font-black text-white">{selectedMemberStats.attendanceRate}%</div>
                  <div className="text-[9px] sm:text-[10px] text-emerald-200 font-semibold truncate">
                    {selectedMemberStats.presentCount} of {selectedMemberStats.finishedEventsCount} past events
                  </div>
                </div>
              </div>

              {/* Modal Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-0.5">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member events..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-[#e2ece2] rounded-xl text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
                  {(['All', 'Present', 'Absent', 'Upcoming'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setModalEventFilter(filter)}
                      className={`px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                        modalEventFilter === filter
                          ? 'bg-[#1b4332] text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] hover:bg-stone-200/70 border border-[#e2ece2]'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Activity Rows */}
              <div className="bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] overflow-hidden shadow-2xs">
                {modalFilteredActivities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-500 font-medium">
                    No activity records found matching your filter.
                  </div>
                ) : (
                  <div className="divide-y divide-[#e2ece2]">
                    <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-2.5 bg-[#f7f9f7] text-[9.5px] font-extrabold text-[#52605d] uppercase tracking-wider">
                      <div className="col-span-5">Activity / Event Name</div>
                      <div className="col-span-3">Event Date</div>
                      <div className="col-span-4 text-right">Attendance Status & Timestamp</div>
                    </div>

                    {modalFilteredActivities.map(({ activity, record }) => {
                      const formattedDate = !isNaN(new Date(activity.date).getTime())
                        ? new Date(activity.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : activity.date;

                      return (
                        <div
                          key={activity.id}
                          className="p-3 sm:p-4 hover:bg-[#f7f9f7]/70 transition-colors flex flex-col md:grid md:grid-cols-12 gap-1.5 md:gap-3 items-start md:items-center"
                        >
                          <div className="col-span-5 space-y-0.5">
                            <h5 className="font-extrabold text-xs text-[#1b4332]">{activity.name}</h5>
                            <div className="md:hidden text-[10px] text-[#52605d]">Date: {formattedDate}</div>
                          </div>

                          <div className="hidden md:block col-span-3 text-xs font-semibold text-[#1b4332]">
                            {formattedDate}
                          </div>

                          <div className="col-span-4 w-full md:w-auto flex md:justify-end">
                            {record.attended ? (
                              <div className="flex flex-col md:items-end gap-0.5">
                                <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>Present</span>
                                </span>
                                {record.timestamp && (
                                  <span className="text-[9.5px] text-stone-500 font-mono font-medium">
                                    {record.timestamp}
                                  </span>
                                )}
                              </div>
                            ) : record.isFinished ? (
                              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Absent</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Upcoming Event</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-[#f7f9f7] border-t border-[#e2ece2] flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-extrabold text-[#1b4332] pl-1">
                Total Activities: {selectedMemberStats.totalEvents}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
