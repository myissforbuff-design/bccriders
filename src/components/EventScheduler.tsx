import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { store } from '../lib/db';
import { Event, EventType, PaceLevel } from '../types';
import { PaymentModal } from './PaymentModal';
import { CustomSelect } from './CustomSelect';
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Shield,
  CheckCircle,
  X,
  Bike,
  Sparkles,
  Ticket,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EventSchedulerProps {
  onOpenMapRoute?: (routeId: string) => void;
}

export const EventScheduler: React.FC<EventSchedulerProps> = ({ onOpenMapRoute }) => {
  const { currentUser, isAdmin, refreshUserData } = useAuth();
  const [events, setEvents] = useState<Event[]>(() => store.getEvents());
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [eventToPay, setEventToPay] = useState<Event | null>(null);

  // New Event Form Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useModalDismiss(createModalOpen, () => setCreateModalOpen(false));
  useModalDismiss(!!selectedEvent, () => setSelectedEvent(null));
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<EventType>('Group Ride');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('2026-08-18');
  const [newTime, setNewTime] = useState('08:00');
  const [newStartLoc, setNewStartLoc] = useState('BCC Clubhouse Main Lot');
  const [newEndLoc, setNewEndLoc] = useState('');
  const [newDistance, setNewDistance] = useState(75);
  const [newPace, setNewPace] = useState<PaceLevel>('Moderate 20-25mph');
  const [newFee, setNewFee] = useState(0);
  const [newMax, setNewMax] = useState(25);
  const [newGear, setNewGear] = useState('Full Face Helmet, Leather Jacket, Gloves');

  const refreshList = () => {
    setEvents([...store.getEvents()]);
    refreshUserData();
  };

  const filteredEvents = events.filter(
    (e) => typeFilter === 'All' || e.type === typeFilter
  );

  const handleRSVP = (evt: Event) => {
    if (!currentUser) return;

    // Check if already registered
    if (evt.registeredUserIds.includes(currentUser.id)) {
      alert('You are already registered for this event!');
      return;
    }

    if (evt.fee > 0) {
      setEventToPay(evt);
      setPayModalOpen(true);
    } else {
      store.registerForEvent(evt.id, currentUser.id, 0);
      refreshList();
      if (selectedEvent && selectedEvent.id === evt.id) {
        setSelectedEvent({ ...evt, registeredUserIds: [...evt.registeredUserIds, currentUser.id] });
      }
    }
  };

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    store.createEvent({
      title: newTitle,
      type: newType,
      description: newDesc,
      date: newDate,
      time: newTime,
      startLocation: newStartLoc,
      endLocation: newEndLoc || undefined,
      distanceMiles: Number(newDistance),
      paceLevel: newPace,
      fee: Number(newFee),
      maxAttendees: Number(newMax),
      mandatoryGear: newGear.split(',').map((g) => g.trim()),
      status: 'Upcoming',
      createdBy: currentUser.id,
    });

    setCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    refreshList();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-[#1b4332] flex items-center gap-2">
            <Calendar className="w-7 h-7 text-[#2d6a4f]" />
            Ride & Event Scheduler
          </h2>
          <p className="text-xs text-[#52605d] mt-0.5">
            Group rides, chapter meetings, technical workshops, and high-altitude rallies
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Schedule New Event
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {['All', 'Group Ride', 'Club Meeting', 'Workshop', 'Rally'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              typeFilter === t
                ? 'bg-[#1b4332] text-white shadow-xs'
                : 'bg-white text-[#52605d] border border-[#e2ece2] hover:text-[#1b4332]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredEvents.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-[#e2ece2] space-y-3 shadow-xs">
            <Calendar className="w-10 h-10 text-[#2d6a4f] mx-auto opacity-40" />
            <h3 className="font-heading font-bold text-[#1b4332] text-base">No Scheduled Ride Events</h3>
            <p className="text-xs text-[#52605d] max-w-md mx-auto">
              There are currently no events matching your filter. Click "Schedule New Club Ride" above to organize a ride or meeting!
            </p>
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isRegistered = currentUser ? evt.registeredUserIds.includes(currentUser.id) : false;
            const seatsLeft = evt.maxAttendees ? evt.maxAttendees - evt.registeredUserIds.length : null;

            return (
              <motion.div
                key={evt.id}
                whileHover={{ y: -2 }}
                onClick={() => setSelectedEvent(evt)}
                className="p-6 rounded-3xl bg-white border border-[#e2ece2] hover:border-[#b7e4c7] transition-all cursor-pointer space-y-4 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Event Top Badge */}
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#d8f3dc] text-[#1b4332]">
                      {evt.type}
                    </span>

                    <div className="flex items-center gap-2 text-xs font-mono text-[#2d6a4f] font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-[#2d6a4f]" />
                      <span>{evt.date} @ {evt.time}</span>
                    </div>
                  </div>

                  <h3 className="font-heading text-lg font-bold text-[#1b4332] group-hover:text-[#2d6a4f] transition-colors">
                    {evt.title}
                  </h3>

                  <p className="text-xs text-[#52605d] line-clamp-2 leading-relaxed">
                    {evt.description}
                  </p>

                  {/* Key Attributes */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-medium pt-2 border-t border-[#e2ece2]">
                    <div className="text-[#2d3a3a] flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                      <span className="truncate">{evt.startLocation}</span>
                    </div>

                    <div className="text-[#2d3a3a] flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                      <span>{evt.distanceMiles > 0 ? `${evt.distanceMiles} mi • ${evt.paceLevel}` : 'Stationary Event'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-4 border-t border-[#e2ece2] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-extrabold text-[#1b4332] text-base">
                      {evt.fee > 0 ? `₱${evt.fee.toLocaleString()}.00` : 'Free'}
                    </span>
                    {seatsLeft !== null && (
                      <span className="text-[10px] text-[#52605d]">
                        ({seatsLeft} seats remaining)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isRegistered ? (
                      <span className="py-1.5 px-3 rounded-xl bg-[#d8f3dc] text-[#1b4332] text-xs font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-[#2d6a4f]" />
                        RSVP Confirmed
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRSVP(evt);
                        }}
                        className="py-1.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Ticket className="w-3.5 h-3.5 text-[#74c69d]" />
                        {evt.fee > 0 ? `Register (₱${evt.fee.toLocaleString()})` : 'RSVP Free'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Event Details Drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl rounded-3xl bg-white border border-[#e2ece2] shadow-2xl overflow-hidden my-8 text-[#2d3a3a]"
            >
              <div className="p-6 bg-[#f7f9f7] border-b border-[#e2ece2] flex items-center justify-between">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#d8f3dc] text-[#1b4332] uppercase">
                    {selectedEvent.type}
                  </span>
                  <h3 className="font-heading font-bold text-[#1b4332] text-lg mt-1">
                    {selectedEvent.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 text-[#52605d] hover:text-[#1b4332] rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
                {/* Logistics Bar */}
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-[#52605d] block">Date & Time</span>
                    <strong className="text-[#1b4332] font-mono">{selectedEvent.date} @ {selectedEvent.time}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#52605d] block">Distance & Pace</span>
                    <strong className="text-[#2d6a4f]">{selectedEvent.distanceMiles} mi ({selectedEvent.paceLevel})</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#52605d] block">Registration Fee</span>
                    <strong className="text-[#1b4332]">{selectedEvent.fee > 0 ? `₱${selectedEvent.fee.toLocaleString()}.00` : 'FREE'}</strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-[#1b4332] text-sm">Event Overview</h4>
                  <p className="text-[#52605d] leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>

                {/* Locations */}
                <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#1b4332] block">Start / Staging Ground</strong>
                      <span className="text-[#52605d]">{selectedEvent.startLocation}</span>
                    </div>
                  </div>
                  {selectedEvent.endLocation && (
                    <div className="flex items-start gap-2 pt-2 border-t border-[#e2ece2]">
                      <MapPin className="w-4 h-4 text-[#2d6a4f] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#1b4332] block">Destination</strong>
                        <span className="text-[#52605d]">{selectedEvent.endLocation}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mandatory Gear Checklist */}
                {selectedEvent.mandatoryGear.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-2">
                    <span className="font-bold text-[#1b4332] flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#2d6a4f]" />
                      Mandatory Safety Gear Checklist
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[#52605d]">
                      {selectedEvent.mandatoryGear.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Registration Trigger */}
                <div className="pt-2">
                  {currentUser && selectedEvent.registeredUserIds.includes(currentUser.id) ? (
                    <div className="p-3.5 rounded-2xl bg-[#d8f3dc] text-[#1b4332] text-center font-bold">
                      ✓ You are registered for this ride event.
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRSVP(selectedEvent)}
                      className="w-full py-3.5 px-6 rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-sm transition-all cursor-pointer shadow-md"
                    >
                      {selectedEvent.fee > 0
                        ? `Proceed to Payment Gateway (₱${selectedEvent.fee.toLocaleString()}.00)`
                        : 'Confirm Free RSVP Registration'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Gateway Modal */}
      {eventToPay && (
        <PaymentModal
          isOpen={payModalOpen}
          onClose={() => {
            setPayModalOpen(false);
            setEventToPay(null);
          }}
          title={`RSVP: ${eventToPay.title}`}
          amount={eventToPay.fee}
          type="Event Registration"
          description={`Entry registration ticket for ${eventToPay.title}`}
          eventId={eventToPay.id}
          onSuccess={() => refreshList()}
        />
      )}

      {/* Create Event Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white border border-[#e2ece2] p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto text-[#2d3a3a]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ece2]">
                <h3 className="font-heading font-bold text-[#1b4332] text-lg">
                  Schedule New Club Ride / Event
                </h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 text-[#52605d] hover:text-[#1b4332] rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEventSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Event Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    placeholder="e.g. Angeles Crest Highway Loop"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <CustomSelect
                      label="Category"
                      value={newType}
                      onChange={(val) => setNewType(val as EventType)}
                      options={['Group Ride', 'Club Meeting', 'Workshop', 'Rally', 'Charity Run']}
                    />
                  </div>
                  <div>
                    <CustomSelect
                      label="Pace"
                      value={newPace}
                      onChange={(val) => setNewPace(val as PaceLevel)}
                      options={['Casual 15-20mph', 'Moderate 20-25mph', 'Fast 25+mph', 'All Pace']}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Time</label>
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Start Location</label>
                  <input
                    type="text"
                    value={newStartLoc}
                    onChange={(e) => setNewStartLoc(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Miles</label>
                    <input
                      type="number"
                      value={newDistance}
                      onChange={(e) => setNewDistance(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Fee ($)</label>
                    <input
                      type="number"
                      value={newFee}
                      onChange={(e) => setNewFee(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1 block">Max Capacity</label>
                    <input
                      type="number"
                      value={newMax}
                      onChange={(e) => setNewMax(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#2d3a3a] font-semibold mb-1 block">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Publish Event
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
