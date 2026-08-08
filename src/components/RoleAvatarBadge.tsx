import React from 'react';
import { Check } from 'lucide-react';

interface RoleAvatarBadgeProps {
  role?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RoleAvatarBadge: React.FC<RoleAvatarBadgeProps> = ({
  role = 'Member',
  size = 'md',
  className = '',
}) => {
  const normRole = (role || '').trim();

  const containerSizeMap = {
    sm: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 text-[7px]',
    md: 'w-4.5 h-4.5 -bottom-0.5 -right-0.5 text-[8.5px]',
    lg: 'w-6 h-6 bottom-0 right-0 text-[10.5px]',
  };

  const iconSizeMap = {
    sm: 'w-2 h-2 stroke-[3.5]',
    md: 'w-2.5 h-2.5 stroke-[3.5]',
    lg: 'w-3.5 h-3.5 stroke-[3.5]',
  };

  const containerClass = containerSizeMap[size];
  const iconClass = iconSizeMap[size];

  if (normRole === 'admin') {
    return (
      <span
        title="System Administrator"
        className={`absolute rounded-full bg-purple-600 text-white font-black flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        A
      </span>
    );
  }

  if (normRole === 'President') {
    return (
      <span
        title="President"
        className={`absolute rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        P
      </span>
    );
  }

  if (normRole === 'Vice-President' || normRole === 'Vice President') {
    return (
      <span
        title="Vice President"
        className={`absolute rounded-full bg-indigo-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        VP
      </span>
    );
  }

  if (normRole === 'Secretary') {
    return (
      <span
        title="Secretary"
        className={`absolute rounded-full bg-teal-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        S
      </span>
    );
  }

  if (normRole === 'Treasurer') {
    return (
      <span
        title="Treasurer"
        className={`absolute rounded-full bg-emerald-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        T
      </span>
    );
  }

  if (normRole === 'Road Captain') {
    return (
      <span
        title="Road Captain"
        className={`absolute rounded-full bg-rose-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        RC
      </span>
    );
  }

  if (normRole === 'Safety Officer') {
    return (
      <span
        title="Safety Officer"
        className={`absolute rounded-full bg-orange-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        SO
      </span>
    );
  }

  if (normRole === 'Social Media') {
    return (
      <span
        title="Social Media"
        className={`absolute rounded-full bg-pink-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        SM
      </span>
    );
  }

  if (normRole === 'Members Representative') {
    return (
      <span
        title="Members Representative"
        className={`absolute rounded-full bg-sky-600 text-white font-extrabold flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
      >
        MR
      </span>
    );
  }

  return (
    <span
      title={normRole || 'Verified Member'}
      className={`absolute rounded-full bg-[#1877f2] text-white flex items-center justify-center ring-2 ring-white shadow-xs ${containerClass} ${className}`}
    >
      <Check className={`${iconClass} text-white`} />
    </span>
  );
};
