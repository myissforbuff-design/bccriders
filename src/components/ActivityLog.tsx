import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { safeFetchJson, store } from '../lib/db';
import {
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Table,
  Users,
  User,
  Clock,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Attendance {
  name: string;
  memberId: string;
  network: string;
  date: string;
  time: string;
  avatar?: string;
}

interface Activity {
  id: string;
  name: string;
  date: string;
  status: 'Open' | 'Closed';
  attendance: Attendance[];
}

interface AttendanceLogDoc {
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
}

export const ActivityLog: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const isMember = !isAdmin;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogDoc[]>([]);
  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedActivityForModal, setSelectedActivityForModal] = useState<Activity | null>(null);
  const [logPage, setLogPage] = useState<number>(1);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityDate, setNewActivityDate] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'All' | 'Attended' | 'Absent' | 'Upcoming'>('All');
  const [memberPage, setMemberPage] = useState<number>(1);

  useModalDismiss(Boolean(selectedActivityForModal), () => setSelectedActivityForModal(null));
  useModalDismiss(isCreateModalOpen, () => setIsCreateModalOpen(false));
  useModalDismiss(Boolean(activityToDelete), () => setActivityToDelete(null));

  const fetchActivities = () => {
    setIsLoadingActivities(true);
    safeFetchJson('/api/mongodb/activities')
      .then((data) => setActivities(data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setIsLoadingActivities(false));
  };

  const fetchAttendanceLogs = () => {
    setIsLoadingLogs(true);
    safeFetchJson('/api/mongodb/attendanceLogs')
      .then((data) => setAttendanceLogs(data.data || []))
      .catch((err) => console.error('Error fetching attendanceLogs:', err))
      .finally(() => setIsLoadingLogs(false));
  };

  useEffect(() => {
    fetchActivities();
    fetchAttendanceLogs();

    const localUsers = store.getUsers();
    const nonAdminLocal = (localUsers || []).filter(
      (u) =>
        u.role?.toLowerCase() !== 'admin' &&
        u.role?.toLowerCase() !== 'administrator' &&
        u.username?.toLowerCase() !== 'admin'
    );
    setRegisteredCount(nonAdminLocal.length);

    safeFetchJson('/api/mongodb/users')
      .then((data) => {
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          const nonAdminMongo = data.data.filter(
            (u: any) =>
              u.role?.toLowerCase() !== 'admin' &&
              u.role?.toLowerCase() !== 'administrator' &&
              u.username?.toLowerCase() !== 'admin'
          );
          setRegisteredCount(nonAdminMongo.length);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const filteredActivities = activities.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createActivity = async () => {
    if (!newActivityName || !newActivityDate) return;
    const newActivity: Activity = {
      id: Date.now().toString(),
      name: newActivityName,
      date: newActivityDate,
      status: 'Open',
      attendance: [],
    };

    setActivities([...activities, newActivity]);

    try {
      await fetch('/api/mongodb/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivity),
      });
    } catch (err) {
      console.error(err);
    }

    setNewActivityName('');
    setNewActivityDate('');
    setIsCreateModalOpen(false);
  };

  const toggleStatus = async (e: React.MouseEvent, activityId: string) => {
    e.stopPropagation(); // prevent opening modal
    let updatedActivity: Activity | null = null;
    setActivities((prev) =>
      prev.map((a) => {
        if (a.id === activityId) {
          const nextStatus = a.status === 'Closed' ? 'Open' : 'Closed';
          updatedActivity = { ...a, status: nextStatus };
          return updatedActivity;
        }
        return a;
      })
    );

    if (updatedActivity) {
      try {
        await fetch('/api/mongodb/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedActivity),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return;
    const activityId = activityToDelete.id;
    const activityName = activityToDelete.name;

    setActivities((prev) => prev.filter((a) => a.id !== activityId));
    setAttendanceLogs((prev) =>
      prev.filter((log) => {
        const logEvent = (log['Event Name'] || log.eventName || '').toLowerCase().trim();
        return logEvent !== activityName.toLowerCase().trim() && log.activityId !== activityId && log['Activity ID'] !== activityId;
      })
    );

    if (selectedActivityForModal?.id === activityId) {
      setSelectedActivityForModal(null);
    }
    setActivityToDelete(null);

    try {
      await fetch(`/api/mongodb/activities/${activityId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activityName, id: activityId }),
      });
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
    window.location.reload();
  };

  const handleOpenActivityLogsModal = (activity: Activity) => {
    setSelectedActivityForModal(activity);
    setLogPage(1);
    fetchAttendanceLogs();
  };

  // Get attendance records for a specific activity
  const getLogsForActivity = (activity: Activity) => {
    const actNameLower = activity.name.toLowerCase().trim();

    // 1. Filter from MongoDB attendanceLogs
    const mongoMatches = attendanceLogs.filter((log) => {
      const eName = (log['Event Name'] || log.eventName || '').toLowerCase().trim();
      return eName === actNameLower;
    });

    if (mongoMatches.length > 0) {
      return mongoMatches;
    }

    // 2. Fallback to activity.attendance array if available
    if (activity.attendance && activity.attendance.length > 0) {
      return activity.attendance.map((att, idx) => {
        const parts = att.name.trim().split(' ');
        const firstName = parts[0] || att.name;
        const lastName = parts.slice(1).join(' ') || '';

        return {
          id: `att_${idx}_${att.memberId}`,
          'Event Name': activity.name,
          'Event Date': activity.date,
          'Member ID': att.memberId,
          'Last Name': lastName,
          'First Name': firstName,
          'Network': att.network || 'Main Chapter',
          'Date Stamp': att.date,
          'Time Stamp': att.time,
        };
      });
    }

    return [];
  };

  // Combine MongoDB activities with local store events
  const allCombinedActivities: Activity[] = [...activities];
  const localEvents = store.getEvents();

  localEvents.forEach((evt) => {
    const exists = allCombinedActivities.some(
      (a) => a.name.toLowerCase().trim() === evt.title.toLowerCase().trim()
    );
    if (!exists) {
      allCombinedActivities.push({
        id: evt.id,
        name: evt.title,
        date: evt.date,
        status: evt.status === 'Completed' || evt.status === 'Cancelled' ? 'Closed' : 'Open',
        attendance: [],
      });
    }
  });

  const getMemberRecord = (activity: Activity) => {
    if (!currentUser) return { attended: false, timestamp: null, isFinished: false };

    const memNo = (currentUser.memberNumber || '').toLowerCase().trim();
    const userId = (currentUser.id || '').toLowerCase().trim();
    const userName = (currentUser.name || '').toLowerCase().trim();
    const userUsername = (currentUser.username || '').toLowerCase().trim();
    const actNameLower = activity.name.toLowerCase().trim();

    // 1. Search in attendanceLogs
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

    // Determine if event date is finished
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
      isFinished,
    };
  };

  // Member stats
  const memberActivityList = allCombinedActivities.map((act) => ({
    activity: act,
    record: getMemberRecord(act),
  }));

  const totalMemberEvents = memberActivityList.length;
  const totalMemberAttended = memberActivityList.filter((item) => item.record.attended).length;
  const totalMemberAbsent = memberActivityList.filter((item) => !item.record.attended && item.record.isFinished).length;
  const totalMemberUpcoming = memberActivityList.filter((item) => !item.record.attended && !item.record.isFinished).length;

  const filteredMemberActivities = memberActivityList.filter(({ activity, record }) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = activity.name.toLowerCase().includes(q) || activity.date.includes(q);
    if (!matchesSearch) return false;

    if (memberStatusFilter === 'Attended') return record.attended;
    if (memberStatusFilter === 'Absent') return !record.attended && record.isFinished;
    if (memberStatusFilter === 'Upcoming') return !record.attended && !record.isFinished;

    return true;
  });

  const memberItemsPerPage = 10;
  const totalMemberPages = Math.ceil(filteredMemberActivities.length / memberItemsPerPage) || 1;
  const currentMemberPage = Math.min(Math.max(1, memberPage), totalMemberPages);

  const paginatedMemberActivities = filteredMemberActivities.slice(
    (currentMemberPage - 1) * memberItemsPerPage,
    currentMemberPage * memberItemsPerPage
  );

  if (isMember) {
    return (
      <div className="space-y-6 pb-12">
        {/* Member Summary Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-[#e2ece2] shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-[#52605d] tracking-wider">Total Events</span>
            <div className="text-xl font-black text-[#1b4332]">{totalMemberEvents}</div>
          </div>
          <div className="bg-emerald-50/60 p-4 rounded-3xl border border-emerald-100 shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">Attended</span>
            <div className="text-xl font-black text-emerald-800">{totalMemberAttended}</div>
          </div>
          <div className="bg-rose-50/60 p-4 rounded-3xl border border-rose-100 shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider">Absent</span>
            <div className="text-xl font-black text-rose-800">{totalMemberAbsent}</div>
          </div>
          <div className="bg-amber-50/60 p-4 rounded-3xl border border-amber-100 shadow-2xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider">Upcoming</span>
            <div className="text-xl font-black text-amber-800">{totalMemberUpcoming}</div>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-3xl border border-[#e2ece2] shadow-xs">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event name or date..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setMemberPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 border border-[#e2ece2] rounded-xl text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['All', 'Attended', 'Absent', 'Upcoming'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setMemberStatusFilter(filter);
                  setMemberPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  memberStatusFilter === filter
                    ? 'bg-[#1b4332] text-white shadow-xs'
                    : 'bg-[#f7f9f7] text-[#52605d] hover:bg-stone-200/70'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Member Activity List Table / Cards */}
        <div className="bg-white rounded-3xl border border-[#e2ece2] shadow-xs overflow-hidden">
          {isLoadingActivities ? (
            <div className="p-12 text-center text-xs text-[#2d6a4f] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#2d6a4f]" />
              <span className="font-extrabold text-[#1b4332]">Loading activity history...</span>
            </div>
          ) : filteredMemberActivities.length === 0 ? (
            <div className="p-12 text-center text-xs text-stone-500 font-medium">
              No activity records matching your criteria.
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#e2ece2]">
                {/* Desktop Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3.5 bg-[#f7f9f7] text-[11px] font-extrabold text-[#52605d] uppercase tracking-wider">
                  <div className="col-span-4 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>Event Name</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>Event Date</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>Member Timestamp</span>
                  </div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {/* Rows */}
                {paginatedMemberActivities.map(({ activity, record }) => {
                  const formattedEventDate = !isNaN(new Date(activity.date).getTime())
                    ? new Date(activity.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : activity.date;

                  return (
                    <div
                      key={activity.id}
                      className="p-4 sm:p-5 hover:bg-[#f7f9f7]/60 transition-colors flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center"
                    >
                      {/* Event Name */}
                      <div className="col-span-4 space-y-0.5">
                        <h4 className="font-extrabold text-sm text-[#1b4332]">{activity.name}</h4>
                        <div className="md:hidden text-xs text-[#52605d]">Date: {formattedEventDate}</div>
                      </div>

                      {/* Event Date (Desktop) */}
                      <div className="hidden md:block col-span-3 text-xs font-semibold text-[#1b4332]">
                        {formattedEventDate}
                      </div>

                      {/* Member Timestamp */}
                      <div className="col-span-3 text-xs text-[#52605d]">
                        <span className="md:hidden font-bold text-[#1b4332] mr-1">Timestamp:</span>
                        {record.attended ? (
                          <span className="font-mono font-bold text-[#1b4332] bg-[#f7f9f7] px-2 py-1 rounded-lg border border-[#e2ece2] inline-block">
                            {record.timestamp}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">—</span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="col-span-2 w-full md:w-auto flex md:justify-end">
                        {record.attended ? (
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Attended</span>
                          </span>
                        ) : record.isFinished ? (
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-2xs">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Absent</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Upcoming</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-[#f7f9f7] border-t border-[#e2ece2] text-xs text-[#52605d]">
                <div className="font-semibold text-stone-600">
                  Showing <span className="font-extrabold text-[#1b4332]">{(currentMemberPage - 1) * memberItemsPerPage + 1}</span> to{' '}
                  <span className="font-extrabold text-[#1b4332]">
                    {Math.min(currentMemberPage * memberItemsPerPage, filteredMemberActivities.length)}
                  </span>{' '}
                  of <span className="font-extrabold text-[#1b4332]">{filteredMemberActivities.length}</span> activities
                </div>

                {totalMemberPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMemberPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentMemberPage === 1}
                      className="p-1.5 rounded-xl border border-[#e2ece2] bg-white text-[#1b4332] hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalMemberPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setMemberPage(pageNum)}
                          className={`w-7 h-7 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                            currentMemberPage === pageNum
                              ? 'bg-[#1b4332] text-white shadow-xs'
                              : 'bg-white text-[#52605d] border border-[#e2ece2] hover:bg-stone-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMemberPage((prev) => Math.min(totalMemberPages, prev + 1))}
                      disabled={currentMemberPage === totalMemberPages}
                      className="p-1.5 rounded-xl border border-[#e2ece2] bg-white text-[#1b4332] hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Search and Create Activity */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 bg-white rounded-3xl border border-[#e2ece2] shadow-xs">
        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#e2ece2] rounded-xl text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Activity</span>
          </button>
        </div>
      </div>

      {/* ACTIVITIES LIST */}
      <div className="space-y-4">
        {isLoadingActivities ? (
          <div className="p-12 text-center text-xs text-[#2d6a4f] bg-white rounded-3xl border border-[#e2ece2] flex flex-col items-center justify-center gap-3 shadow-2xs">
            <Loader2 className="w-6 h-6 animate-spin text-[#2d6a4f]" />
            <span className="font-extrabold text-[#1b4332]">Loading event activities...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 bg-white rounded-3xl border border-[#e2ece2]">
            No matching event activities found.
          </div>
        ) : (
          filteredActivities.map((activity) => {
            const eventLogs = getLogsForActivity(activity);

            return (
              <div
                key={activity.id}
                onClick={() => handleOpenActivityLogsModal(activity)}
                className="bg-white rounded-3xl border border-[#e2ece2] hover:border-[#74c69d] transition-all duration-200 overflow-hidden shadow-xs p-5 sm:p-6 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#f7f9f7]/60 group"
              >
                <div className="space-y-1.5 flex-1">
                  <h3 className="font-extrabold text-base text-[#1b4332] group-hover:text-[#2d6a4f] transition-colors">
                    {activity.name}
                  </h3>
                  <p className="text-xs text-[#52605d] flex items-center gap-2 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
                      {new Date(activity.date).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span className="font-extrabold text-[#1b4332]">
                      {eventLogs.length}/{registeredCount}
                    </span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL FOR VIEWING EVENT ATTENDANCE LOGS */}
      {selectedActivityForModal && (() => {
        const currentModalActivity = activities.find((a) => a.id === selectedActivityForModal.id) || selectedActivityForModal;
        const rawLogs = getLogsForActivity(currentModalActivity);

        const ITEMS_PER_PAGE = 10;
        const totalLogs = rawLogs.length;
        const totalPages = Math.max(1, Math.ceil(totalLogs / ITEMS_PER_PAGE));
        const currentPage = Math.min(Math.max(1, logPage), totalPages);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalLogs);
        const paginatedLogs = rawLogs.slice(startIndex, endIndex);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 animate-fadeIn">
            <div className="bg-white rounded-[32px] border border-[#e2ece2] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-[#e2ece2] bg-[#f7f9f7] flex flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Table className="w-5 h-5 text-[#2d6a4f]" />
                    <h3 className="font-extrabold text-base sm:text-lg text-[#1b4332]">
                      {currentModalActivity.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[#52605d] flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>Event Date: {new Date(currentModalActivity.date).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* View Logs Label */}
                  <div className="px-3 py-1.5 rounded-xl bg-white text-[#1b4332] border border-[#e2ece2] hidden sm:flex items-center gap-1.5 text-xs font-extrabold">
                    <Table className="w-3.5 h-3.5 text-[#2d6a4f]" />
                    <span>View Logs</span>
                  </div>

                  <button
                    onClick={() => setSelectedActivityForModal(null)}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Close Modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Scanned Member Cards */}
              <div className="p-3 sm:p-5 overflow-y-auto flex-1 flex flex-col justify-between max-h-[60vh]">
                <div>
                  {isLoadingLogs ? (
                    <div className="p-8 text-center text-gray-500 font-medium bg-white rounded-2xl border border-[#e2ece2] shadow-2xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#2d6a4f]" />
                        <span className="font-extrabold text-[#1b4332] text-xs">Loading attendance logs...</span>
                      </div>
                    </div>
                  ) : totalLogs === 0 ? (
                    <div className="p-8 text-center text-stone-500 font-medium bg-white rounded-2xl border border-[#e2ece2] text-xs shadow-2xs">
                      No attendance log records found for this event.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                      {paginatedLogs.map((log, index) => {
                        const lastName = (log['Last Name'] || log.lastName || '').trim();
                        const firstName = (log['First Name'] || log.firstName || '').trim();
                        let formattedName = '—';
                        if (lastName && firstName) {
                          formattedName = `${lastName}, ${firstName}`;
                        } else if (lastName) {
                          formattedName = lastName;
                        } else if (firstName) {
                          formattedName = firstName;
                        } else if (log['Full Name'] || log.fullName || log.name) {
                          formattedName = log['Full Name'] || log.fullName || log.name;
                        }

                        const network = log['Network'] || log.network || 'Main Chapter';
                        const rawTime = log['Time Stamp'] || log.timeStamp || log.time || 'N/A';
                        const time = rawTime === 'N/A' ? 'N/A' : rawTime.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');

                        return (
                          <div
                            key={log.id || index}
                            className="bg-white px-4 py-3 rounded-2xl border border-[#e2ece2] shadow-2xs hover:border-[#b7d2b7] transition-all space-y-1"
                          >
                            <h4 className="text-sm font-extrabold text-[#1b4332] truncate">
                              {formattedName}
                            </h4>
                            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 gap-2">
                              <span className="truncate">{network}</span>
                              <span className="font-mono font-bold text-[#1b4332] shrink-0">{time}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalLogs > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#e2ece2] text-xs">
                    <span className="text-[#52605d] font-semibold text-[11px]">
                      Showing <span className="font-extrabold text-[#1b4332]">{startIndex + 1}-{endIndex}</span> of <span className="font-extrabold text-[#1b4332]">{totalLogs}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setLogPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded-xl border border-[#e2ece2] bg-white text-[#1b4332] font-extrabold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7f9f7] active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>
                      <span className="px-2 font-extrabold text-[#1b4332] text-xs">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setLogPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded-xl border border-[#e2ece2] bg-white text-[#1b4332] font-extrabold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7f9f7] active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#f7f9f7] border-t border-[#e2ece2] flex items-center justify-between">
                <span className="font-extrabold text-base text-[#1b4332] pl-2">
                  {rawLogs.length}/{registeredCount}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={(e) => toggleStatus(e, currentModalActivity.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      (currentModalActivity.status || 'Open') === 'Open'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                    }`}
                    title="Toggle Event Status"
                  >
                    {(currentModalActivity.status || 'Open') === 'Open' ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Open
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Closed
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setActivityToDelete(currentModalActivity)}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
                    title="Delete Activity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal for Creating New Activity */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white p-6 rounded-3xl border border-[#e2ece2] space-y-4 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-extrabold text-base text-[#1b4332]">Create New Event Activity</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-[#52605d] uppercase mb-1">
                  Event / Activity Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Club Rally 2026"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  className="w-full p-3 border border-[#e2ece2] rounded-xl text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-[#52605d] uppercase mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={newActivityDate}
                  onChange={(e) => setNewActivityDate(e.target.value)}
                  className="w-full p-3 border border-[#e2ece2] rounded-xl text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-extrabold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={createActivity}
                className="px-4 py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-xl text-xs font-extrabold cursor-pointer shadow-xs"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal for Delete Activity Confirmation */}
      {activityToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white p-6 rounded-3xl border border-[#e2ece2] space-y-4 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setActivityToDelete(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#1b4332]">Delete Activity</h3>
                <p className="text-xs text-stone-500 font-medium">Confirm deletion of event</p>
              </div>
            </div>
            <p className="text-xs text-[#52605d] leading-relaxed">
              Are you sure you want to delete <span className="font-extrabold text-[#1b4332]">"{activityToDelete.name}"</span>? This action cannot be undone and will permanently remove this activity.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setActivityToDelete(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteActivity}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
