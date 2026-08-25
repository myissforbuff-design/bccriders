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
      <div className="p-6 rounded-2xl bg-white border border-[#1b4332]/10 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-[#1b4332]/10 text-[#1b4332] rounded-xl shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-heading font-extrabold text-[#1b4332]">
                  Club Roles & Permissions
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-[#1b4332]/10 text-[#1b4332] rounded-full">
                  {roles.length} Total
                </span>
              </div>
              <p className="text-sm text-[#52605d] mt-1 max-w-2xl">
                Define and customize motorcycle club roles, officer hierarchy, badge initials, and assigned duties. All configured roles will automatically appear in member edit dropdowns and roster profile badges.
              </p>
            </div>
          </div>

          <button
            id="btn-add-club-role"
            onClick={handleOpenAdd}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Role</span>
          </button>
        </div>

        {/* Stats Pill Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#1b4332]/10">
          <div className="p-3 bg-[#fbfbfa] rounded-xl border border-[#1b4332]/5">
            <div className="text-[11px] font-bold text-[#52605d] uppercase tracking-wider">Total Roles</div>
            <div className="text-xl font-heading font-black text-[#1b4332] mt-0.5">{stats.total}</div>
          </div>
          <div className="p-3 bg-[#fbfbfa] rounded-xl border border-[#1b4332]/5">
            <div className="text-[11px] font-bold text-[#52605d] uppercase tracking-wider">Executive & Officers</div>
            <div className="text-xl font-heading font-black text-amber-600 mt-0.5">{stats.officers}</div>
          </div>
          <div className="p-3 bg-[#fbfbfa] rounded-xl border border-[#1b4332]/5">
            <div className="text-[11px] font-bold text-[#52605d] uppercase tracking-wider">Staff & Marshals</div>
            <div className="text-xl font-heading font-black text-teal-600 mt-0.5">{stats.staff}</div>
          </div>
          <div className="p-3 bg-[#fbfbfa] rounded-xl border border-[#1b4332]/5">
            <div className="text-[11px] font-bold text-[#52605d] uppercase tracking-wider">Custom Defined</div>
            <div className="text-xl font-heading font-black text-emerald-600 mt-0.5">{stats.custom}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#52605d]" />
          <input
            type="text"
            placeholder="Search roles by title, initials, or duty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#1b4332]/20 rounded-xl text-sm font-medium text-[#1b4332] placeholder-[#52605d]/60 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52605d] hover:text-[#1b4332]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'Officer', 'Staff', 'Member', 'Custom'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#1b4332] text-white shadow-xs'
                  : 'bg-white text-[#52605d] border border-[#1b4332]/10 hover:bg-[#1b4332]/5'
              }`}
            >
              {cat === 'All' ? 'All Roles' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Roles Grid */}
      {filteredRoles.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#1b4332]/10 space-y-3">
          <Briefcase className="w-12 h-12 text-[#52605d]/40 mx-auto" />
          <h4 className="font-heading font-bold text-base text-[#1b4332]">No roles matched your search</h4>
          <p className="text-xs text-[#52605d] max-w-sm mx-auto">
            Try adjusting your search query or category filters, or click &quot;Add New Role&quot; above to create a custom designation.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('All');
            }}
            className="text-xs font-bold text-[#1b4332] underline hover:text-[#2d6a4f]"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRoles.map((role) => {
            const roleData = roleMemberCounts[role.name.toLowerCase()] || { count: 0, members: [] };
            const memberCount = roleData.count;

            return (
              <div
                key={role.id}
                className="p-5 rounded-2xl bg-white border border-[#1b4332]/10 hover:border-[#1b4332]/30 transition-all shadow-xs flex flex-col justify-between space-y-4"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3.5">
                    {/* Badge Preview */}
                    <div
                      style={{
                        backgroundColor: role.badgeBgColor || '#059669',
                        color: role.badgeTextColor || '#ffffff',
                      }}
                      className="w-11 h-11 rounded-xl shadow-xs flex items-center justify-center font-heading font-black text-sm shrink-0 border border-white/20"
                    >
                      {role.badgeAbbr || role.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-heading font-extrabold text-base text-[#1b4332]">
                          {role.name}
                        </h4>
                        {role.isSystemDefault ? (
                          <span
                            title="System Default Role"
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                          >
                            <Lock className="w-2.5 h-2.5 mr-0.5" />
                            Core
                          </span>
                        ) : (
                          <span
                            title="Custom Defined Role"
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                          >
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            Custom
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 mt-0.5">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
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
                        <span className="text-[11px] text-[#52605d] font-medium">
                          Badge: <span className="font-bold text-[#1b4332]">{role.badgeAbbr || role.name.slice(0, 2).toUpperCase()}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(role)}
                      title="Edit role details & badge appearance"
                      className="p-2 text-[#52605d] hover:text-[#1b4332] hover:bg-[#1b4332]/5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!role.isSystemDefault && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        title="Delete custom role"
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#52605d] leading-relaxed line-clamp-2">
                  {role.description || 'Official club designation and authorized operational role within the organization.'}
                </p>

                {/* Footer: Member count & preview */}
                <div className="pt-3 border-t border-[#1b4332]/10 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-[#52605d]">
                    <Users className="w-3.5 h-3.5 text-[#1b4332]" />
                    <span className="font-bold text-[#1b4332]">{memberCount}</span>
                    <span>{memberCount === 1 ? 'member assigned' : 'members assigned'}</span>
                  </div>

                  {/* Member mini-avatars */}
                  {roleData.members.length > 0 && (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              <div className="p-6 border-b border-[#1b4332]/10 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-[#1b4332]/10 text-[#1b4332] rounded-xl">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-lg text-[#1b4332]">
                      {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Club Role'}
                    </h3>
                    <p className="text-xs text-[#52605d]">
                      {editingRole ? 'Update role hierarchy, badge aesthetics, and description.' : 'Define a new operational or leadership role for members.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-[#52605d] hover:text-[#1b4332] hover:bg-[#1b4332]/5 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveRole} className="p-6 space-y-5">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Role Title */}
                <div>
                  <label className="block text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1.5">
                    Role Title / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Road Marshal, Quartermaster, Medical Officer"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={editingRole?.isSystemDefault}
                    className="w-full px-4 py-2.5 bg-white border border-[#1b4332]/20 rounded-xl text-sm font-semibold text-[#1b4332] placeholder-[#52605d]/50 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {editingRole?.isSystemDefault && (
                    <p className="text-[11px] text-[#52605d] mt-1 flex items-center">
                      <Lock className="w-3 h-3 mr-1 text-slate-400" /> Core system role names are protected to preserve operational records.
                    </p>
                  )}
                </div>

                {/* Category & Hierarchy */}
                <div>
                  <label className="block text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1.5">
                    Hierarchy Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['Officer', 'Staff', 'Member', 'Custom'] as const).map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#fbfbfa] border border-[#1b4332]/10">
                  <div>
                    <label className="block text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1">
                      Badge Abbr / Initials <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="e.g. RM, QM, MED"
                      value={badgeAbbr}
                      onChange={(e) => setBadgeAbbr(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-white border border-[#1b4332]/20 rounded-xl text-sm font-black text-[#1b4332] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30"
                    />
                    <p className="text-[10px] text-[#52605d] mt-1">
                      Max 4 uppercase characters displayed in member avatar badges.
                    </p>
                  </div>

                  {/* Live Avatar Preview */}
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-[#1b4332]/10">
                    <span className="text-[10px] font-bold text-[#52605d] uppercase mb-1.5">Live Badge Preview</span>
                    <div className="relative inline-block">
                      <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-[#1b4332]/20 flex items-center justify-center text-slate-400 font-bold text-xs">
                        AV
                      </div>
                      <span
                        style={{
                          backgroundColor: badgeBgColor,
                          color: badgeTextColor,
                        }}
                        className="absolute w-5 h-5 -bottom-0.5 -right-0.5 text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-xs"
                      >
                        {badgeAbbr || name.slice(0, 2).toUpperCase() || 'RO'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Color Palette Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#1b4332] uppercase tracking-wider">
                      Badge Background Color
                    </label>
                    <span className="text-xs font-mono font-bold text-[#52605d]">{badgeBgColor}</span>
                  </div>

                  {/* Palette Grid */}
                  <div className="grid grid-cols-6 gap-2.5 mb-3">
                    {PRESET_COLORS.map((p) => (
                      <button
                        type="button"
                        key={p.color}
                        onClick={() => setBadgeBgColor(p.color)}
                        title={p.name}
                        style={{ backgroundColor: p.color }}
                        className={`h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          badgeBgColor === p.color ? 'ring-2 ring-offset-2 ring-[#1b4332] scale-105 shadow-sm' : 'hover:opacity-90'
                        }`}
                      >
                        {badgeBgColor === p.color && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                      </button>
                    ))}
                  </div>

                  {/* Custom Hex input */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={badgeBgColor}
                      onChange={(e) => setBadgeBgColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-[#1b4332]/20 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={badgeBgColor}
                      onChange={(e) => setBadgeBgColor(e.target.value)}
                      placeholder="#059669"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-[#1b4332]/20 rounded-xl text-[#1b4332]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-[#1b4332] uppercase tracking-wider mb-1.5">
                    Role Description & Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the duties, authority, and obligations associated with this role..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#1b4332]/20 rounded-xl text-xs font-medium text-[#1b4332] placeholder-[#52605d]/50 focus:outline-none focus:ring-2 focus:ring-[#1b4332]/30 resize-none"
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
