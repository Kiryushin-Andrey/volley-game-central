import React from 'react';
import './ToggleSwitch.scss';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  id,
}) => {
  return (
    <div className="toggle-container">
      <label className="toggle-switch" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="slider round"></span>
      </label>
      <span className="toggle-label">{label}</span>
    </div>
  );
};

export default ToggleSwitch;

