import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store } from '../lib/db';
import { RideLog, User } from '../types';
import {
  Trophy,
  PlusCircle,
  Medal,
  Award,
  Bike,
  CheckCircle2,
  Calendar,
  Zap,
  Flame,
  X,
  MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MileageLeaderboardProps {
  onOpenLogModal?: () => void;
}

export const MileageLeaderboard: React.FC<MileageLeaderboardProps> = ({ onOpenLogModal }) => {
  const { currentUser, refreshUserData } = useAuth();
  const [members, setMembers] = useState<User[]>(() =>
    store.getUsers().filter((m) => m.role !== 'admin')
  );
  const [rideLogs, setRideLogs] = useState<RideLog[]>(() => store.getRideLogs());
  const [timeframe, setTimeframe] = useState<'all' | 'monthly' | 'weekly'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  useModalDismiss(modalOpen, () => setModalOpen(false));
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState(65);
  const [duration, setDuration] = useState(90);
  const [elevation, setElevation] = useState(1800);
  const [routeName, setRouteName] = useState('Pacific Coast Highway');
  const [notes, setNotes] = useState('');

  const refreshData = () => {
    setMembers([...store.getUsers().filter((m) => m.role !== 'admin')]);
    setRideLogs([...store.getRideLogs()]);
    refreshUserData();
  };

  const sortedMembers = [...members].sort((a, b) => (b.totalMiles || 0) - (a.totalMiles || 0));
  const topThree = sortedMembers.slice(0, 3);
  const restRankings = sortedMembers.slice(3);

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const avgSpeed = Math.round((distance / (duration / 60)) * 10) / 10;

    store.logRide({
      userId: currentUser.id,
      userName: currentUser.name,
      title: title || `${routeName} Sweep`,
      distanceMiles: Number(distance),
      durationMinutes: Number(duration),
      elevationGainFt: Number(elevation),
      avgSpeedMph: avgSpeed,
      date: new Date().toISOString().split('T')[0],
      routeName,
      notes,
    });

    setModalOpen(false);
    setTitle('');
    setNotes('');
    refreshData();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-[#1b4332] flex items-center gap-2">
            <Trophy className="w-7 h-7 text-[#2d6a4f]" />
            Club Mileage Standings & Log
          </h2>
          <p className="text-xs text-[#52605d] mt-0.5">
            Log your individual rides, verify mileage stats, and scale the club leaderboard
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="py-2.5 px-5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Log Ride Mileage
        </button>
      </div>

      {/* Timeframe Toggle */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: 'All-Time Mileage' },
          { id: 'monthly', label: 'Monthly Standings' },
          { id: 'weekly', label: 'Weekly Sprint' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTimeframe(t.id as any)}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              timeframe === t.id
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#52605d] border border-[#e2ece2] hover:text-[#1b4332]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Top 3 Podium Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topThree.map((m, idx) => {
          const podiumOrder = idx === 0 ? 1 : idx === 1 ? 2 : 3;
          const bgGlow =
            idx === 0
              ? 'border-[#b7e4c7] bg-[#d8f3dc]/40'
              : 'border-[#e2ece2] bg-white';

          return (
            <motion.div
              key={m.id}
              whileHover={{ y: -3 }}
              className={`p-6 rounded-3xl border ${bgGlow} flex flex-col items-center text-center space-y-3 relative overflow-hidden shadow-xs`}
            >
              {/* Podium Rank Chip */}
              <div
                className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center font-heading font-extrabold text-xs ${
                  idx === 0
                    ? 'bg-[#1b4332] text-white'
                    : 'bg-[#d8f3dc] text-[#1b4332]'
                }`}
              >
                #{podiumOrder}
              </div>

              <div className="relative">
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#e2ece2] shadow-xs"
                />
                <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white text-[#2d6a4f] border border-[#e2ece2]">
                  <Award className="w-4 h-4" />
                </span>
              </div>

              <div>
                <h3 className="font-heading font-extrabold text-[#1b4332] text-base">
                  {m.name}
                </h3>
                <p className="text-xs text-[#52605d] font-mono">
                  {m.bikeInfo.make} {m.bikeInfo.model}
                </p>
              </div>

              <div className="p-3 w-full rounded-2xl bg-white border border-[#e2ece2] space-y-1">
                <span className="text-[10px] text-[#52605d] uppercase font-bold tracking-wider">
                  Total Miles
                </span>
                <p className="font-heading text-2xl font-black text-[#1b4332]">
                  {(m.totalMiles || 0).toLocaleString()}{' '}
                  <span className="text-xs font-normal text-[#52605d]">mi</span>
                </p>
                <div className="flex justify-center gap-3 text-[11px] text-[#52605d] font-medium pt-1">
                  <span>{m.totalRides || 0} rides</span>
                  <span>•</span>
                  <span className="text-[#2d6a4f] flex items-center gap-0.5">
                    <Flame className="w-3 h-3 fill-[#2d6a4f]" />
                    {m.streakDays || 0}d streak
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Standings Table for Remaining Riders */}
      <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs">
        <h3 className="font-heading font-bold text-[#1b4332] text-base">
          Full Rider Standings Ledger
        </h3>

        <div className="space-y-2">
          {sortedMembers.map((m, index) => (
            <div
              key={m.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                currentUser?.id === m.id
                  ? 'bg-[#d8f3dc] border-[#b7e4c7]'
                  : 'bg-[#f7f9f7] border-[#e2ece2]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-mono font-bold text-[#52605d]">
                  #{index + 1}
                </span>
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="w-9 h-9 rounded-full object-cover border border-[#e2ece2]"
                />
                <div>
                  <h4 className="font-bold text-[#1b4332] flex items-center gap-2">
                    {m.name}
                    {currentUser?.id === m.id && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1b4332] text-white font-bold">
                        YOU
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-[#52605d]">
                    {m.memberNumber} • {m.bikeInfo.make} {m.bikeInfo.model}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="font-heading font-extrabold text-[#1b4332] text-sm">
                  {(m.totalMiles || 0).toLocaleString()} mi
                </span>
                <p className="text-[10px] text-[#52605d]">{m.totalRides || 0} logged rides</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Verified Ride Logs Feed */}
      <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs">
        <h3 className="font-heading font-bold text-[#1b4332] text-base">
          Recent Verified Ride Activity
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rideLogs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1b4332]">{log.userName}</span>
                <span className="text-[10px] text-[#52605d] font-mono">{log.date}</span>
              </div>
              <h4 className="text-[#2d6a4f] font-semibold">{log.title}</h4>
              <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-white border border-[#e2ece2] text-[11px] text-center">
                <div>
                  <span className="text-[#52605d] block">Distance</span>
                  <strong className="text-[#1b4332]">{log.distanceMiles} mi</strong>
                </div>
                <div>
                  <span className="text-[#52605d] block">Duration</span>
                  <strong className="text-[#1b4332]">{log.durationMinutes} mins</strong>
                </div>
                <div>
                  <span className="text-[#52605d] block">Avg Pace</span>
                  <strong className="text-[#2d6a4f]">{log.avgSpeedMph} mph</strong>
                </div>
              </div>
              {log.notes && <p className="text-[11px] text-[#52605d] italic">"{log.notes}"</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Log Ride Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl text-[#2d3a3a]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2]">
                <h3 className="font-heading font-bold text-[#1b4332] text-lg">
                  Log New Ride Mileage
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 text-[#52605d] hover:text-[#1b4332] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleLogSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Ride Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Angeles Crest Weekend Sweep"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Distance (Miles)</label>
                    <input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(Number(e.target.value))}
                      required
                      min={1}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Duration (Minutes)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      required
                      min={5}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Elevation Gain (ft)</label>
                    <input
                      type="number"
                      value={elevation}
                      onChange={(e) => setElevation(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Route Name</label>
                    <input
                      type="text"
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="PCH / Mulholland"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Ride Notes / Reflections</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Weather, pavement condition, tire wear..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Confirm & Log Mileage
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
