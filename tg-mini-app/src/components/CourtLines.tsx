import React, { useId } from 'react';

/** A point across the court, t = 0 at the far baseline and t = 1 at the near baseline. */
function courtEdge(t: number) {
  const y = 18 + t * 96;
  const x1 = 62 + t * (22 - 62);
  const x2 = 178 + t * (218 - 178);
  return { x1, y, x2 };
}

/**
 * Indoor court seen from one end: blue floor, white boundary and attack lines,
 * and a net with mesh and antennas across the middle.
 */
export const CourtLines: React.FC<{ className?: string }> = ({ className }) => {
  const id = useId().replace(/:/g, '');
  const far = courtEdge(0);
  const attackFar = courtEdge(0.33);
  const meshTop = courtEdge(0.43);
  const net = courtEdge(0.5);
  const attackNear = courtEdge(0.67);
  const near = courtEdge(1);
  const floor = `${far.x1},${far.y} ${far.x2},${far.y} ${near.x2},${near.y} ${near.x1},${near.y}`;

  const meshRows = [0.43, 0.455, 0.47, 0.485, 0.5].map((t) => courtEdge(t));
  const meshCols = Array.from({ length: 15 }, (_, index) => index / 14);

  return (
    <svg className={className} viewBox="0 0 240 128" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3c82b0" />
          <stop offset="55%" stopColor="#246492" />
          <stop offset="100%" stopColor="var(--court-blue)" />
        </linearGradient>
      </defs>
      <polygon points={floor} fill={`url(#${id}-floor)`} />
      <g fill="none" stroke="var(--court-line)" strokeLinejoin="round" strokeLinecap="round">
        <polygon points={floor} strokeWidth="2" />
        <line x1={attackFar.x1} y1={attackFar.y} x2={attackFar.x2} y2={attackFar.y} strokeWidth="1.5" />
        <line x1={attackNear.x1} y1={attackNear.y} x2={attackNear.x2} y2={attackNear.y} strokeWidth="1.5" />
      </g>
      <g stroke="var(--court-line)" strokeWidth="0.7">
        {meshRows.map((row) => (
          <line key={row.y} x1={row.x1} y1={row.y} x2={row.x2} y2={row.y} />
        ))}
        {meshCols.map((portion) => {
          const xTop = meshTop.x1 + portion * (meshTop.x2 - meshTop.x1);
          const xBot = net.x1 + portion * (net.x2 - net.x1);
          return <line key={portion} x1={xTop} y1={meshTop.y} x2={xBot} y2={net.y} />;
        })}
      </g>
      <line x1={net.x1} y1={net.y - 16} x2={net.x1} y2={net.y + 2} stroke="var(--ball-gold)" strokeWidth="2.4" />
      <line x1={net.x2} y1={net.y - 16} x2={net.x2} y2={net.y + 2} stroke="var(--ball-gold)" strokeWidth="2.4" />
    </svg>
  );
};

export default CourtLines;
