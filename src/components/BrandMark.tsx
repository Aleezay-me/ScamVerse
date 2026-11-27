import React from 'react';

interface BrandMarkProps {
  onClick?: () => void;
  inverted?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ onClick, inverted = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg py-1 cursor-pointer"
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Shield Base in Pakistan Emerald Green */}
        <path
          d="M15 2.5L25 6.5V14.2C25 20.5 20.7 25.9 15 27.4C9.3 25.9 5 20.5 5 14.2V6.5L15 2.5Z"
          fill="#047857"
          stroke="#10B981"
          strokeWidth="1.5"
        />
        {/* Crescent */}
        <path
          d="M15.8 9.2C12.8 9.2 10.5 11.5 10.5 14.5C10.5 17.5 12.8 19.8 15.8 19.8C17.1 19.8 18.2 19.3 19.1 18.5C17.9 18.9 16.5 18.6 15.5 17.6C14.2 16.3 14.2 14.1 15.5 12.8C16.5 11.8 17.9 11.5 19.1 11.9C18.2 10.3 17.1 9.2 15.8 9.2Z"
          fill="#FFFFFF"
        />
        {/* Star */}
        <path
          d="M19.2 12.2L19.7 13.5L21 13.6L20 14.5L20.3 15.8L19.2 15.1L18.1 15.8L18.4 14.5L17.4 13.6L18.7 13.5L19.2 12.2Z"
          fill="#FFFFFF"
        />
      </svg>
      <span
        className={`font-display text-lg font-bold tracking-tight ${
          inverted ? 'text-white' : 'text-slate-900'
        }`}
      >
        ScamVerse
      </span>
    </button>
  );
};
