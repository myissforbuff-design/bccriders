import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield,
  Award,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Users,
  Info,
  Sparkles,
  Lock,
  RefreshCw,
  X,
  Palette,
  Briefcase,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { store } from '../lib/db';
import { ClubRoleDefinition, User } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';

const PRESET_COLORS = [
  { name: 'Emerald Forest', color: '#059669' },
  { name: 'Teal Jade', color: '#0d9488' },
  { name: 'Royal Indigo', color: '#4f46e5' },
  { name: 'Cobalt Blue', color: '#1877f2' },
  { name: 'Cyan Sea', color: '#0e7490' },
  { name: 'Amber Gold', color: '#f59e0b' },
  { name: 'Sunset Orange', color: '#ea580c' },
  { name: 'Crimson Rose', color: '#e11d48' },
  { name: 'Berry Pink', color: '#db2777' },
  { name: 'Deep Purple', color: '#7c3aed' },
  { name: 'Slate Steel', color: '#334155' },
  { name: 'Dark Carbon', color: '#1e293b' },
];

export const RolesSettings: React.FC = () => {
  const [roles, setRoles] = useState<ClubRoleDefinition[]>(() => store.getClubRoles());
  const [users, setUsers] = useState<User[]>(() => store.getUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Officer' | 'Staff' | 'Member' | 'Custom'>('All');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ClubRoleDefinition | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<ClubRoleDefinition | null>(null);
  
  // Collapse state for whole section
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('bcc_roles_settings_collapsed');
      if (stored !== null) return stored === 'true';
      return false;
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bcc_roles_settings_collapsed', String(next));
      } catch {}
      return next;
    });
  };
  
  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Officer' | 'Staff' | 'Member' | 'Custom'>('Custom');
  const [badgeAbbr, setBadgeAbbr] = useState('');
  const [badgeBgColor, setBadgeBgColor] = useState('#059669');
  const [badgeTextColor, setBadgeTextColor] = useState('#ffffff');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sync with store updates
  useEffect(() => {
    const handleRolesUpdate = (e: Event) => {
      const updated = (e as CustomEvent).detail || store.getClubRoles();
      if (Array.isArray(updated)) {
        setRoles(updated);
      }
    };
    const handleUsersUpdate = () => {
      setUsers(store.getUsers());
    };

    window.addEventListener('bcc_roles_updated', handleRolesUpdate);
    window.addEventListener('bcc_users_updated', handleUsersUpdate);
    window.addEventListener('bcc_settings_updated', handleRolesUpdate);

    return () => {
      window.removeEventListener('bcc_roles_updated', handleRolesUpdate);
      window.removeEventListener('bcc_users_updated', handleUsersUpdate);
      window.removeEventListener('bcc_settings_updated', handleRolesUpdate);
    };
  }, []);

  // Compute active member count per role
  const roleMemberCounts = useMemo(() => {
    const counts: Record<string, { count: number; members: User[] }> = {};
    roles.forEach((r) => {
      counts[r.name.toLowerCase()] = { count: 0, members: [] };
    });

    users.forEach((u) => {
      const uRole = (u.role || 'Member').trim().toLowerCase();
      if (!counts[uRole]) {
        counts[uRole] = { count: 0, members: [] };
      }
      counts[uRole].count += 1;
      counts[uRole].members.push(u);
    });

    return counts;
  }, [roles, users]);

  // Filtered roles
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.badgeAbbr && r.badgeAbbr.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [roles, searchQuery, categoryFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = roles.length;
    const officers = roles.filter((r) => r.category === 'Officer').length;
    const staff = roles.filter((r) => r.category === 'Staff').length;
    const custom = roles.filter((r) => r.category === 'Custom' || !r.isSystemDefault).length;
    return { total, officers, staff, custom };
  }, [roles]);

  const handleOpenAdd = () => {
    setEditingRole(null);
    setName('');
    setCategory('Custom');
    setBadgeAbbr('');
    setBadgeBgColor('#059669');
    setBadgeTextColor('#ffffff');
    setDescription('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: ClubRoleDefinition) => {
    setEditingRole(role);
    setName(role.name);
    setCategory(role.category || 'Custom');
    setBadgeAbbr(role.badgeAbbr || role.name.slice(0, 2).toUpperCase());
    setBadgeBgColor(role.badgeBgColor || '#059669');
    setBadgeTextColor(role.badgeTextColor || '#ffffff');
    setDescription(role.description || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingRole && !badgeAbbr) {
      // Auto generate abbreviation from words
      const words = val.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        setBadgeAbbr(words[0].slice(0, 3).toUpperCase());
      } else if (words.length > 1) {
        setBadgeAbbr(words.map((w) => w[0]).join('').slice(0, 4).toUpperCase());
      }
    }
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Role title or name is required.');
      return;
    }

    // Check duplicate name
    const existing = roles.find(
      (r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== editingRole?.id
    );
    if (existing) {
      setFormError(`A role named "${name.trim()}" already exists.`);
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const saved = store.saveClubRole({
        id: editingRole?.id,
        name: name.trim(),
        category,
        badgeAbbr: badgeAbbr.trim() || name.trim().slice(0, 3).toUpperCase(),
        badgeBgColor,
        badgeTextColor,
        description: description.trim(),
        isSystemDefault: editingRole ? editingRole.isSystemDefault : false,
      });

      setRoles(store.getClubRoles());
      setIsModalOpen(false);
      setSuccessToast(editingRole ? `Role "${saved.name}" updated successfully.` : `New role "${saved.name}" created successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      setFormError('Failed to save role. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = (role: ClubRoleDefinition) => {
    if (role.isSystemDefault) {
      alert('System core roles cannot be deleted.');
      return;
    }
    setDeleteConfirmRole(role);
  };

  const executeDelete = () => {
    if (!deleteConfirmRole) return;
    const success = store.deleteClubRole(deleteConfirmRole.id);
    if (success) {
      setRoles(store.getClubRoles());
      setSuccessToast(`Role "${deleteConfirmRole.name}" deleted successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
    setDeleteConfirmRole(null);
  };

  // Modal dismiss ref
  const modalRef = useRef<HTMLDivElement>(null);
  useModalDismiss(isModalOpen, () => setIsModalOpen(false));

  const deleteModalRef = useRef<HTMLDivElement>(null);
  useModalDismiss(Boolean(deleteConfirmRole), () => setDeleteConfirmRole(null));

  return (
    <div id="roles-settings-container" className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center space-x-2.5">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-semibold">{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Section Header Card */}
      <div className={`bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] transition-all shadow-xs ${isCollapsed ? 'p-3 sm:p-4 space-y-2.5' : 'p-3.5 sm:p-4 md:p-5 space-y-3 sm:space-y-4'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <Award className="w-5 h-5 text-[#74c69d]" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-black text-xs sm:text-sm md:text-base text-[#1b4332] leading-snug">
                  Club Roles & Permissions
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-stone-200 text-stone-700 border border-stone-300 flex items-center gap-1 shrink-0">
                  {roles.length} Total
                </span>
                {isCollapsed && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Small View
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed">
                {isCollapsed
                  ? `${stats.officers} Officers · ${stats.staff} Staff · ${stats.custom} Custom defined · Click "Expand Roles" to view full directory.`
                  : 'Define and customize motorcycle club roles, officer hierarchy, badge initials, and assigned duties. All configured roles will automatically appear in member edit dropdowns and roster profile badges.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              id="btn-add-club-role"
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Role</span>
            </button>

            <button
              type="button"
              id="btn-toggle-roles-collapse"
              onClick={toggleCollapsed}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer border ${
                isCollapsed
                  ? 'bg-white hover:bg-stone-50 text-[#1b4332] border-[#2d6a4f]'
                  : 'bg-white hover:bg-stone-50 text-[#1b4332] border-[#e2ece2]'
              }`}
              title={isCollapsed ? 'Expand roles and permissions' : 'Collapse whole div to small div'}
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Expand Roles ({roles.length})</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Collapse to Small Div</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsed quick preview pills */}
        {isCollapsed && (
          <div className="pt-2 border-t border-[#e2ece2] flex items-center justify-between gap-2 overflow-x-auto text-[10px] sm:text-[11px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-[#52605d] uppercase text-[9px] tracking-wider shrink-0 mr-1">
                Roles preview:
              </span>
              {roles.slice(0, 7).map((role) => (
                <span
                  key={role.id}
                  style={{
                    backgroundColor: `${role.badgeBgColor || '#059669'}15`,
                    color: role.badgeBgColor || '#059669',
                    borderColor: `${role.badgeBgColor || '#059669'}30`,
                  }}
                  className="px-2 py-0.5 rounded-md font-bold text-[10px] border flex items-center gap-1 shrink-0"
                >
                  <span className="font-black">[{role.badgeAbbr || role.name.slice(0, 2).toUpperCase()}]</span>
                  <span>{role.name}</span>
                </span>
              ))}
              {roles.length > 7 && (
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[#52605d] font-bold text-[10px] border border-stone-200 shrink-0">
                  +{roles.length - 7} more
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="text-[11px] font-bold text-[#2d6a4f] hover:underline shrink-0 flex items-center gap-0.5 ml-auto cursor-pointer"
            >
              <span>Expand</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Stats Row when expanded */}
        {!isCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#e2ece2]">
            <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#e2ece2] min-w-0 space-y-0.5">
              <div className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-[#52605d] tracking-wider truncate">Total Roles</div>
              <div className="text-sm sm:text-base font-black text-[#1b4332]">{stats.total}</div>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#e2ece2] min-w-0 space-y-0.5">
              <div className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-amber-700 tracking-wider truncate">Executive & Officers</div>
              <div className="text-sm sm:text-base font-black text-amber-700">{stats.officers}</div>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#e2ece2] min-w-0 space-y-0.5">
              <div className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-teal-700 tracking-wider truncate">Staff & Marshals</div>
              <div className="text-sm sm:text-base font-black text-teal-700">{stats.staff}</div>
            </div>
            <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#e2ece2] min-w-0 space-y-0.5">
              <div className="text-[9.5px] sm:text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider truncate">Custom Defined</div>
              <div className="text-sm sm:text-base font-black text-emerald-700">{stats.custom}</div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Content: Search, Filters, Roles Grid, and Bottom Collapse Button */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 overflow-hidden"
          >

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#52605d]" />
          <input
            type="text"
            placeholder="Search roles by title, initials, or duty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 bg-white border border-[#e2ece2] rounded-xl text-[11px] sm:text-xs font-medium text-[#1b4332] placeholder-[#52605d]/60 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52605d] hover:text-[#1b4332]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'Officer', 'Staff', 'Member', 'Custom'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-white text-[#52605d] border border-[#e2ece2] hover:bg-[#1b4332]/5'
              }`}
            >
              {cat === 'All' ? 'All Roles' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Roles Grid */}
      {filteredRoles.length === 0 ? (
        <div className="p-8 sm:p-10 text-center bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] space-y-2.5">
          <Briefcase className="w-10 h-10 text-[#52605d]/40 mx-auto" />
          <h4 className="font-heading font-bold text-xs sm:text-sm text-[#1b4332]">No roles matched your search</h4>
          <p className="text-[11px] sm:text-xs text-[#52605d] max-w-sm mx-auto">
            Try adjusting your search query or category filters, or click &quot;Add New Role&quot; above to create a custom designation.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('All');
            }}
            className="text-[11px] sm:text-xs font-bold text-[#1b4332] underline hover:text-[#2d6a4f]"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredRoles.map((role) => {
            const roleData = roleMemberCounts[role.name.toLowerCase()] || { count: 0, members: [] };
            const memberCount = roleData.count;

            return (
              <div
                key={role.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] hover:border-[#1b4332]/30 transition-all shadow-xs flex flex-col justify-between space-y-3"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start space-x-2.5 min-w-0">
                    {/* Badge Preview */}
                    <div
                      style={{
                        backgroundColor: role.badgeBgColor || '#059669',
                        color: role.badgeTextColor || '#ffffff',
                      }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-xs flex items-center justify-center font-heading font-black text-xs shrink-0 border border-white/20 mt-0.5"
                    >
                      {role.badgeAbbr || role.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <h4 className="font-heading font-black text-xs sm:text-sm text-[#1b4332] truncate">
                          {role.name}
                        </h4>
                        {role.isSystemDefault ? (
                          <span
                            title="System Default Role"
                            className="inline-flex items-center px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-stone-200 text-stone-700 border border-stone-300 rounded"
                          >
                            <Lock className="w-2.5 h-2.5 mr-0.5" />
                            Core
                          </span>
                        ) : (
                          <span
                            title="Custom Defined Role"
                            className="inline-flex items-center px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 rounded"
                          >
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Custom
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-0.5 flex-wrap">
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            role.category === 'Officer'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : role.category === 'Staff'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200/60'
                              : role.category === 'Member'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          }`}
                        >
                          {role.category || 'Custom'}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-[#52605d] font-medium truncate">
                          Badge: <span className="font-bold text-[#1b4332]">{role.badgeAbbr || role.name.slice(0, 2).toUpperCase()}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-0.5 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(role)}
                      title="Edit role details & badge appearance"
                      className="p-1.5 text-[#52605d] hover:text-[#1b4332] hover:bg-white rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!role.isSystemDefault && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        title="Delete custom role"
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] sm:text-xs text-[#52605d] leading-relaxed line-clamp-2">
                  {role.description || 'Official club designation and authorized operational role within the organization.'}
                </p>

                {/* Footer: Member count & preview */}
                <div className="pt-2 border-t border-[#e2ece2] flex items-center justify-between text-[10px] sm:text-[11px]">
                  <div className="flex items-center space-x-1.5 text-[#52605d]">
                    <Users className="w-3.5 h-3.5 text-[#1b4332]" />
                    <span className="font-bold text-[#1b4332]">{memberCount}</span>
                    <span>{memberCount === 1 ? 'member assigned' : 'members assigned'}</span>
                  </div>

                  {/* Member mini-avatars */}
                  {roleData.members.length > 0 ? (
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {roleData.members.slice(0, 4).map((m) => (
                        <img
                          key={m.id}
                          src={m.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                          alt={m.name || m.username}
                          title={`${m.name || m.username} (${m.role})`}
                          className="w-5 h-5 rounded-full border border-white object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                      {roleData.members.length > 4 && (
                        <span className="w-5 h-5 rounded-full bg-[#1b4332] text-white text-[9px] font-bold flex items-center justify-center border border-white">
                          +{roleData.members.length - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9.5px] font-medium text-[#52605d]/60">None</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Collapse Button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          id="btn-toggle-roles-collapse-bottom"
          onClick={toggleCollapsed}
          className="px-4 py-2 bg-white hover:bg-stone-50 text-[#1b4332] border border-[#e2ece2] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer hover:border-[#2d6a4f]"
        >
          <ChevronUp className="w-3.5 h-3.5 text-[#2d6a4f]" />
          <span>Collapse to Small Div</span>
        </button>
      </div>
    </motion.div>
  )}
</AnimatePresence>

      {/* Add / Edit Role Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#1b4332]/10"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-[#1b4332]/10 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
                <div className="flex items-center space-x-2.5 sm:space-x-3">
                  <div className="p-2 sm:p-2.5 bg-[#1b4332]/10 text-[#1b4332] rounded-xl shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-[12pt] sm:text-base md:text-lg text-[#1b4332]">
                      {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Club Role'}
                    </h3>
                    <p className="text-[11pt] sm:text-xs text-[#52605d]">
                      {editingRole ? 'Update role hierarchy, badge aesthetics, and description.' : 'Define a new operational or leadership role for members.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 sm:p-2 text-[#52605d] hover:text-[#1b4332] hover:bg-[#1b4332]/5 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveRole} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Role Title */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1">
                    Role Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Road Marshal, Quartermaster, Medical Officer"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={editingRole?.isSystemDefault}
                    className="w-full px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white border border-[#1b4332]/20 rounded-xl text-xs sm:text-sm font-semibold text-[#1b4332] placeholder-[#52605d]/50 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {editingRole?.isSystemDefault && (
                    <p className="text-[10px] sm:text-[11px] text-[#52605d] mt-1 flex items-center">
                      <Lock className="w-3 h-3 mr-1 text-slate-400" /> Core system role names are protected to preserve operational records.
                    </p>
                  )}
                </div>

                {/* Category & Hierarchy */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1">
                    Hierarchy Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                    {(['Officer', 'Staff', 'Member', 'Custom'] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all border cursor-pointer ${
                          category === cat
                            ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                            : 'bg-white text-[#52605d] border-[#1b4332]/10 hover:bg-[#1b4332]/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Badge Initials & Appearance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-[#fbfbfa] border border-[#1b4332]/10">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1">
                      Badge Abbr / Initials <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="e.g. RM, QM, MED"
                      value={badgeAbbr}
                      onChange={(e) => setBadgeAbbr(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 sm:py-2 bg-white border border-[#1b4332]/20 rounded-xl text-xs sm:text-sm font-black text-[#1b4332] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30"
                    />
                    <p className="text-[9.5px] sm:text-[10px] text-[#52605d] mt-1">
                      Max 4 uppercase characters displayed in member avatar badges.
                    </p>
                  </div>

                  {/* Live Avatar Preview */}
                  <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white rounded-xl border border-[#1b4332]/10">
                    <span className="text-[9.5px] sm:text-[10px] font-bold text-[#52605d] uppercase mb-1">Live Badge Preview</span>
                    <div className="relative inline-block">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 border-2 border-[#1b4332]/20 flex items-center justify-center text-slate-400 font-bold text-xs">
                        AV
                      </div>
                      <span
                        style={{
                          backgroundColor: badgeBgColor,
                          color: badgeTextColor,
                        }}
                        className="absolute w-4.5 h-4.5 sm:w-5 sm:h-5 -bottom-0.5 -right-0.5 text-[8.5px] sm:text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs"
                      >
                        {badgeAbbr || name.slice(0, 2).toUpperCase() || 'RO'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Color Palette Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] sm:text-xs font-bold text-[#1b4332] uppercase tracking-wider">
                      Badge Background Color
                    </label>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-[#52605d]">{badgeBgColor}</span>
                  </div>

                  {/* Palette Grid */}
                  <div className="grid grid-cols-6 gap-2 sm:gap-2.5 mb-2.5">
                    {PRESET_COLORS.map((p) => (
                      <button
                        type="button"
                        key={p.color}
                        onClick={() => setBadgeBgColor(p.color)}
                        title={p.name}
                        style={{ backgroundColor: p.color }}
                        className={`h-7 sm:h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          badgeBgColor === p.color ? 'ring-2 ring-offset-2 ring-[#1b4332] scale-105 shadow-sm' : 'hover:opacity-90'
                        }`}
                      >
                        {badgeBgColor === p.color && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-xs" />}
                      </button>
                    ))}
                  </div>

                  {/* Custom Hex input */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={badgeBgColor}
                      onChange={(e) => setBadgeBgColor(e.target.value)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-[#1b4332]/20 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={badgeBgColor}
                      onChange={(e) => setBadgeBgColor(e.target.value)}
                      placeholder="#059669"
                      className="flex-1 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-mono font-bold bg-white border border-[#1b4332]/20 rounded-xl text-[#1b4332]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1">
                    Role Description & Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the duties, authority, and obligations associated with this role..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2 sm:px-4 sm:py-2.5 bg-white border border-[#1b4332]/20 rounded-xl text-[11pt] sm:text-xs font-medium text-[#1b4332] placeholder-[#52605d]/50 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30 resize-none"
                  />
                </div>

                {/* Form Footer Actions */}
                <div className="pt-4 border-t border-[#1b4332]/10 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-[#52605d] hover:bg-[#1b4332]/5 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-extrabold rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingRole ? 'Save Changes' : 'Create Role'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              ref={deleteModalRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-lg text-[#1b4332]">
                  Delete Role &quot;{deleteConfirmRole.name}&quot;?
                </h3>
                <p className="text-xs text-[#52605d] mt-1 leading-relaxed">
                  Are you sure you want to delete this custom role?
                  {roleMemberCounts[deleteConfirmRole.name.toLowerCase()]?.count > 0 ? (
                    <span className="block mt-2 font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      ⚠️ Note: {roleMemberCounts[deleteConfirmRole.name.toLowerCase()].count} member(s) currently hold this role. Their assigned role text will remain intact on existing records, but this role definition will be removed from new selections.
                    </span>
                  ) : (
                    ' No members are currently assigned to this role.'
                  )}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmRole(null)}
                  className="px-4 py-2 text-xs font-bold text-[#52605d] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
