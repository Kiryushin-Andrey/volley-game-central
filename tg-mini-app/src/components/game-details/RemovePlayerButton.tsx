import React from 'react';

interface RemovePlayerButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}

export const RemovePlayerButton: React.FC<RemovePlayerButtonProps> = ({
  onClick,
  disabled = false,
  title = 'Remove player',
  ariaLabel = 'Remove player',
}) => {
  return (
    <button
      className="remove-player-button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
      </svg>
    </button>
  );
};

export default RemovePlayerButton;
