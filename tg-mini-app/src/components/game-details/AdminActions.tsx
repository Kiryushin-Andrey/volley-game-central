import React from 'react';
import { FaCog } from 'react-icons/fa';
import { IoSync } from 'react-icons/io5';

interface Props {
  showAddParticipantButton: boolean;
  showUserSearch: boolean;
  setShowUserSearch: (v: boolean) => void;
  isActionLoading: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onEdit: () => void;
  canSendPaymentRequests: boolean;
  onSendPaymentRequests: () => void;
  isSendingPaymentRequests: boolean;
  canCheckPayments: boolean;
  onCheckPayments: () => void;
  isCheckingPayments: boolean;
}

export const AdminActions: React.FC<Props> = ({
  showAddParticipantButton,
  showUserSearch,
  setShowUserSearch,
  isActionLoading,
  canDelete,
  onDelete,
  onEdit,
  canSendPaymentRequests,
  onSendPaymentRequests,
  isSendingPaymentRequests,
  canCheckPayments,
  onCheckPayments,
  isCheckingPayments,
}) => {
  return (
    <div className="admin-actions">
      {showAddParticipantButton && !showUserSearch && (
        <button
          className="add-participant-button"
          onClick={() => setShowUserSearch(!showUserSearch)}
          disabled={isActionLoading}
          title={showUserSearch ? 'Cancel' : 'Add Participant'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </button>
      )}

      <button className="edit-game-button" onClick={onEdit} title="Edit Game Settings">
        <FaCog />
      </button>

      {canDelete && (
        <button className="delete-game-button" onClick={onDelete} title="Delete Game" disabled={isActionLoading}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      )}

      {canSendPaymentRequests && (
        <button
          className="send-payment-requests-button"
          onClick={onSendPaymentRequests}
          disabled={isSendingPaymentRequests || isActionLoading}
          title="Send payment requests to unpaid players"
        >
          {isSendingPaymentRequests ? (
            <div className="mini-spinner"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path d="M15 18.5c-2.51 0-4.68-1.42-5.76-3.5H15v-2H8.58c-.05-.33-.08-.66-.08-1s.03-.67.08-1H15V9H9.24C10.32 6.92 12.5 5.5 15 5.5c1.61 0 3.09.59 4.23 1.57L21 5.3C19.41 3.87 17.3 3 15 3c-3.92 0-7.24 2.51-8.48 6H3v2h3.06c-.04.33-.06.66-.06 1s.02.67.06 1H3v2h3.52c1.24 3.49 4.56 6 8.48 6 2.31 0 4.41-.87 6-2.3l-1.78-1.77c-1.13.98-2.6 1.57-4.22 1.57z" />
            </svg>
          )}
        </button>
      )}

      {canCheckPayments && (
        <button
          className="check-payments-button"
          onClick={onCheckPayments}
          disabled={isCheckingPayments || isActionLoading}
          title="Check payment status for this game"
        >
          {isCheckingPayments ? (
            <div className="mini-spinner"></div>
          ) : (
            <IoSync />
          )}
        </button>
      )}
    </div>
  );
};


