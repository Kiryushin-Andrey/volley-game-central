import React from 'react';
import { Button, Cell } from '@telegram-apps/telegram-ui';
import type { UnpaidRegistration } from '../services/api';

interface UnpaidGamesListProps {
  items: UnpaidRegistration[];
}

const UnpaidGamesList: React.FC<UnpaidGamesListProps> = ({ items }) => {
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
    <div className="unpaid-list">
      {items.map((item, idx) => {
        const dt = new Date(item.dateTime);
        const hasAmount = item.totalAmountCents != null;
        const amount = hasAmount ? (item.totalAmountCents! / 100).toFixed(2) : null;
        return (
          <Cell
            key={idx}
            className="unpaid-item"
            multiline
            subtitle={`${formatGameDate(dt)}${item.locationName ? ` • ${item.locationName}` : ''}`}
            after={item.paymentLink ? (
              <Button
                size="s"
                type="button"
                aria-label="Pay now"
                onClick={() => window.open(item.paymentLink as string, '_blank', 'noopener,noreferrer')}
              >
                Pay now
              </Button>
            ) : undefined}
          >
            {hasAmount ? `€${amount}` : 'Unpaid'}
          </Cell>
        );
      })}
    </div>
  );
};

export default UnpaidGamesList;
