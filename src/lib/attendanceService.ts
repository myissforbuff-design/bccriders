import { authFetch } from './db';
import { User, Activity, ActivityAttendance } from '../types';

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
  manualEntry?: boolean;
  markedBy?: string;
  [key: string]: any;
}

/**
 * Checks if a member attended a specific activity using both MongoDB attendanceLogs and activity.attendance
 */
export function findAttendanceRecord(
  activity: Activity,
  user: User,
  attendanceLogs: AttendanceLogDoc[] = []
): { attended: boolean; logDoc?: AttendanceLogDoc; attendanceItem?: ActivityAttendance; timestamp?: string } {
  const memNo = (user.memberNumber || '').toLowerCase().trim();
  const memNoDigits = memNo.replace(/[^a-z0-9]/g, '');
  const userId = (user.id || '').toLowerCase().trim();
  const userIdDigits = userId.replace(/[^a-z0-9]/g, '');
  const userName = (user.name || '').toLowerCase().trim();
  const userUsername = (user.username || '').toLowerCase().trim();
  const actNameLower = (activity.name || '').toLowerCase().trim();

  // 1. Search in attendanceLogs
  const matchedLog = attendanceLogs.find((log) => {
    const logActId = (log.activityId || log['Activity ID'] || '').trim();
    const eName = (log['Event Name'] || log.eventName || '').toLowerCase().trim();
    const isActMatch = (logActId && logActId === activity.id) || (eName && eName === actNameLower);
    if (!isActMatch) return false;

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

  if (matchedLog) {
    const dateStamp = matchedLog['Date Stamp'] || matchedLog.dateStamp || matchedLog['Event Date'] || activity.date;
    const timeStamp = matchedLog['Time Stamp'] || matchedLog.timeStamp || 'Recorded';
    return {
      attended: true,
      logDoc: matchedLog,
      timestamp: `${dateStamp} ${timeStamp}`.trim(),
    };
  }

  // 2. Search in activity.attendance array
  if (activity.attendance && Array.isArray(activity.attendance)) {
    const matchedAtt = activity.attendance.find((att) => {
      const attMemId = (att.memberId || '').toLowerCase().trim();
      const attMemIdDigits = attMemId.replace(/[^a-z0-9]/g, '');
      if (attMemId && (attMemId === memNo || attMemId === userId)) return true;
      if (attMemIdDigits && (attMemIdDigits === memNoDigits || attMemIdDigits === userIdDigits)) return true;

      const attName = (att.name || '').toLowerCase().trim();
      if (attName && (attName === userName || attName === userUsername)) return true;

      return false;
    });

    if (matchedAtt) {
      return {
        attended: true,
        attendanceItem: matchedAtt,
        timestamp: `${matchedAtt.date || activity.date} ${matchedAtt.time || ''}`.trim(),
      };
    }
  }

  return { attended: false };
}

/**
 * Manually marks a member as PRESENT for an activity.
 * Creates an attendanceLog in MongoDB and updates the activity.attendance array.
 */
export async function markMemberPresent(
  activity: Activity,
  user: User,
  options?: {
    dateStamp?: string;
    timeStamp?: string;
    markedBy?: string;
  }
): Promise<{ success: boolean; updatedActivity: Activity; newLog: AttendanceLogDoc }> {
  const nameParts = (user.name || '').trim().split(/\s+/);
  const firstName = user.firstName || nameParts[0] || user.name || 'Member';
  const lastName = user.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
  const memberId = user.memberNumber || user.id || 'BRC-0000';
  const network = user.network || 'Main Chapter';

  const now = new Date();
  const effectiveDateStamp =
    options?.dateStamp || activity.date || now.toISOString().split('T')[0];
  const effectiveTimeStamp =
    options?.timeStamp ||
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const logId = `attlog_man_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newLog: AttendanceLogDoc = {
    id: logId,
    activityId: activity.id,
    'Activity ID': activity.id,
    'Event Name': activity.name,
    'Event Date': activity.date,
    eventName: activity.name,
    eventDate: activity.date,
    'Member ID': memberId,
    memberId,
    'Last Name': lastName,
    lastName,
    'First Name': firstName,
    firstName,
    'Network': network,
    network,
    'Date Stamp': effectiveDateStamp,
    dateStamp: effectiveDateStamp,
    'Time Stamp': effectiveTimeStamp,
    timeStamp: effectiveTimeStamp,
    createdAt: now.toISOString(),
    manualEntry: true,
    markedBy: options?.markedBy || 'Administrator',
  };

  const newAttendanceItem: ActivityAttendance = {
    name: user.name || `${firstName} ${lastName}`.trim(),
    memberId,
    network,
    date: effectiveDateStamp,
    time: effectiveTimeStamp,
  };

  const currentAttendance = Array.isArray(activity.attendance) ? activity.attendance : [];
  // Remove existing if any (to prevent duplicates)
  const filteredAttendance = currentAttendance.filter((a) => {
    const aMem = (a.memberId || '').toLowerCase().trim();
    const aName = (a.name || '').toLowerCase().trim();
    return (
      aMem !== memberId.toLowerCase().trim() &&
      aName !== (user.name || '').toLowerCase().trim()
    );
  });

  const updatedActivity: Activity = {
    ...activity,
    attendance: [...filteredAttendance, newAttendanceItem],
  };

  // Sync to database
  try {
    await Promise.all([
      authFetch('/api/mongodb/attendanceLogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog),
      }),
      authFetch('/api/mongodb/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedActivity),
      }),
    ]);
  } catch (err) {
    console.error('Error saving manual attendance:', err);
  }

  // Dispatch custom events for instant reactive UI updates across all components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bcc_activities_updated', {
        detail: { activity: updatedActivity, attendanceLog: newLog },
      })
    );
    window.dispatchEvent(
      new CustomEvent('bcc_attendance_updated', {
        detail: { activity: updatedActivity, attendanceLog: newLog },
      })
    );
    try {
      localStorage.setItem('bcc_activity_sync_time', Date.now().toString());
    } catch {}
  }

  return { success: true, updatedActivity, newLog };
}

/**
 * Manually marks a member as ABSENT for an activity.
 * Removes the member from activity.attendance array and deletes matching logs from MongoDB attendanceLogs.
 */
export async function markMemberAbsent(
  activity: Activity,
  user: User,
  matchingLogId?: string
): Promise<{ success: boolean; updatedActivity: Activity }> {
  const memNo = (user.memberNumber || '').toLowerCase().trim();
  const userId = (user.id || '').toLowerCase().trim();
  const uName = (user.name || '').toLowerCase().trim();

  const currentAttendance = Array.isArray(activity.attendance) ? activity.attendance : [];
  const updatedAttendance = currentAttendance.filter((a) => {
    const aMem = (a.memberId || '').toLowerCase().trim();
    const aName = (a.name || '').toLowerCase().trim();
    if (memNo && aMem === memNo) return false;
    if (userId && aMem === userId) return false;
    if (uName && (aName === uName || aName.includes(uName) || uName.includes(aName))) return false;
    return true;
  });

  const updatedActivity: Activity = {
    ...activity,
    attendance: updatedAttendance,
  };

  try {
    const promises: Promise<any>[] = [
      authFetch('/api/mongodb/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedActivity),
      }),
      authFetch('/api/mongodb/attendanceLogs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: matchingLogId,
          activityId: activity.id,
          eventName: activity.name,
          memberId: user.memberNumber || user.id,
          memberNumber: user.memberNumber,
          userName: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
        }),
      }),
    ];

    if (matchingLogId) {
      promises.push(
        authFetch(`/api/mongodb/attendanceLogs/${matchingLogId}`, {
          method: 'DELETE',
        })
      );
    }

    await Promise.all(promises);
  } catch (err) {
    console.error('Error removing attendance record:', err);
  }

  // Dispatch custom events for instant reactive UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bcc_activities_updated', {
        detail: { activity: updatedActivity, removedUserId: user.id },
      })
    );
    window.dispatchEvent(
      new CustomEvent('bcc_attendance_updated', {
        detail: { activity: updatedActivity, removedUserId: user.id },
      })
    );
    try {
      localStorage.setItem('bcc_activity_sync_time', Date.now().toString());
    } catch {}
  }

  return { success: true, updatedActivity };
}
