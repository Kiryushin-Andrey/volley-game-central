import React from 'react';
import type { UnpaidRegistration } from '../services/api';

interface UnpaidGamesListProps {
  items: UnpaidRegistration[];
}

const UnpaidGamesList: React.FC<UnpaidGamesListProps> = ({ items }) => {
  // Format like: "Sun 8 Jun, 17:00"
  const formatGameDate = (dt: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(dt);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const weekday = get('weekday');
    const day = get('day');
    const month = get('month');
    const hour = get('hour');
    const minute = get('minute');
    return `${weekday} ${day} ${month}, ${hour}:${minute}`;
  };

  if (!items || items.length === 0) return null;

  return (
    <ul
      className="unpaid-list"
      style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {items.map((item, idx) => {
        const dt = new Date(item.dateTime);
        const hasAmount = item.totalAmountCents != null;
        const amount = hasAmount ? (item.totalAmountCents! / 100).toFixed(2) : null;
        return (
          <li
            key={idx}
            className="unpaid-item"
            style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}
          >
            <div
              className="unpaid-top"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {hasAmount && <div style={{ fontWeight: 600 }}>€{amount}</div>}
                <div className="unpaid-sub" style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>
                  {formatGameDate(dt)} {item.locationName ? `• ${item.locationName}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {item.paymentLink && (
                  <a
                    className="link"
                    href={item.paymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 4 }}
                  >
                    Pay now →
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default UnpaidGamesList;
