import React from 'react';

interface MainButtonProps {
  text: string;
  onClick: () => void;
}

const MainButton: React.FC<MainButtonProps> = ({ text, onClick }) => {
  return (
    <button className="tg-main-button" onClick={onClick}>
      {text}
    </button>
  );
};

export default MainButton;
