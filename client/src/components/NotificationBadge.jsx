import React from 'react';

const NotificationBadge = ({ count }) => {
  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default NotificationBadge;
