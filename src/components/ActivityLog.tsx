import React, { useState, useEffect } from 'react';
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
import { store } from '../lib/db';

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

  const fetchActivities = () => {
    setIsLoadingActivities(true);
    fetch('/api/mongodb/activities')
      .then((res) => res.json())
      .then((data) => setActivities(data.data || []))
      .catch((err) => console.error(err))
      .finally(() => setIsLoadingActivities(false));
  };

  const fetchAttendanceLogs = () => {
    setIsLoadingLogs(true);
    fetch('/api/mongodb/attendanceLogs')
      .then((res) => res.json())
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

    fetch('/api/mongodb/users')
      .then((res) => res.json())
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
