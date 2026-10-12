import React from 'react';
import { Switch } from '@telegram-apps/telegram-ui';
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
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="toggle-label" htmlFor={id}>{label}</label>
    </div>
  );
};

export default ToggleSwitch;

