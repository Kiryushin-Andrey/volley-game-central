import React, { useEffect, useRef, useState } from 'react';
import VolleyballMark from './VolleyballMark';
import { benchOverflow, capacityRatio, usesSpotDots, type CapacityKind } from '../utils/courtTheme';
import { prefersReducedMotion } from '../utils/courtMotion';

interface CapacityMeterProps {
  count: number;
  max: number;
  kind?: CapacityKind;
  countClassName?: string;
  maxClassName?: string;
}

function useTickingCount(value: number): number {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    let current = displayRef.current;
    if (current === value) return;
    const step = value > current ? 1 : -1;
    const timer = window.setInterval(() => {
      current += step;
      const done = (step > 0 && current >= value) || (step < 0 && current <= value);
      if (done) {
        current = value;
        setDisplay(value);
        window.clearInterval(timer);
        return;
      }
      setDisplay(current);
    }, 40);
    return () => window.clearInterval(timer);
  }, [value]);

  return display;
}

export const CapacityMeter: React.FC<CapacityMeterProps> = ({
  count,
  max,
  kind = 'roster',
  countClassName = '',
  maxClassName = '',
}) => {
  const displayCount = useTickingCount(count);
  const ratio = capacityRatio(count, max);
  const full = max > 0 && count >= max;
  const dots = usesSpotDots(max, kind);
  const overflow = dots ? benchOverflow(count, max) : 0;
  const [ballReady, setBallReady] = useState(false);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const prior = previous.current;
    previous.current = count;
    if (prior === null || prefersReducedMotion()) return;
    if (count > prior) {
      setBallReady(false);
      const frame = window.requestAnimationFrame(() => setBallReady(true));
      return () => window.cancelAnimationFrame(frame);
    }
    if (count < prior) {
      setBallReady(false);
    }
  }, [count]);

  const filledDots = Math.min(count, max);
  const arrivingIndex = filledDots - 1;

  return (
    <div
      className={`capacity-meter${full ? ' is-full' : ''}${ballReady ? ' has-ball' : ''}`}
      role="img"
      aria-label={max > 0 ? `${count} of ${max}` : `${count}`}
    >
      {dots ? (
        <div className="capacity-dots" aria-hidden="true">
          {Array.from({ length: max }, (_, index) => {
            const filled = index < filledDots;
            const arriving = ballReady && index === arrivingIndex;
            return (
              <span
                key={index}
                className={`capacity-dot${filled ? ' filled' : ''}${arriving ? ' arriving' : ''}`}
              >
                {arriving && <VolleyballMark className="capacity-ball" />}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="capacity-track" aria-hidden="true">
          <div className="capacity-fill" style={{ width: `${ratio * 100}%` }} />
          {ballReady && (
            <span className="capacity-ball-slot" style={{ left: `${ratio * 100}%` }}>
              <VolleyballMark className="capacity-ball" />
            </span>
          )}
        </div>
      )}
      <span className="capacity-count">
        <span className={`counter ${countClassName}`.trim()}>{displayCount}</span>
        <span className="divider stats-divider">/</span>
        <span className={`counter ${maxClassName}`.trim()}>{max}</span>
      </span>
      {overflow > 0 && (
        <span className="capacity-bench">+{overflow} on the bench</span>
      )}
    </div>
  );
};

export default CapacityMeter;
