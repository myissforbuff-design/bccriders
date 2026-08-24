import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { safeFetchJson, authFetch, store, getCachedData } from '../lib/db';
import { loadFromSession } from '../lib/storageSecurity';
import { User as UserType, ActivityAudience, isUserTargetedForActivity, isOfficerRole } from '../types';
import { OfficialDotSpinner } from './OfficialLoader';
import { AttendanceTracker } from './AttendanceTracker';
import { ModalPortal } from './ModalPortal';
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
  UserCheck,
  Shield,
  Pencil,
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
  targetAudience?: ActivityAudience[];
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

  const [activeSubTab, setActiveSubTab] = useState<'events' | 'tracker'>(() => {
    const saved = localStorage.getItem('bcc_activity_subtab');
    return saved === 'tracker' ? 'tracker' : 'events';
  });

  useEffect(() => {
    localStorage.setItem('bcc_activity_subtab', activeSubTab);
  }, [activeSubTab]);

  const [usersList, setUsersList] = useState<UserType[]>(() => {
    const local = store.getUsers() || [];
    return local.filter(
      (u) =>
        u.role?.toLowerCase() !== 'admin' &&
        u.role?.toLowerCase() !== 'administrator' &&
        u.username?.toLowerCase() !== 'admin' &&
        u.id !== 'usr_admin' &&
        u.id !== 'admin'
    );
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    const inMemOrSession =
      getCachedData<Activity[]>('/api/mongodb/activities', null as any) ||
      getCachedData<Activity[]>('bcc_activities_cache_v1', null as any) ||
      loadFromSession<Activity[]>('bcc_activities_cache_v1', null as any);
    if (inMemOrSession && Array.isArray(inMemOrSession) && inMemOrSession.length > 0) {
      return inMemOrSession;
    }
    try {
      const local = localStorage.getItem('bcc_activities_cache_v1');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const storeEvts = store.getEvents() || [];
    if (storeEvts.length > 0) {
      return storeEvts.map((evt) => ({
        id: evt.id,
        name: evt.title,
        date: evt.date,
        status: (evt.status === 'Completed' || evt.status === 'Cancelled' ? 'Closed' : 'Open') as 'Open' | 'Closed',
        attendance: [],
      }));
    }
    return [];
  });

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogDoc[]>(() => {
    const inMemOrSession =
      getCachedData<AttendanceLogDoc[]>('/api/mongodb/attendanceLogs', null as any) ||
      getCachedData<AttendanceLogDoc[]>('bcc_attendance_logs_cache_v1', null as any) ||
      loadFromSession<AttendanceLogDoc[]>('bcc_attendance_logs_cache_v1', null as any);
    if (inMemOrSession && Array.isArray(inMemOrSession) && inMemOrSession.length > 0) {
      return inMemOrSession;
    }
    try {
      const local = localStorage.getItem('bcc_attendance_logs_cache_v1');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [registeredCount, setRegisteredCount] = useState<number>(() => usersList.length);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(() => activities.length === 0);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedActivityForModal, setSelectedActivityForModal] = useState<Activity | null>(null);
  const [logPage, setLogPage] = useState<number>(1);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editActivityName, setEditActivityName] = useState<string>('');
  const [editActivityDate, setEditActivityDate] = useState<string>('');
  const [editActivityStatus, setEditActivityStatus] = useState<'Open' | 'Closed'>('Open');
  const [editActivityAudience, setEditActivityAudience] = useState<ActivityAudience[]>(['Officers', 'Members']);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityDate, setNewActivityDate] = useState('');
  const [newActivityAudience, setNewActivityAudience] = useState<ActivityAudience[]>(['Officers', 'Members']);
  const [memberStatusFilter, setMemberStatusFilter] = useState<'All' | 'Attended' | 'Absent' | 'Upcoming'>('All');
  const [memberPage, setMemberPage] = useState<number>(1);

  useModalDismiss(Boolean(selectedActivityForModal), () => setSelectedActivityForModal(null));
  useModalDismiss(isCreateModalOpen, () => setIsCreateModalOpen(false));
  useModalDismiss(Boolean(editingActivity), () => setEditingActivity(null));
  useModalDismiss(Boolean(activityToDelete), () => setActivityToDelete(null));

  const fetchActivities = (silent = false) => {
    if (!silent && activities.length === 0) setIsLoadingActivities(true);
    safeFetchJson('/api/mongodb/activities')
      .then((data) => {
        if (data && data.success !== false && data.data && Array.isArray(data.data)) {
          if (data.data.length > 0) {
            setActivities(data.data);
            try {
              localStorage.setItem('bcc_activities_cache_v1', JSON.stringify(data.data));
            } catch {}
          } else {
            // If MongoDB collection is empty, check if we have offline/local events or activities
            setActivities((prev) => {
              if (prev && prev.length > 0) {
                // Sync local activities up to MongoDB
                prev.forEach((act) => {
                  authFetch('/api/mongodb/activities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(act),
                  }).catch(() => {});
                });
                return prev;
              }
              const storeEvts = store.getEvents() || [];
              if (storeEvts.length > 0) {
                const mapped: Activity[] = storeEvts.map((evt) => ({
                  id: evt.id,
                  name: evt.title,
                  date: evt.date,
                  status: (evt.status === 'Completed' || evt.status === 'Cancelled' ? 'Closed' : 'Open') as 'Open' | 'Closed',
                  attendance: [],
                }));
                mapped.forEach((act) => {
                  authFetch('/api/mongodb/activities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(act),
                  }).catch(() => {});
                });
                return mapped;
              }
              return [];
            });
          }
          // If modal is open, sync the open activity
          setSelectedActivityForModal((prev) => {
            if (!prev) return null;
            const updated = (data.data || []).find(
              (a: Activity) => a.id === prev.id || a.name.toLowerCase().trim() === prev.name.toLowerCase().trim()
            );
            return updated || prev;
          });
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        setIsLoadingActivities(false);
      });
  };

  const fetchAttendanceLogs = (silent = false) => {
    if (!silent && attendanceLogs.length === 0) setIsLoadingLogs(true);
    safeFetchJson('/api/mongodb/attendanceLogs')
      .then((data) => {
        if (data && data.success !== false && data.data && Array.isArray(data.data)) {
          setAttendanceLogs(data.data);
          try {
            localStorage.setItem('bcc_attendance_logs_cache_v1', JSON.stringify(data.data));
          } catch {}
        }
      })
      .catch((err) => console.error('Error fetching attendanceLogs:', err))
      .finally(() => {
        setIsLoadingLogs(false);
      });
  };

  useEffect(() => {
    if (!currentUser) return;
    const hasCachedActs = activities.length > 0;
    const hasCachedLogs = attendanceLogs.length > 0;
    fetchActivities(hasCachedActs);
    fetchAttendanceLogs(hasCachedLogs);

    const localUsers = store.getUsers();
    const nonAdminLocal = (localUsers || []).filter(
      (u) =>
        u.role?.toLowerCase() !== 'admin' &&
        u.role?.toLowerCase() !== 'administrator' &&
        u.username?.toLowerCase() !== 'admin' &&
        u.id !== 'usr_admin' &&
        u.id !== 'admin'
    );
    setUsersList(nonAdminLocal);
    setRegisteredCount(nonAdminLocal.length);

    safeFetchJson('/api/mongodb/users')
      .then((data) => {
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          const nonAdminMongo = data.data.filter(
            (u: any) =>
              u.role?.toLowerCase() !== 'admin' &&
              u.role?.toLowerCase() !== 'administrator' &&
              u.username?.toLowerCase() !== 'admin' &&
              u.id !== 'usr_admin' &&
              u.id !== 'admin'
          );
          setUsersList(nonAdminMongo);
          setRegisteredCount(nonAdminMongo.length);
        }
      })
      .catch((err) => console.error(err));

    // Real-time listener for scans and updates within the same application session
    const handleRealtimeUpdate = (e: CustomEvent) => {
      const detail = e.detail;
      if (detail?.activity) {
        setActivities((prev) => {
          const exists = prev.some(
            (a) => a.id === detail.activity.id || a.name.toLowerCase().trim() === detail.activity.name.toLowerCase().trim()
          );
          if (exists) {
            return prev.map((a) =>
              a.id === detail.activity.id || a.name.toLowerCase().trim() === detail.activity.name.toLowerCase().trim()
                ? detail.activity
                : a
            );
          }
          return [detail.activity, ...prev];
        });

        setSelectedActivityForModal((prev) => {
          if (!prev) return null;
          if (prev.id === detail.activity.id || prev.name.toLowerCase().trim() === detail.activity.name.toLowerCase().trim()) {
            return detail.activity;
          }
          return prev;
        });
      }

      if (detail?.attendanceLog) {
        setAttendanceLogs((prev) => {
          const already = prev.some((l) => l.id === detail.attendanceLog.id);
          if (already) return prev;
          return [detail.attendanceLog, ...prev];
        });
      }

      // Silent sync with server in background
      fetchActivities(true);
      fetchAttendanceLogs(true);
    };

    // Cross-tab synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bcc_activity_sync_time' || e.key === 'bcc_events_v2') {
        fetchActivities(true);
        fetchAttendanceLogs(true);
      }
    };

    const handleFocus = () => {
      fetchActivities(true);
      fetchAttendanceLogs(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchActivities(true);
        fetchAttendanceLogs(true);
      }
    };

    window.addEventListener('bcc_activities_updated', handleRealtimeUpdate as EventListener);
    window.addEventListener('bcc_attendance_updated', handleRealtimeUpdate as EventListener);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Periodic silent background polling (every 3.5s) to guarantee real-time updates across multiple devices/scanners
    const interval = setInterval(() => {
      fetchActivities(true);
      fetchAttendanceLogs(true);
    }, 3500);

    return () => {
      window.removeEventListener('bcc_activities_updated', handleRealtimeUpdate as EventListener);
      window.removeEventListener('bcc_attendance_updated', handleRealtimeUpdate as EventListener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  const [activityPage, setActivityPage] = useState<number>(1);
  const activitiesPerPage = 10;

  useEffect(() => {
    setActivityPage(1);
  }, [searchTerm]);

  const filteredActivities = activities.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalActivityPages = Math.max(1, Math.ceil(filteredActivities.length / activitiesPerPage));
  const currentActivityPage = Math.min(Math.max(1, activityPage), totalActivityPages);
  const paginatedActivities = filteredActivities.slice(
    (currentActivityPage - 1) * activitiesPerPage,
    currentActivityPage * activitiesPerPage
  );

  const createActivity = async () => {
    if (!newActivityName || !newActivityDate) return;
    const finalAudience: ActivityAudience[] = newActivityAudience.length > 0 ? newActivityAudience : ['Officers', 'Members'];
    const newActivity: Activity = {
      id: Date.now().toString(),
      name: newActivityName,
      date: newActivityDate,
      status: 'Open',
      attendance: [],
      targetAudience: finalAudience,
    };

    setActivities([...activities, newActivity]);

    try {
      await authFetch('/api/mongodb/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newActivity),
      });

      window.dispatchEvent(
        new CustomEvent('bcc_activities_updated', {
          detail: { activity: newActivity },
        })
      );
      window.dispatchEvent(
        new CustomEvent('bcc_push_alert', {
          detail: {
            title: `New Activity: ${newActivity.name}`,
            message: `Scheduled for ${newActivity.date} (${finalAudience.join(', ')})`,
            category: 'activities',
            type: 'ride',
          },
        })
      );
      localStorage.setItem('bcc_activity_sync_time', Date.now().toString());
    } catch (err) {
      console.error(err);
    }

    setNewActivityName('');
    setNewActivityDate('');
    setNewActivityAudience(['Officers', 'Members']);
    setIsCreateModalOpen(false);
  };

  const handleOpenEditActivity = (activity: Activity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingActivity(activity);
    setEditActivityName(activity.name || '');
    setEditActivityDate(activity.date || '');
    setEditActivityStatus(activity.status || 'Open');
    setEditActivityAudience(
      activity.targetAudience && activity.targetAudience.length > 0
        ? activity.targetAudience
        : ['Officers', 'Members']
    );
  };

  const saveEditedActivity = async () => {
    if (!editingActivity || !editActivityName.trim() || !editActivityDate.trim()) return;
    setIsSavingEdit(true);

    const oldName = editingActivity.name;
    const finalAudience: ActivityAudience[] =
      editActivityAudience.length > 0 ? editActivityAudience : ['Officers', 'Members'];

    const updated: Activity = {
      ...editingActivity,
      name: editActivityName.trim(),
      date: editActivityDate.trim(),
      status: editActivityStatus,
      targetAudience: finalAudience,
    };

    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

    if (selectedActivityForModal?.id === updated.id) {
      setSelectedActivityForModal(updated);
    }

    try {
      await authFetch('/api/mongodb/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      window.dispatchEvent(
        new CustomEvent('bcc_activities_updated', {
          detail: { activity: updated },
        })
      );
      localStorage.setItem('bcc_activity_sync_time', Date.now().toString());

      try {
        const currentList = activities.map((a) => (a.id === updated.id ? updated : a));
        localStorage.setItem('bcc_activities_cache_v1', JSON.stringify(currentList));
      } catch {}
    } catch (err) {
      console.error('Failed to save edited activity:', err);
    } finally {
      setIsSavingEdit(false);
      setEditingActivity(null);
    }
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
        await authFetch('/api/mongodb/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedActivity),
        });

        window.dispatchEvent(
          new CustomEvent('bcc_activities_updated', {
            detail: { activity: updatedActivity },
          })
        );
        localStorage.setItem('bcc_activity_sync_time', Date.now().toString());
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
      await authFetch(`/api/mongodb/activities/${activityId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activityName, id: activityId }),
      });

      window.dispatchEvent(
        new CustomEvent('bcc_activities_updated', {
          detail: { deletedActivityId: activityId },
        })
      );
      localStorage.setItem('bcc_activity_sync_time', Date.now().toString());
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
    if (!currentUser) return { attended: false, timestamp: null, isFinished: false, isApplicable: false, isTargeted: false };

    const memNo = (currentUser.memberNumber || '').toLowerCase().trim();
    const memNoDigits = memNo.replace(/[^a-z0-9]/g, '');
    const userId = (currentUser.id || '').toLowerCase().trim();
    const userIdDigits = userId.replace(/[^a-z0-9]/g, '');
    const userName = (currentUser.name || '').toLowerCase().trim();
    const userUsername = (currentUser.username || '').toLowerCase().trim();
    const actNameLower = activity.name.toLowerCase().trim();

    const isTargeted = isUserTargetedForActivity(currentUser, activity);

    // 1. Search in attendanceLogs
    const logMatch = attendanceLogs.find((log) => {
      const eName = (log['Event Name'] || log.eventName || '').toLowerCase().trim();
      if (eName !== actNameLower) return false;

      const logMemId = (log['Member ID'] || log.memberId || '').toLowerCase().trim();
      const logMemIdDigits = logMemId.replace(/[^a-z0-9]/g, '');
      if (logMemId && (logMemId === memNo || logMemId === userId)) return true;
      if (logMemIdDigits && (logMemIdDigits === memNoDigits || logMemIdDigits === userIdDigits)) return true;

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
        isApplicable: true,
        isTargeted,
      };
    }

    // 2. Search in activity.attendance array
    if (activity.attendance && activity.attendance.length > 0) {
      const attMatch = activity.attendance.find((att) => {
        const attMemId = (att.memberId || '').toLowerCase().trim();
        const attMemIdDigits = attMemId.replace(/[^a-z0-9]/g, '');
        if (attMemId && (attMemId === memNo || attMemId === userId)) return true;
        if (attMemIdDigits && (attMemIdDigits === memNoDigits || attMemIdDigits === userIdDigits)) return true;

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
          isApplicable: true,
          isTargeted,
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
      dateStamp: null,
      timeStamp: null,
      isFinished,
      isApplicable: isTargeted,
      isTargeted,
    };
  };

  // Member stats
  const memberActivityList = allCombinedActivities.map((act) => ({
    activity: act,
    record: getMemberRecord(act),
  }));

  const applicableMemberActivityList = memberActivityList.filter((item) => item.record.isApplicable);
  const totalMemberEvents = applicableMemberActivityList.length;
  const totalMemberAttended = memberActivityList.filter((item) => item.record.attended).length;
  const totalMemberAbsent = applicableMemberActivityList.filter((item) => !item.record.attended && item.record.isFinished).length;
  const totalMemberUpcoming = applicableMemberActivityList.filter((item) => !item.record.attended && !item.record.isFinished).length;

  const filteredMemberActivities = memberActivityList.filter(({ activity, record }) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = activity.name.toLowerCase().includes(q) || activity.date.includes(q);
    if (!matchesSearch) return false;

    if (memberStatusFilter === 'Attended') return record.attended;
    if (memberStatusFilter === 'Absent') return !record.attended && record.isFinished && record.isApplicable;
    if (memberStatusFilter === 'Upcoming') return !record.attended && !record.isFinished && record.isApplicable;

    return true;
  });

  const memberItemsPerPage = 10;
  const totalMemberPages = Math.ceil(filteredMemberActivities.length / memberItemsPerPage) || 1;
  const currentMemberPage = Math.min(Math.max(1, memberPage), totalMemberPages);

  const paginatedMemberActivities = filteredMemberActivities.slice(
    (currentMemberPage - 1) * memberItemsPerPage,
    currentMemberPage * memberItemsPerPage
  );

  if (activeSubTab === 'tracker') {
    return (
      <div className="space-y-2.5 sm:space-y-4 pb-12">
        {/* Sub-Tab Navigation Header */}
        <div className="flex p-0.5 sm:p-1 bg-[#f7f9f7] rounded-lg sm:rounded-xl border border-[#e2ece2] w-full sm:w-auto self-start overflow-x-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('events')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-bold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeSubTab === 'events'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Activities & Events</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('tracker')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-bold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeSubTab === 'tracker'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Attendance Tracker</span>
          </button>
        </div>

        {/* Attendance Tracker View */}
        <AttendanceTracker
          activities={allCombinedActivities}
          attendanceLogs={attendanceLogs}
          users={usersList}
          isLoading={allCombinedActivities.length === 0 && isLoadingActivities}
        />
      </div>
    );
  }

  if (isMember) {
    return (
      <div className="space-y-2.5 sm:space-y-4 pb-12">
        {/* Sub-Tab Navigation Header */}
        <div className="flex p-0.5 sm:p-1 bg-[#f7f9f7] rounded-lg sm:rounded-xl border border-[#e2ece2] w-full sm:w-auto self-start overflow-x-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('events')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-bold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeSubTab === 'events'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Activities & Events</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('tracker')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-bold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              activeSubTab === 'tracker'
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
            }`}
          >
            <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>Attendance Tracker</span>
          </button>
        </div>

        {/* Member Summary Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-white p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-2xs space-y-0.5">
            <span className="text-[8.5px] sm:text-[9.5px] font-extrabold uppercase text-[#52605d] tracking-wider">Total Events</span>
            <div className="text-base sm:text-lg font-black text-[#1b4332]">{totalMemberEvents}</div>
          </div>
          <div className="bg-emerald-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-emerald-100 shadow-2xs space-y-0.5">
            <span className="text-[8.5px] sm:text-[9.5px] font-extrabold uppercase text-emerald-700 tracking-wider">Attended</span>
            <div className="text-base sm:text-lg font-black text-emerald-800">{totalMemberAttended}</div>
          </div>
          <div className="bg-rose-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-rose-100 shadow-2xs space-y-0.5">
            <span className="text-[8.5px] sm:text-[9.5px] font-extrabold uppercase text-rose-700 tracking-wider">Absent</span>
            <div className="text-base sm:text-lg font-black text-rose-800">{totalMemberAbsent}</div>
          </div>
          <div className="bg-amber-50/60 p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-amber-100 shadow-2xs space-y-0.5">
            <span className="text-[8.5px] sm:text-[9.5px] font-extrabold uppercase text-amber-700 tracking-wider">Upcoming</span>
            <div className="text-base sm:text-lg font-black text-amber-800">{totalMemberUpcoming}</div>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 sm:p-3 bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event name or date..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setMemberPage(1);
              }}
              className="w-full pl-8 sm:pl-9 pr-2.5 py-1.5 border border-[#e2ece2] rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
            {(['All', 'Attended', 'Absent', 'Upcoming'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setMemberStatusFilter(filter);
                  setMemberPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs overflow-hidden">
          {isLoadingActivities ? (
            <div className="p-8 sm:p-12 text-center text-xs text-[#2d6a4f] flex flex-col items-center justify-center gap-2.5">
              <OfficialDotSpinner />
              <span className="font-extrabold text-[#1b4332] mt-1 text-[11px] sm:text-xs">Loading activity history...</span>
            </div>
          ) : filteredMemberActivities.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-[11px] sm:text-xs text-stone-500 font-medium">
              No activity records matching your criteria.
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#e2ece2]">
                {/* Desktop Header */}
                <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2 bg-[#f7f9f7] text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider">
                  <div className="col-span-4 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-[#2d6a4f]" />
                    <span>Event Name</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#2d6a4f]" />
                    <span>Event Date</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-[#2d6a4f]" />
                    <span>Member Timestamp</span>
                  </div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {/* Rows */}
                {paginatedMemberActivities.map(({ activity, record }) => {
                  const formattedEventDate = !isNaN(new Date(activity.date).getTime())
                    ? new Date(activity.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : activity.date;

                  const audience = activity.targetAudience && activity.targetAudience.length > 0
                    ? activity.targetAudience
                    : ['Officers', 'Members'];
                  const isOfficersOnly = audience.length === 1 && (audience[0] === 'Officers' || (audience[0] as string).toLowerCase() === 'officers');
                  const isMembersOnly = audience.length === 1 && (audience[0] === 'Members' || (audience[0] as string).toLowerCase() === 'members');

                  return (
                    <div
                      key={activity.id}
                      className="p-3 sm:p-3.5 hover:bg-[#f7f9f7]/60 transition-colors flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-start md:items-center text-[10.5px] sm:text-xs"
                    >
                      {/* Event Name */}
                      <div className="col-span-4 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold sm:font-extrabold text-[11px] sm:text-xs text-[#1b4332]">{activity.name}</h4>
                          {isOfficersOnly ? (
                            <span className="px-1.5 py-0.2 rounded-md text-[8.5px] sm:text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Officers Only
                            </span>
                          ) : isMembersOnly ? (
                            <span className="px-1.5 py-0.2 rounded-md text-[8.5px] sm:text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Members Only
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-md text-[8.5px] sm:text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              All Club
                            </span>
                          )}
                        </div>
                        <div className="md:hidden text-[10px] text-[#52605d]">Date: {formattedEventDate}</div>
                      </div>

                      {/* Event Date (Desktop) */}
                      <div className="hidden md:block col-span-3 text-[10.5px] sm:text-xs font-semibold text-[#1b4332]">
                        {formattedEventDate}
                      </div>

                      {/* Member Timestamp */}
                      <div className="col-span-3 text-[10.5px] sm:text-xs text-[#52605d]">
                        <span className="md:hidden font-bold text-[#1b4332] mr-1">Timestamp:</span>
                        {record.attended ? (
                          <span className="font-mono font-bold text-[#1b4332] bg-[#f7f9f7] px-1.5 py-0.5 rounded-md border border-[#e2ece2] inline-block text-[10px] sm:text-xs">
                            {record.timestamp}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">—</span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="col-span-2 w-full md:w-auto flex md:justify-end">
                        {record.attended ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                            <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600" />
                            <span>Attended</span>
                          </span>
                        ) : !record.isApplicable ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1 shadow-2xs" title="Not required for your role">
                            <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />
                            <span>N/A ({isOfficersOnly ? 'Officers' : 'Members'})</span>
                          </span>
                        ) : record.isFinished ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                            <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-600" />
                            <span>Absent</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                            <span>Upcoming</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 bg-[#f7f9f7] border-t border-[#e2ece2] text-[10px] sm:text-xs text-[#52605d]">
                <div className="font-semibold text-stone-600 text-[10px] sm:text-xs">
                  Showing <span className="font-extrabold text-[#1b4332]">{(currentMemberPage - 1) * memberItemsPerPage + 1}</span> to{' '}
                  <span className="font-extrabold text-[#1b4332]">
                    {Math.min(currentMemberPage * memberItemsPerPage, filteredMemberActivities.length)}
                  </span>{' '}
                  of <span className="font-extrabold text-[#1b4332]">{filteredMemberActivities.length}</span> activities
                </div>

                {totalMemberPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMemberPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentMemberPage === 1}
                      className="p-1 rounded-lg border border-[#e2ece2] bg-white text-[#1b4332] hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: totalMemberPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setMemberPage(pageNum)}
                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
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
                      className="p-1 rounded-lg border border-[#e2ece2] bg-white text-[#1b4332] hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                      title="Next page"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
    <div className="space-y-2.5 sm:space-y-4 pb-12">
      {/* Sub-Tab Navigation Header */}
      <div className="flex p-0.5 sm:p-1 bg-[#f7f9f7] rounded-lg sm:rounded-xl border border-[#e2ece2] w-full sm:w-auto self-start overflow-x-auto shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('events')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-bold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            activeSubTab === 'events'
              ? 'bg-[#1b4332] text-white shadow-xs'
              : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
          }`}
        >
          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span>Activities & Events</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tracker')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg font-bold text-[10px] sm:text-xs transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            activeSubTab === 'tracker'
              ? 'bg-[#1b4332] text-white shadow-xs'
              : 'text-[#52605d] hover:text-[#1b4332] hover:bg-[#e2ece2]'
          }`}
        >
          <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span>Attendance Tracker</span>
        </button>
      </div>

      {/* Header with Search and Create Activity */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 sm:p-3 bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-xs">
        <div className="flex items-center gap-1.5 flex-1 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-9 pr-2.5 py-1.5 border border-[#e2ece2] rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-2.5 sm:px-3.5 py-1.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Activity</span>
          </button>
        </div>
      </div>

      {/* ACTIVITIES LIST */}
      <div className="space-y-2 sm:space-y-2.5">
        {isLoadingActivities ? (
          <div className="p-8 sm:p-12 text-center text-xs text-[#2d6a4f] bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] flex flex-col items-center justify-center gap-2.5 shadow-2xs">
            <OfficialDotSpinner />
            <span className="font-extrabold text-[#1b4332] mt-1 text-[11px] sm:text-xs">Loading event activities...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-xs text-gray-500 bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2]">
            No matching event activities found.
          </div>
        ) : (
          <>
            {paginatedActivities.map((activity) => {
              const eventLogs = getLogsForActivity(activity);
              const targetedUsers = usersList.filter((u) => isUserTargetedForActivity(u, activity));
              const targetedCount = targetedUsers.length;

              const audience = activity.targetAudience && activity.targetAudience.length > 0
                ? activity.targetAudience
                : ['Officers', 'Members'];
              const isOfficersOnly = audience.length === 1 && (audience[0] === 'Officers' || (audience[0] as string).toLowerCase() === 'officers');
              const isMembersOnly = audience.length === 1 && (audience[0] === 'Members' || (audience[0] as string).toLowerCase() === 'members');

              return (
                <div
                  key={activity.id}
                  onClick={() => handleOpenActivityLogsModal(activity)}
                  className="bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] hover:border-[#74c69d] transition-all duration-200 overflow-hidden shadow-xs p-3 sm:p-4 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-3 hover:bg-[#f7f9f7]/60 group"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold sm:font-extrabold text-xs sm:text-sm text-[#1b4332] group-hover:text-[#2d6a4f] transition-colors truncate">
                        {activity.name}
                      </h3>
                      {isOfficersOnly ? (
                        <span className="px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 shadow-2xs">
                          <Shield className="w-2.5 h-2.5 text-purple-600" />
                          <span>Officers Only</span>
                        </span>
                      ) : isMembersOnly ? (
                        <span className="px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 shadow-2xs">
                          <Users className="w-2.5 h-2.5 text-blue-600" />
                          <span>Members Only</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                          <Users className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Everyone (Officers & Members)</span>
                        </span>
                      )}
                      {(activity.status || 'Open') === 'Closed' ? (
                        <span className="px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 shadow-2xs">
                          <XCircle className="w-2.5 h-2.5 text-rose-600" />
                          <span>Closed</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Open</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-[#52605d] flex items-center gap-1.5 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#2d6a4f]" />
                        {new Date(activity.date).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span className="font-extrabold text-[#1b4332]">
                        {eventLogs.length}/{targetedCount} Attended
                      </span>
                      {isOfficersOnly && (
                        <span className="text-[8.5px] sm:text-[9.5px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded font-semibold">
                          ({targetedCount} Officers)
                        </span>
                      )}
                      {isMembersOnly && (
                        <span className="text-[8.5px] sm:text-[9.5px] text-blue-700 bg-blue-50 px-1 py-0.2 rounded font-semibold">
                          ({targetedCount} Members)
                        </span>
                      )}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditActivity(activity, e)}
                        className="px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#1b4332] border border-[#e2ece2] transition-colors cursor-pointer shadow-2xs active:scale-95"
                        title="Edit Activity"
                      >
                        <Pencil className="w-3 h-3 text-[#2d6a4f]" />
                        <span>Edit</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Officer Activities Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-2 p-3 bg-white rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-2xs text-xs text-[#52605d]">
              <div className="font-semibold">
                Showing <span className="font-extrabold text-[#1b4332]">{(currentActivityPage - 1) * activitiesPerPage + 1}</span> to{' '}
                <span className="font-extrabold text-[#1b4332]">
                  {Math.min(currentActivityPage * activitiesPerPage, filteredActivities.length)}
                </span>{' '}
                of <span className="font-extrabold text-[#1b4332]">{filteredActivities.length}</span> activities
              </div>

              {totalActivityPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentActivityPage === 1}
                    onClick={() => setActivityPage((prev) => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#e2ece2] text-xs font-bold text-[#1b4332] hover:bg-[#f7f9f7] disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalActivityPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setActivityPage(pageNum)}
                        className={`w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentActivityPage === pageNum
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
                    disabled={currentActivityPage === totalActivityPages}
                    onClick={() => setActivityPage((prev) => Math.min(prev + 1, totalActivityPages))}
                    className="px-3 py-1.5 rounded-xl bg-white border border-[#e2ece2] text-xs font-bold text-[#1b4332] hover:bg-[#f7f9f7] disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL FOR VIEWING EVENT ATTENDANCE LOGS */}
      {selectedActivityForModal && (() => {
        const currentModalActivity = activities.find((a) => a.id === selectedActivityForModal.id) || selectedActivityForModal;
        const rawLogs = getLogsForActivity(currentModalActivity);
        const targetedCount = usersList.filter((u) => isUserTargetedForActivity(u, currentModalActivity)).length;

        const audience = currentModalActivity.targetAudience && currentModalActivity.targetAudience.length > 0
          ? currentModalActivity.targetAudience
          : ['Officers', 'Members'];
        const isOfficersOnly = audience.length === 1 && (audience[0] === 'Officers' || (audience[0] as string).toLowerCase() === 'officers');
        const isMembersOnly = audience.length === 1 && (audience[0] === 'Members' || (audience[0] as string).toLowerCase() === 'members');

        const ITEMS_PER_PAGE = 10;
        const totalLogs = rawLogs.length;
        const totalPages = Math.max(1, Math.ceil(totalLogs / ITEMS_PER_PAGE));
        const currentPage = Math.min(Math.max(1, logPage), totalPages);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalLogs);
        const paginatedLogs = rawLogs.slice(startIndex, endIndex);

        return (
          <ModalPortal>
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-5 animate-fadeIn overscroll-contain"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedActivityForModal(null);
              }}
            >
              <div className="bg-white rounded-2xl sm:rounded-[28px] border border-[#e2ece2] w-full max-w-md sm:max-w-xl max-h-[78dvh] sm:max-h-[82dvh] flex flex-col shadow-2xl overflow-hidden relative my-auto">
                {/* Modal Header */}
                <div className="p-3.5 sm:p-4 border-b border-[#e2ece2] bg-[#f7f9f7] flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Table className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      <h3 className="font-extrabold text-sm sm:text-base text-[#1b4332] truncate">
                        {currentModalActivity.name}
                      </h3>
                      {isOfficersOnly ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                          Officers Only
                        </span>
                      ) : isMembersOnly ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                          Members Only
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          All Club
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#52605d] flex items-center gap-1.5 font-medium mt-0.5 truncate">
                      <Calendar className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                      <span>Event Date: {new Date(currentModalActivity.date).toLocaleDateString()}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="px-2.5 py-1 rounded-xl bg-white text-[#1b4332] border border-[#e2ece2] hidden sm:flex items-center gap-1 text-[11px] font-extrabold shadow-2xs">
                      <Table className="w-3 h-3 text-[#2d6a4f]" />
                      <span>Logs</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedActivityForModal(null)}
                      className="p-1.5 sm:p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Close Modal"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Body: Scanned Member Cards with Smooth Scroll */}
                <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex flex-col justify-between space-y-3 min-h-0 overscroll-contain">
                  <div>
                    {isLoadingLogs ? (
                      <div className="py-8 text-center text-gray-500 font-medium bg-white rounded-2xl border border-[#e2ece2] shadow-2xs">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <OfficialDotSpinner />
                          <span className="font-extrabold text-[#1b4332] text-xs mt-1">Loading attendance logs...</span>
                        </div>
                      </div>
                    ) : totalLogs === 0 ? (
                      <div className="py-8 text-center text-stone-500 font-medium bg-white rounded-2xl border border-[#e2ece2] text-xs shadow-2xs">
                        No attendance log records found for this event.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
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
                              className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-[#e2ece2] shadow-2xs hover:border-[#b7d2b7] transition-all space-y-0.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs sm:text-sm font-extrabold text-[#1b4332] truncate">
                                  {formattedName}
                                </h4>
                                <span className="font-mono font-bold text-[11px] sm:text-xs text-[#2d6a4f] bg-[#d8f3dc]/70 px-2 py-0.5 rounded-lg shrink-0">
                                  {time}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 font-medium truncate">
                                {network}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {totalLogs > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#e2ece2] text-xs">
                      <span className="text-[#52605d] font-semibold text-[11px]">
                        Showing <span className="font-extrabold text-[#1b4332]">{startIndex + 1}-{endIndex}</span> of <span className="font-extrabold text-[#1b4332]">{totalLogs}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setLogPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="p-1 sm:px-2 sm:py-1 rounded-lg border border-[#e2ece2] bg-white text-[#1b4332] font-extrabold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7f9f7] active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Prev</span>
                        </button>
                        <span className="px-1.5 font-extrabold text-[#1b4332] text-xs">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLogPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="p-1 sm:px-2 sm:py-1 rounded-lg border border-[#e2ece2] bg-white text-[#1b4332] font-extrabold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7f9f7] active:scale-95 transition-all flex items-center gap-0.5 cursor-pointer shadow-2xs"
                        >
                          <span className="hidden sm:inline">Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-3 sm:p-4 bg-[#f7f9f7] border-t border-[#e2ece2] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs sm:text-sm text-[#1b4332] bg-white px-2.5 py-1 rounded-xl border border-[#e2ece2] shadow-2xs">
                      {rawLogs.length} / {targetedCount} Attended
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditActivity(currentModalActivity)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-white hover:bg-stone-100 text-[#1b4332] border border-[#e2ece2] transition-colors cursor-pointer shadow-2xs"
                        title="Edit Activity Details"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#2d6a4f]" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => toggleStatus(e, currentModalActivity.id)}
                      className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
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
                      type="button"
                      onClick={() => setActivityToDelete(currentModalActivity)}
                      className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
                      title="Delete Activity"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ModalPortal>
        );
      })()}

      {/* Modal for Creating New Activity */}
      {isCreateModalOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-2.5 sm:p-4 animate-fadeIn overscroll-contain"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCreateModalOpen(false);
            }}
          >
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#e2ece2] space-y-2.5 sm:space-y-3.5 w-full max-w-sm sm:max-w-md shadow-2xl relative my-auto max-h-[90dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <h3 className="font-extrabold text-sm sm:text-base text-[#1b4332]">Create New Event Activity</h3>
              <div className="space-y-2.5 sm:space-y-3">
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider mb-1">
                    Event / Activity Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Officers Meeting or Club Ride"
                    value={newActivityName}
                    onChange={(e) => setNewActivityName(e.target.value)}
                    className="w-full p-2 sm:p-2.5 border border-[#e2ece2] rounded-lg sm:rounded-xl text-[11px] sm:text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={newActivityDate}
                    onChange={(e) => setNewActivityDate(e.target.value)}
                    className="w-full p-2 sm:p-2.5 border border-[#e2ece2] rounded-lg sm:rounded-xl text-[11px] sm:text-xs bg-[#f7f9f7] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Target Audience Selector */}
                <div className="space-y-1.5 sm:space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] sm:text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider">
                      Target Audience / Participants
                    </label>
                    <span className="text-[9px] sm:text-[10px] text-stone-400 font-medium">Select participants</span>
                  </div>

                  {/* Interactive Cards */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                    {/* Officers Option */}
                    <button
                      type="button"
                      onClick={() => {
                        if (newActivityAudience.includes('Officers')) {
                          if (newActivityAudience.length > 1) {
                            setNewActivityAudience(newActivityAudience.filter((a) => a !== 'Officers'));
                          }
                        } else {
                          setNewActivityAudience([...newActivityAudience, 'Officers']);
                        }
                      }}
                      className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        newActivityAudience.includes('Officers')
                          ? 'border-purple-300 bg-purple-50/80 text-purple-950 shadow-2xs'
                          : 'border-[#e2ece2] bg-[#f7f9f7] text-[#52605d] hover:bg-stone-100/70 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 font-extrabold text-[11px] sm:text-xs text-[#1b4332]">
                          <Shield className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${newActivityAudience.includes('Officers') ? 'text-purple-600' : 'text-stone-400'}`} />
                          <span>Officers</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={newActivityAudience.includes('Officers')}
                          readOnly
                          className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded text-purple-600 accent-purple-600 pointer-events-none"
                        />
                      </div>
                      <p className="text-[9px] sm:text-[9.5px] text-stone-500 font-medium leading-tight">
                        Club Executives & Officers
                      </p>
                    </button>

                    {/* Members Option */}
                    <button
                      type="button"
                      onClick={() => {
                        if (newActivityAudience.includes('Members')) {
                          if (newActivityAudience.length > 1) {
                            setNewActivityAudience(newActivityAudience.filter((a) => a !== 'Members'));
                          }
                        } else {
                          setNewActivityAudience([...newActivityAudience, 'Members']);
                        }
                      }}
                      className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                        newActivityAudience.includes('Members')
                          ? 'border-blue-300 bg-blue-50/80 text-blue-950 shadow-2xs'
                          : 'border-[#e2ece2] bg-[#f7f9f7] text-[#52605d] hover:bg-stone-100/70 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 font-extrabold text-[11px] sm:text-xs text-[#1b4332]">
                          <Users className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${newActivityAudience.includes('Members') ? 'text-blue-600' : 'text-stone-400'}`} />
                          <span>Members</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={newActivityAudience.includes('Members')}
                          readOnly
                          className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded text-blue-600 accent-blue-600 pointer-events-none"
                        />
                      </div>
                      <p className="text-[9px] sm:text-[9.5px] text-stone-500 font-medium leading-tight">
                        General Club Members
                      </p>
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setNewActivityAudience(['Officers'])}
                      className={`py-1 px-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-extrabold text-center truncate transition-all cursor-pointer ${
                        newActivityAudience.length === 1 && newActivityAudience.includes('Officers')
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2] hover:bg-stone-100'
                      }`}
                    >
                      Officers Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewActivityAudience(['Members'])}
                      className={`py-1 px-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-extrabold text-center truncate transition-all cursor-pointer ${
                        newActivityAudience.length === 1 && newActivityAudience.includes('Members')
                          ? 'bg-blue-700 text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2] hover:bg-stone-100'
                      }`}
                    >
                      Members Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewActivityAudience(['Officers', 'Members'])}
                      className={`py-1 px-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-extrabold text-center truncate transition-all cursor-pointer ${
                        newActivityAudience.includes('Officers') && newActivityAudience.includes('Members')
                          ? 'bg-[#1b4332] text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2] hover:bg-stone-100'
                      }`}
                    >
                      Everyone (All)
                    </button>
                  </div>

                  <p className="text-[9px] sm:text-[10px] text-[#52605d] bg-[#f7f9f7] p-2 rounded-lg sm:rounded-xl border border-[#e2ece2] font-medium leading-relaxed">
                    <span className="font-extrabold text-[#1b4332]">Rule:</span> Select <span className="font-bold text-purple-700">Officers</span> for officer meetings, <span className="font-bold text-blue-700">Members</span> for member events, or <span className="font-bold text-[#1b4332]">BOTH</span> for all.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-1.5 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createActivity}
                  disabled={!newActivityName || !newActivityDate || newActivityAudience.length === 0}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer shadow-2xs"
                >
                  Create Event
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal for Editing Activity */}
      {editingActivity && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-2.5 sm:p-4 animate-fadeIn overscroll-contain"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingActivity(null);
            }}
          >
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#e2ece2] space-y-3 sm:space-y-3.5 w-full max-w-md shadow-2xl relative my-auto max-h-[92dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 text-stone-400 hover:text-stone-700 cursor-pointer p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <div className="flex items-center gap-2 text-[#1b4332]">
                <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 border border-emerald-100 shrink-0">
                  <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-[#1b4332]">Edit Event Activity</h3>
                  <p className="text-[10px] sm:text-xs text-stone-500 font-medium">Update activity details and attendance settings</p>
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-3 pt-0.5">
                <div>
                  <label className="block text-[10px] sm:text-xs font-extrabold text-[#1b4332] mb-1">
                    Activity / Event Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editActivityName}
                    onChange={(e) => setEditActivityName(e.target.value)}
                    placeholder="e.g., Weekly Training Ride, Monthly Officers Meeting"
                    className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs border border-[#e2ece2] rounded-lg sm:rounded-xl focus:outline-hidden focus:border-[#2d6a4f] focus:ring-1 focus:ring-[#2d6a4f] bg-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-extrabold text-[#1b4332] mb-1">
                      Event Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={editActivityDate}
                      onChange={(e) => setEditActivityDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs border border-[#e2ece2] rounded-lg sm:rounded-xl focus:outline-hidden focus:border-[#2d6a4f] focus:ring-1 focus:ring-[#2d6a4f] bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] sm:text-xs font-extrabold text-[#1b4332] mb-1">
                      Event Status
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditActivityStatus('Open')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          editActivityStatus === 'Open'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditActivityStatus('Closed')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          editActivityStatus === 'Closed'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Closed</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Target Audience Selector */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] sm:text-xs font-extrabold text-[#1b4332]">
                      Target Participants / Audience <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[9px] sm:text-[10px] text-stone-500 font-semibold">
                      {editActivityAudience.length === 2
                        ? 'All Members & Officers'
                        : editActivityAudience.includes('Officers')
                        ? 'Officers Meeting'
                        : editActivityAudience.includes('Members')
                        ? 'Regular Members'
                        : 'Select Audience'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {/* Officers Option */}
                    <label
                      className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border cursor-pointer transition-all ${
                        editActivityAudience.includes('Officers')
                          ? 'border-purple-500 bg-purple-50/70 shadow-2xs ring-1 ring-purple-400'
                          : 'border-[#e2ece2] bg-white hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editActivityAudience.includes('Officers')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditActivityAudience((prev) => Array.from(new Set([...prev, 'Officers'])));
                          } else {
                            if (editActivityAudience.length > 1) {
                              setEditActivityAudience((prev) => prev.filter((a) => a !== 'Officers'));
                            }
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="text-[11px] sm:text-xs font-extrabold text-[#1b4332] truncate">Officers</span>
                        </div>
                        <p className="text-[9px] text-stone-500 font-medium truncate">Club leaders & executives</p>
                      </div>
                    </label>

                    {/* Members Option */}
                    <label
                      className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border cursor-pointer transition-all ${
                        editActivityAudience.includes('Members')
                          ? 'border-blue-500 bg-blue-50/70 shadow-2xs ring-1 ring-blue-400'
                          : 'border-[#e2ece2] bg-white hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editActivityAudience.includes('Members')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditActivityAudience((prev) => Array.from(new Set([...prev, 'Members'])));
                          } else {
                            if (editActivityAudience.length > 1) {
                              setEditActivityAudience((prev) => prev.filter((a) => a !== 'Members'));
                            }
                          }
                        }}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-[11px] sm:text-xs font-extrabold text-[#1b4332] truncate">Members</span>
                        </div>
                        <p className="text-[9px] text-stone-500 font-medium truncate">All registered club riders</p>
                      </div>
                    </label>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setEditActivityAudience(['Officers'])}
                      className={`py-1 px-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-extrabold text-center truncate transition-all cursor-pointer ${
                        editActivityAudience.length === 1 && editActivityAudience[0] === 'Officers'
                          ? 'bg-purple-700 text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2] hover:bg-purple-50 hover:text-purple-800'
                      }`}
                    >
                      Officers Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActivityAudience(['Members'])}
                      className={`py-1 px-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-extrabold text-center truncate transition-all cursor-pointer ${
                        editActivityAudience.length === 1 && editActivityAudience[0] === 'Members'
                          ? 'bg-blue-700 text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2] hover:bg-blue-50 hover:text-blue-800'
                      }`}
                    >
                      Members Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActivityAudience(['Officers', 'Members'])}
                      className={`py-1 px-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-extrabold text-center truncate transition-all cursor-pointer ${
                        editActivityAudience.includes('Officers') && editActivityAudience.includes('Members')
                          ? 'bg-[#1b4332] text-white shadow-2xs'
                          : 'bg-[#f7f9f7] text-[#52605d] border border-[#e2ece2] hover:bg-stone-100'
                      }`}
                    >
                      Everyone (All)
                    </button>
                  </div>

                  <p className="text-[9px] sm:text-[10px] text-[#52605d] bg-[#f7f9f7] p-2 rounded-lg sm:rounded-xl border border-[#e2ece2] font-medium leading-relaxed">
                    <span className="font-extrabold text-[#1b4332]">Note:</span> Changes will immediately update attendance validation and scanner requirements.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-1.5 border-t border-[#e2ece2]">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditedActivity}
                  disabled={!editActivityName.trim() || !editActivityDate.trim() || editActivityAudience.length === 0 || isSavingEdit}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal for Delete Activity Confirmation */}
      {activityToDelete && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4 animate-fadeIn overscroll-contain"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActivityToDelete(null);
            }}
          >
            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#e2ece2] space-y-4 w-full max-w-md shadow-2xl relative my-auto max-h-[82dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100 shrink-0">
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
                  type="button"
                  onClick={() => setActivityToDelete(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-extrabold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteActivity}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
