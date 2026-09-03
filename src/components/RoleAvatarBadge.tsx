import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { store } from '../lib/db';
import { ClubRoleDefinition } from '../types';

interface RoleAvatarBadgeProps {
  role?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  avatarUrl?: string;
  name?: string;
  sizeClass?: string;
}

export const RoleAvatarBadge: React.FC<RoleAvatarBadgeProps> = ({
  role = 'Member',
  size = 'md',
  className = '',
  avatarUrl,
  name,
  sizeClass,
}) => {
  const [customRoles, setCustomRoles] = useState<ClubRoleDefinition[]>(() => store.getClubRoles());

  useEffect(() => {
    const handleRolesUpdated = (e: Event) => {
      const updated = (e as CustomEvent).detail || store.getClubRoles();
      if (Array.isArray(updated)) {
        setCustomRoles(updated);
      }
    };
    window.addEventListener('bcc_roles_updated', handleRolesUpdated);
    return () => {
      window.removeEventListener('bcc_roles_updated', handleRolesUpdated);
    };
  }, []);

  const normRole = (role || '').trim();

  // If used as an all-in-one avatar + badge component (e.g. Dashboard table rows)
  if (avatarUrl) {
    return (
      <div className={`relative inline-block shrink-0 ${sizeClass || 'w-8 h-8'}`}>
        <img
          src={avatarUrl}
          alt={name || 'Avatar'}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
          }}
          referrerPolicy="no-referrer"
          className="w-full h-full rounded-full object-cover border border-stone-200 shadow-xs bg-stone-100"
        />
        <RoleAvatarBadge role={role} size={size === 'xl' ? 'lg' : size} />
      </div>
    );
  }

  const hasCustomPos =
    className.includes('bottom-') ||
    className.includes('top-') ||
    className.includes('inset-');
  const hasCustomSize = className.includes('w-') || className.includes('h-');

  const defaultDimensions: Record<string, string> = {
    xs: 'w-2.5 h-2.5 text-[5.5px]',
    sm: 'w-3 h-3 text-[6px]',
    md: 'w-3.5 h-3.5 sm:w-4 sm:h-4 text-[7px] sm:text-[7.5px]',
    lg: 'w-5 h-5 sm:w-5.5 sm:h-5.5 text-[8.5px] sm:text-[9px]',
    xl: 'w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-[9px] sm:text-[10px] lg:text-[11px]',
  };

  const defaultPositions: Record<string, string> = {
    xs: 'bottom-0 right-0',
    sm: 'bottom-0 right-0',
    md: 'bottom-0 right-0',
    lg: 'bottom-0.5 right-0.5',
    xl: 'bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 lg:bottom-2 lg:right-2',
  };

  const iconSizeMap: Record<string, string> = {
    xs: 'w-1.5 h-1.5 stroke-[3.5]',
    sm: 'w-2 h-2 stroke-[3.5]',
    md: 'w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3.5]',
    lg: 'w-3 h-3 stroke-[3.5]',
    xl: 'w-3.5 h-3.5 lg:w-4 lg:h-4 stroke-[3.5]',
  };

  const ringClass =
    size === 'xs' || size === 'sm'
      ? 'ring-1'
      : size === 'md'
      ? 'ring-[1.5px]'
      : 'ring-2';

  const dimClass = hasCustomSize ? '' : (defaultDimensions[size] || defaultDimensions.md);
  const posClass = hasCustomPos ? '' : (defaultPositions[size] || defaultPositions.md);
  const containerClass = `${dimClass} ${posClass} ${ringClass} ring-white shadow-xs`.trim();
  const iconClass = iconSizeMap[size] || iconSizeMap.md;

  if (normRole === 'admin') {
    return (
      <span
        title="System Administrator"
        className={`absolute rounded-full bg-purple-600 text-white font-black flex items-center justify-center ${containerClass} ${className}`}
      >
        A
      </span>
    );
  }

  if (normRole === 'President') {
    return (
      <span
        title="President"
        className={`absolute rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        P
      </span>
    );
  }

  if (normRole === 'Vice-President' || normRole === 'Vice President') {
    return (
      <span
        title="Vice President"
        className={`absolute rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        VP
      </span>
    );
  }

  if (normRole === 'Secretary') {
    return (
      <span
        title="Secretary"
        className={`absolute rounded-full bg-teal-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        S
      </span>
    );
  }

  if (normRole === 'Treasurer') {
    return (
      <span
        title="Treasurer"
        className={`absolute rounded-full bg-emerald-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        T
      </span>
    );
  }

  if (normRole === 'Road Captain') {
    return (
      <span
        title="Road Captain"
        className={`absolute rounded-full bg-rose-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        RC
      </span>
    );
  }

  if (normRole === 'Safety Officer') {
    return (
      <span
        title="Safety Officer"
        className={`absolute rounded-full bg-orange-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        SO
      </span>
    );
  }

  if (normRole === 'Social Media') {
    return (
      <span
        title="Social Media"
        className={`absolute rounded-full bg-pink-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        SM
      </span>
    );
  }

  if (normRole === 'Members Representative') {
    return (
      <span
        title="Members Representative"
        className={`absolute rounded-full bg-sky-600 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        MR
      </span>
    );
  }

  if (
    normRole === 'Sgt. at Arms' ||
    normRole === 'Sgt at Arms' ||
    normRole === 'Sergeant-at-Arms' ||
    normRole === 'Sergeant at Arms'
  ) {
    return (
      <span
        title="Sgt. at Arms"
        className={`absolute rounded-full bg-slate-700 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        SA
      </span>
    );
  }

  if (
    normRole === 'P.I.O.' ||
    normRole === 'PIO' ||
    normRole === 'Public Information Officer'
  ) {
    return (
      <span
        title="P.I.O."
        className={`absolute rounded-full bg-cyan-700 text-white font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        PIO
      </span>
    );
  }

  // Check dynamic / custom configured roles
  const matchedCustom = customRoles.find(
    (cr) => cr.name.toLowerCase() === normRole.toLowerCase()
  );
  if (matchedCustom && matchedCustom.name.toLowerCase() !== 'member') {
    return (
      <span
        title={matchedCustom.name}
        style={{
          backgroundColor: matchedCustom.badgeBgColor || '#059669',
          color: matchedCustom.badgeTextColor || '#ffffff',
        }}
        className={`absolute rounded-full font-extrabold flex items-center justify-center ${containerClass} ${className}`}
      >
        {matchedCustom.badgeAbbr || matchedCustom.name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      title={normRole || 'Verified Member'}
      className={`absolute rounded-full bg-[#1877f2] text-white flex items-center justify-center ${containerClass} ${className}`}
    >
      <Check className={`${iconClass} text-white`} />
    </span>
  );
};
