import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Game, User, PricingMode } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import PasswordDialog from "../components/PasswordDialog";
import { UserSearchInput } from "../components/UserSearchInput";
import { formatDisplayPricingInfo } from "../utils/pricingUtils";
import { resolveLocationLink } from "../utils/locationUtils";
import "./GameDetails.scss";
import { MainButton, BackButton } from "@twa-dev/sdk/react";
import {
  formatDate,
  isGameUpcoming,
  isGamePast,
  canJoinGame,
  canLeaveGame,
} from "../utils/gameDateUtils";
import {
  getActiveRegistrations,
  getWaitlistRegistrations,
  getUserRegistration,
  hasAnyPaid,
} from "../utils/registrationsUtils";
import { GameDetailsViewModel } from "../viewmodels/GameDetailsViewModel";
import { PlayersList } from "../components/game-details/PlayersList";
import { WaitlistList } from "../components/game-details/WaitlistList";
import { InfoText } from "../components/game-details/InfoText";
import { ActionLoadingOverlay } from "../components/game-details/ActionLoadingOverlay";
import { AdminActions } from "../components/game-details/AdminActions";
import { ActionGuard } from "../utils/actionGuard";

interface GameDetailsProps {
  user: User;
}

const GameDetails: React.FC<GameDetailsProps> = ({ user }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaidUpdating, setIsPaidUpdating] = useState<number | null>(null); // Stores userId of player being updated
  const [hasBunqIntegration, setHasBunqIntegration] = useState<boolean>(false);
  const [isCheckingBunq, setIsCheckingBunq] = useState<boolean>(true);
  const [isSendingPaymentRequests, setIsSendingPaymentRequests] =
    useState<boolean>(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>("");
  const [showUserSearch, setShowUserSearch] = useState<boolean>(false);

  // ViewModel setup
  const vmRef = useRef<GameDetailsViewModel | null>(null);
  if (!vmRef.current) {
    vmRef.current = new GameDetailsViewModel({
      setGame,
      setIsLoading,
      setIsActionLoading,
      setError,
      setHasBunqIntegration,
      setIsCheckingBunq,
      setIsPaidUpdating,
      setShowUserSearch,
      setIsSendingPaymentRequests,
      setShowPasswordDialog,
      setPasswordError,
      navigate,
    });
  }

  useEffect(() => {
    if (gameId) {
      vmRef.current!.loadGame(parseInt(gameId));
    }
  }, [gameId]);

  // Check Bunq integration status for admin users
  useEffect(() => {
    vmRef.current!.checkBunqIntegration(user.isAdmin);
  }, [user.isAdmin]);

  // Debounce actions to prevent rapid duplicate calls
  const actionGuardRef = useRef(new ActionGuard(1000));
  const isActionAllowed = () => actionGuardRef.current.isAllowed();

  // Determine if the main button should be shown and what text/action it should have
  const mainButtonProps = useCallback(() => {
    // No button during loading states or errors
    if (!game || isLoading || isActionLoading || error) {
      return { show: false };
    }

    // Find user's registration if any
    const userRegistration = game.registrations.find(
      (reg) => reg.userId === user.id
    );

    if (userRegistration) {
      // Check if user can leave the game (up to X hours before or anytime if waitlisted)
      if (
        canLeaveGame(
          game.dateTime,
          userRegistration.isWaitlist,
          game.unregisterDeadlineHours || 5
        )
      ) {
        return {
          show: true,
          text: "Leave Game",
          onClick: () => {
            if (isActionAllowed()) {
              handleUnregister();
            }
          },
        };
      }
    } else {
      // Check if user can join the game (starting X days before)
      if (canJoinGame(game.dateTime)) {
        return {
          show: true,
          text: "Join Game",
          onClick: () => {
            if (isActionAllowed()) {
              handleRegister();
            }
          },
        };
      }
    }

    // Default: don't show button
    return { show: false };
  }, [game, user, isLoading, isActionLoading, error]);

  // ViewModel handles loading; no local wrapper needed

  // date/time helpers moved to utils/gameDateUtils

  // Get info text for timing restrictions
  const getInfoText = () => {
    if (!game) return null;

    const userRegistration = game.registrations.find(
      (reg) => reg.userId === user.id
    );
    const deadlineHours = game.unregisterDeadlineHours || 5;

    // If user is registered, check if they can leave
    if (userRegistration) {
      if (
        !isGamePast(game.dateTime) &&
        !canLeaveGame(
          game.dateTime,
          userRegistration.isWaitlist,
          deadlineHours
        ) &&
        !userRegistration.isWaitlist
      ) {
        return `You can only leave the game up to ${deadlineHours} hours before it starts.`;
      }
    } else {
      // If user is not registered, check if they can join
      if (!canJoinGame(game.dateTime)) {
        const gameDateTime = new Date(game.dateTime);
        const daysBeforeGame = new Date(gameDateTime.getTime());
        daysBeforeGame.setDate(daysBeforeGame.getDate() - 5);
        return `Registration opens ${daysBeforeGame.toLocaleDateString()} (X days before the game).`;
      }
    }

    return null;
  };

  const handleAddParticipant = async (userId: number) => {
    if (!game || isActionLoading) return;
    await vmRef.current!.addParticipant(game, userId);
  };

  const handleRegister = async () => {
    if (!game || isActionLoading) return;
    await vmRef.current!.register(game);
  };

  const handleUnregister = () => {
    if (!game || isActionLoading) return;
    vmRef.current!.confirmAndUnregister(game);
  };

  // Handle removing a player from the game (admin only)
  const handleRemovePlayer = (userId: number) => {
    if (!game) return;
    vmRef.current!.removePlayer(game, userId);
  };

  // Handle toggling paid status for a player
  const handleTogglePaidStatus = (
    userId: number,
    currentPaidStatus: boolean
  ) => {
    if (!game) return;
    vmRef.current!.togglePaidStatus(game, userId, currentPaidStatus);
  };

  // Handle sending payment requests
  const handleSendPaymentRequests = async () => {
    if (!game || !isActionAllowed()) return;
    vmRef.current!.startPaymentRequestsFlow();
  };

  // Handle password dialog submission
  const handlePasswordSubmit = async (password: string) => {
    if (!game) return;
    await vmRef.current!.submitPassword(game.id, password);
  };

  // Handle password dialog cancellation
  const handlePasswordCancel = () => {
    vmRef.current!.cancelPasswordFlow();
  };

  // Handle game deletion with confirmation
  const handleDeleteGame = async () => {
    if (!isActionAllowed()) return;
    await vmRef.current!.deleteGame(parseInt(gameId!));
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !game) {
    return (
      <div className="game-details-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error || "Game not found"}</p>
          <button onClick={() => navigate("/")} className="back-button">
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const activeRegistrations = getActiveRegistrations(game);
  const waitlistRegistrations = getWaitlistRegistrations(game);
  const userRegistration = getUserRegistration(game, user.id);

  // Check if the game is in the past and has no payment requests
  const isPastGame = isGamePast(game.dateTime);
  const hasPaymentRequests = hasAnyPaid(game);
  const showAddParticipantButton =
    user.isAdmin && isPastGame && !hasPaymentRequests;

  // Get the current main button properties
  const {
    show: showMainButton,
    text: mainButtonText,
    onClick: mainButtonClick,
  } = mainButtonProps();

  return (
    <div className="game-details-container">
      {/* BackButton component */}
      <BackButton onClick={() => navigate("/")} />
      <div className="game-header">
        {showAddParticipantButton && showUserSearch && (
          <div className="user-search-container">
            <UserSearchInput
              onSelectUser={handleAddParticipant}
              onCancel={() => setShowUserSearch(false)}
              disabled={isActionLoading}
              placeholder="Search users to add..."
            />
          </div>
        )}

        {/* First line: Game date and time */}
        <div className="game-date-line">
          <div className="game-date">{formatDate(game.dateTime)}</div>
          {(game.locationName || game.locationLink) && (
            <div className="game-location">
              <a
                href={resolveLocationLink(game.locationName, game.locationLink)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {game.locationName || "Open in Maps"}
              </a>
            </div>
          )}
        </div>

        {/* Second line: Status information and actions */}
        <div className="game-status-line">
          <div className="status-info">
            {userRegistration && (
              <div
                className={`user-status ${
                  userRegistration.isWaitlist ? "waitlist" : "registered"
                }`}
              >
                {userRegistration.isWaitlist ? "Waitlist" : "You're in"}
              </div>
            )}

            {game.paymentAmount > 0 && (
              <div className="payment-amount">
                {(() => {
                  const isUpcomingGame = isGameUpcoming(game.dateTime);
                  const pricingInfo = formatDisplayPricingInfo(
                    game.paymentAmount,
                    game.pricingMode || PricingMode.PER_PARTICIPANT,
                    game.maxPlayers,
                    activeRegistrations.length,
                    isUpcomingGame
                  );
                  return `Payment: ${pricingInfo.displayText}`;
                })()}
              </div>
            )}
          </div>

          {/* Admin-only: Game management buttons */}
          {user.isAdmin && (
            <AdminActions
              showAddParticipantButton={showAddParticipantButton}
              showUserSearch={showUserSearch}
              setShowUserSearch={setShowUserSearch}
              isActionLoading={isActionLoading}
              canDelete={isGameUpcoming(game.dateTime)}
              onDelete={handleDeleteGame}
              onEdit={() => navigate(`/game/${gameId}/edit`)}
              canSendPaymentRequests={
                isGamePast(game.dateTime) &&
                game.paymentAmount > 0 &&
                !game.fullyPaid &&
                hasBunqIntegration &&
                !isCheckingBunq
              }
              onSendPaymentRequests={handleSendPaymentRequests}
              isSendingPaymentRequests={isSendingPaymentRequests}
            />
          )}
        </div>
      </div>

      {game.withPositions && (
        <div className="positions-note">
          <p>
            🔶 This game will be played with positions according to the 5-1
            scheme. Knowledge of the 5-1 scheme is expected of all participants.
          </p>
        </div>
      )}

      <div className="players-container">
        <div className="players-stats-header">
          <div className="stats-row">
            <div className="compact-stats">
              <span className="registered-count">
                {activeRegistrations.length}
              </span>
              <span className="stats-divider">/</span>
              <span className="max-count">{game.maxPlayers}</span>
              {waitlistRegistrations.length > 0 && (
                <span className="waitlist-indicator">
                  (+{waitlistRegistrations.length})
                </span>
              )}
            </div>
          </div>
        </div>

        {activeRegistrations.length > 0 ? (
          <div className="players-section">
            <PlayersList
              registrations={activeRegistrations}
              currentUserId={user.id}
              isAdmin={user.isAdmin}
              isPastGame={isGamePast(game.dateTime)}
              isActionLoading={isActionLoading}
              fullyPaid={game.fullyPaid}
              isPaidUpdating={isPaidUpdating}
              onRemovePlayer={handleRemovePlayer}
              onTogglePaidStatus={handleTogglePaidStatus}
            />
          </div>
        ) : null}

        {waitlistRegistrations.length > 0 && (
          <div className="players-section waitlist-section">
            <h2>Waiting List</h2>
            <WaitlistList registrations={waitlistRegistrations} currentUserId={user.id} />
          </div>
        )}

        {activeRegistrations.length === 0 &&
          waitlistRegistrations.length === 0 && (
            <div className="no-players">
              <h2>No players registered yet</h2>
              <p>Be the first to join this game!</p>
            </div>
          )}
      </div>

      <InfoText text={getInfoText()} />

      <ActionLoadingOverlay visible={isActionLoading} />

      {/* MainButton component */}
      {showMainButton && (
        <MainButton
          text={mainButtonText || ""}
          onClick={mainButtonClick}
          progress={isActionLoading}
          disabled={isActionLoading}
        />
      )}

      {/* Password Dialog for Payment Requests */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        title="Enter Password"
        message="Please enter your password to send payment requests."
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        isProcessing={isSendingPaymentRequests}
        error={passwordError}
      />
    </div>
  );
};

export default GameDetails;
