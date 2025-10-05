import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Game, User, PricingMode } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import PasswordDialog from "../components/PasswordDialog";
import GuestRegistrationDialog from "../components/GuestRegistrationDialog";
import BringBallDialog from "../components/BringBallDialog";
import { UserSearchInput } from "../components/UserSearchInput";
import { formatDisplayPricingInfo } from "../utils/pricingUtils";
import { resolveLocationLink } from "../utils/locationUtils";
import { gamesApi } from "../services/api";
import { showPopup } from "../utils/uiPrompts";
import "./GameDetails.scss";
import { MainButton, BackButton } from "@twa-dev/sdk/react";
import { isTelegramApp } from "../utils/telegram";
import {
  formatDate,
  isGameUpcoming,
  isGamePast,
  canJoinGame,
  canLeaveGame,
  DAYS_BEFORE_GAME_TO_JOIN,
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
import PlayerInfoDialog from "../components/PlayerInfoDialog";
import type { UserPublicInfo } from "../types";

interface GameDetailsProps {
  user: User;
}

const GameDetails: React.FC<GameDetailsProps> = ({ user }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const inTelegram = isTelegramApp();

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
  const [isCheckingPayments, setIsCheckingPayments] = useState<boolean>(false);
  const [passwordDialogAction, setPasswordDialogAction] = useState<'payment_requests' | 'check_payments'>('payment_requests');
  const [showGuestDialog, setShowGuestDialog] = useState<boolean>(false);
  const [guestError, setGuestError] = useState<string>("");
  const [isGuestRegistering, setIsGuestRegistering] = useState<boolean>(false);
  const [defaultGuestName, setDefaultGuestName] = useState<string>("");
  const [showPlayerInfo, setShowPlayerInfo] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserPublicInfo | null>(null);
  const [showBringBallDialog, setShowBringBallDialog] = useState<boolean>(false);

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

    // Find user's own registration (exclude their guests)
    const userRegistration = getUserRegistration(game, user.id);

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
        daysBeforeGame.setDate(daysBeforeGame.getDate() - DAYS_BEFORE_GAME_TO_JOIN);
        return `Registration opens ${daysBeforeGame.toLocaleDateString()} (${DAYS_BEFORE_GAME_TO_JOIN} days before the game).`;
      }
    }

    return null;
  };

  const canUnregister = (): boolean => {
    if (!game) return false;
    if (isGamePast(game.dateTime)) return false;
    const deadlineHours = game.unregisterDeadlineHours || 5;
    return canLeaveGame(game.dateTime, false, deadlineHours);
  };

  const handleAddParticipant = async (userId: number) => {
    if (!game || isActionLoading) return;
    await vmRef.current!.addParticipant(game, userId);
  };

  const handleRegister = async () => {
    if (!game || isActionLoading) return;
    // Prevent blocked users from registering
    if (user.blockReason) {
      showPopup({
        title: "Registration blocked",
        message: `You cannot register because: ${user.blockReason}`,
        buttons: [{ type: 'ok' }]
      });
      return;
    }
    // Show the bring ball dialog
    setShowBringBallDialog(true);
  };

  const handleUnregister = () => {
    if (!game || isActionLoading) return;
    vmRef.current!.confirmAndUnregister(game);
  };

  // Handle removing a player or unregistering a guest
  const handleRemovePlayer = async (userId: number, guestName?: string) => {
    if (!game || isActionLoading) return;

    if (user.isAdmin && (userId != user.id || !canUnregister())) {
      vmRef.current!.removePlayer(game, userId, guestName);
      return;
    }

    vmRef.current!.confirmAndUnregister(game, guestName);
  };

  // Handle removing a player or unregistering a guest from the waitlist
  const handleRemovePlayerFromWaitingList = async (userId: number, guestName?: string) => {
    if (!game || isActionLoading) return;

    if (user.isAdmin && userId != user.id) {
      vmRef.current!.removePlayer(game, userId, guestName);
      return;
    }

    vmRef.current!.confirmAndUnregister(game, guestName);
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
    setPasswordDialogAction('payment_requests');
    vmRef.current!.startPaymentRequestsFlow();
  };

  // Handle checking payments for this game
  const handleCheckPayments = async () => {
    if (!game || !isActionAllowed()) return;
    setPasswordDialogAction('check_payments');
    setShowPasswordDialog(true);
  };

  // Handle password dialog submission
  const handlePasswordSubmit = async (password: string) => {
    if (!game) return;

    if (passwordDialogAction === 'check_payments') {
      try {
        setIsCheckingPayments(true);
        setPasswordError('');
        const result = await gamesApi.checkPayments(password, game.id);
        setShowPasswordDialog(false);
        showPopup({
          title: 'Payment check completed',
          message: result.message || 'Payment check completed successfully',
          buttons: [{ type: 'ok' }]
        });
        vmRef.current!.loadGame(game.id);
      } catch (error: any) {
        if (error?.response?.data?.message === 'Invalid password') {
          setPasswordError(error.response?.data?.message);
        } else {
          setShowPasswordDialog(false);
          showPopup({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Unknown error',
            buttons: [{ type: 'ok' }]
          });
        }
      } finally {
        setIsCheckingPayments(false);
      }
    } else {
      await vmRef.current!.submitPassword(game.id, password);
    }
  };

  // Handle password dialog cancellation
  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    setPasswordError("");
  };

  // Handle guest registration button click
  const handleGuestRegister = async () => {
    if (!game || isActionLoading) return;
    // Prevent blocked users from adding guests
    if (user.blockReason) {
      showPopup({
        title: "Guest registration blocked",
        message: `You cannot add guests because: ${user.blockReason}`,
        buttons: [{ type: 'ok' }]
      });
      return;
    }
    
    try {
      // Fetch the last used guest name as default
      const { lastGuestName } = await gamesApi.getLastGuestName(game.id);
      setDefaultGuestName(lastGuestName || "");
      setShowGuestDialog(true);
      setGuestError("");
    } catch (error) {
      console.error('Error fetching last guest name:', error);
      setDefaultGuestName("");
      setShowGuestDialog(true);
      setGuestError("");
    }
  };

  // Handle guest registration dialog submission
  const handleGuestSubmit = async (guestName: string, inviterUserId?: number) => {
    if (!game || isGuestRegistering) return;
    
    setIsGuestRegistering(true);
    setGuestError("");
    
    try {
      // If admin is adding a guest for a past game with inviter selected, use admin endpoint
      const isPastGame = isGamePast(game.dateTime);
      const hasPaymentRequests = hasAnyPaid(game);
      if (user.isAdmin && isPastGame && !hasPaymentRequests && inviterUserId) {
        await gamesApi.addParticipant(game.id, inviterUserId, guestName);
      } else {
        await gamesApi.registerGuestForGame(game.id, guestName);
      }
      vmRef.current!.loadGame(game.id);      
      setShowGuestDialog(false);
    } catch (error: any) {
      console.error('Error registering guest:', error);
      const errorMessage = error.response?.data?.error || 'Failed to register guest';
      setGuestError(errorMessage);
    } finally {
      setIsGuestRegistering(false);
    }
  };

  // Handle guest registration dialog cancellation
  const handleGuestCancel = () => {
    setShowGuestDialog(false);
    setGuestError("");
    setDefaultGuestName("");
  };

  // Admin: open player info popup
  const handleShowPlayerInfo = (user: UserPublicInfo) => {
    setSelectedUser(user);
    setShowPlayerInfo(true);
  };

  const handleClosePlayerInfo = () => {
    setShowPlayerInfo(false);
    setSelectedUser(null);
  };

  // Handle bring ball dialog submission
  const handleBringBallSubmit = async (bringingTheBall: boolean) => {
    if (!game || isActionLoading) return;
    
    await vmRef.current!.register(game, bringingTheBall);
    setShowBringBallDialog(false);
  };

  // Handle bring ball dialog cancellation
  const handleBringBallCancel = () => {
    setShowBringBallDialog(false);
  };

  // Handle game deletion with confirmation
  const handleDeleteGame = () => {
    if (!game) return;
    vmRef.current!.deleteGame(game.id);
  };

  // Check if guest registration should be shown
  const shouldShowGuestButton = useCallback(() => {
    if (!game || isLoading || isActionLoading || error) {
      return false;
    }
    
    // Only show for upcoming games with open registration
    return canJoinGame(game.dateTime);
  }, [game, isLoading, isActionLoading, error]);

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
  // Counts for past games header (exclude waitlist)
  const totalActiveCount = activeRegistrations.length;
  const paidActiveCount = activeRegistrations.filter((reg) => reg.paid).length;

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
      {inTelegram && (
        <BackButton onClick={() => navigate("/")} />
      )}
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
                  return pricingInfo.displayText;
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
              canCheckPayments={
                isGamePast(game.dateTime) &&
                game.paymentAmount > 0 &&
                !game.fullyPaid &&
                hasBunqIntegration &&
                !isCheckingBunq
              }
              onCheckPayments={handleCheckPayments}
              isCheckingPayments={isCheckingPayments}
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

      {isPastGame && game.collectorUser && user.isAdmin && (
        <div className="collector-info">
          <span className="collector-label">Payments collected by</span>
          <div className="collector-user">
            <div className="collector-avatar">
              {game.collectorUser.avatarUrl ? (
                <img
                  src={game.collectorUser.avatarUrl}
                  alt={`${game.collectorUser.displayName}'s avatar`}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {game.collectorUser.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="collector-name">{game.collectorUser.displayName}</span>
          </div>
        </div>
      )}

      <div className="players-container">
        <div className="players-stats-header">
          <div className="stats-row">
            <div className="compact-stats">
              <span className="registered-count">
                {isPastGame ? paidActiveCount : activeRegistrations.length}
              </span>
              <span className="stats-divider">/</span>
              <span className="max-count">
                {isPastGame ? totalActiveCount : game.maxPlayers}
              </span>
              {!isPastGame && waitlistRegistrations.length > 0 && (
                <span className="waitlist-indicator">
                  (+{waitlistRegistrations.length})
                </span>
              )}
            </div>

            {shouldShowGuestButton() && (
              <div className="header-actions">
                <button
                  className="add-guest-button"
                  onClick={handleGuestRegister}
                  disabled={isActionLoading || isGuestRegistering}
                >
                  {isGuestRegistering ? "Registering..." : "Add guest"}
                </button>
              </div>
            )}
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
              isPaidUpdating={isPaidUpdating}
              hasPaymentRequests={hasPaymentRequests}
              onRemovePlayer={handleRemovePlayer}
              onTogglePaidStatus={handleTogglePaidStatus}
              canUnregister={canUnregister}
              onShowUserInfo={user.isAdmin ? handleShowPlayerInfo : undefined}
            />
          </div>
        ) : null}

        {waitlistRegistrations.length > 0 && (
          <div className="players-section waitlist-section">
            <h2>Waiting List</h2>
            <WaitlistList
              registrations={waitlistRegistrations}
              currentUserId={user.id}
              isAdmin={user.isAdmin}
              onShowUserInfo={user.isAdmin ? handleShowPlayerInfo : undefined}
              onRemovePlayer={handleRemovePlayerFromWaitingList}
            />
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

      {/* Main button (Telegram SDK inside Telegram, regular button in web) */}
      {showMainButton && (
        inTelegram ? (
          <MainButton
            text={mainButtonText || ""}
            onClick={mainButtonClick}
            progress={isActionLoading}
            disabled={isActionLoading}
          />
        ) : (
          <div className="bottom-action-bar">
            <button
              className="tg-main-button btn btn-primary"
              onClick={mainButtonClick}
              disabled={isActionLoading}
            >
              {isActionLoading ? "Processing..." : (mainButtonText || "Action")}
            </button>
          </div>
        )
      )}

      {/* Password Dialog */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        title="Enter Password"
        message={passwordDialogAction === 'check_payments'
          ? "Please enter your password to check payment statuses."
          : "Please enter your password to send payment requests."
        }
        onSubmit={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        isProcessing={passwordDialogAction === 'check_payments' ? isCheckingPayments : isSendingPaymentRequests}
        error={passwordError}
      />

      {/* Guest Registration Dialog */}
      <GuestRegistrationDialog
        isOpen={showGuestDialog}
        defaultGuestName={defaultGuestName}
        onSubmit={handleGuestSubmit}
        onCancel={handleGuestCancel}
        isProcessing={isGuestRegistering}
        error={guestError}
        allowInviterSelection={user.isAdmin && isPastGame && !hasPaymentRequests}
      />

      {/* Player Info Dialog (admin only) */}
      <PlayerInfoDialog
        isOpen={showPlayerInfo}
        onClose={handleClosePlayerInfo}
        user={selectedUser}
      />

      {/* Bring Ball Dialog */}
      <BringBallDialog
        isOpen={showBringBallDialog}
        onSubmit={handleBringBallSubmit}
        onCancel={handleBringBallCancel}
        isProcessing={isActionLoading}
      />
    </div>
  );
};

export default GameDetails;
