import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, PricingMode } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import PasswordDialog from "../components/PasswordDialog";
import GuestRegistrationDialog from "../components/GuestRegistrationDialog";
import BringBallDialog from "../components/BringBallDialog";
import { UserSearchInput } from "../components/UserSearchInput";
import { HalloweenDecorations } from "../components/HalloweenDecorations";
import { formatDisplayPricingInfo } from "../utils/pricingUtils";
import { resolveLocationLink } from "../utils/locationUtils";
import "./GameDetails.scss";
import { MainButton, BackButton } from "@twa-dev/sdk/react";
import { isTelegramApp } from "../utils/telegram";
import {
  formatDate,
  isGameUpcoming,
  isGamePast,
} from "../utils/gameDateUtils";
import {
  getActiveRegistrations,
  getWaitlistRegistrations,
  getUserRegistration,
} from "../utils/registrationsUtils";
import { GameDetailsViewModel, GameDataState, ActionState, BunqState, PaymentRequestState, DialogState } from "../viewmodels/GameDetailsViewModel";
import { PlayersList } from "../components/game-details/PlayersList";
import { WaitlistList } from "../components/game-details/WaitlistList";
import { InfoText } from "../components/game-details/InfoText";
import { ActionLoadingOverlay } from "../components/game-details/ActionLoadingOverlay";
import { AdminActions } from "../components/game-details/AdminActions";
import PlayerInfoDialog from "../components/PlayerInfoDialog";
import CategoryInfoBlock from "../components/CategoryInfoBlock";

interface GameDetailsProps {
  user: User;
}

const GameDetails: React.FC<GameDetailsProps> = ({ user }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const inTelegram = isTelegramApp();

  // Split state into logical groups for better performance
  const [gameData, setGameData] = useState<GameDataState>({
    game: null,
    isLoading: true,
    error: null,
  });
  const [action, setAction] = useState<ActionState>({
    isActionLoading: false,
    isPaidUpdating: null,
  });
  const [bunq, setBunq] = useState<BunqState>({
    hasBunqIntegration: false,
    isCheckingBunq: true,
  });
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestState>({
    isSendingPaymentRequests: false,
    showPasswordDialog: false,
    passwordError: '',
    passwordDialogAction: 'payment_requests',
    isCheckingPayments: false,
  });
  const [dialogs, setDialogs] = useState<DialogState>({
    showUserSearch: false,
    showGuestDialog: false,
    guestError: '',
    isGuestRegistering: false,
    defaultGuestName: '',
    showPlayerInfo: false,
    selectedUser: null,
    showBringBallDialog: false,
  });

  // ViewModel setup - owns the state internally
  const viewModel = useMemo(() => {
    return new GameDetailsViewModel({
      updateGameData: (updates) => setGameData(prev => ({ ...prev, ...updates })),
      updateAction: (updates) => setAction(prev => ({ ...prev, ...updates })),
      updateBunq: (updates) => setBunq(prev => ({ ...prev, ...updates })),
      updatePaymentRequest: (updates) => setPaymentRequest(prev => ({ ...prev, ...updates })),
      updateDialogs: (updates) => setDialogs(prev => ({ ...prev, ...updates })),
      navigate,
      user,
    });
  }, [navigate, user]);

  useEffect(() => {
    if (gameId) {
      viewModel.loadGame(parseInt(gameId));
    }
  }, [gameId, viewModel]);

  // Check Bunq integration status for admin users
  useEffect(() => {
    if (gameData.game) {
      const isGameAdmin = user.isAdmin || (gameData.game.isAssignedAdmin ?? false);
      viewModel.checkBunqIntegration(isGameAdmin);
    }
  }, [user.isAdmin, gameData.game?.isAssignedAdmin, gameData.game, viewModel]);


  // Generate random positions for falling leaves - must be before early returns
  const fallingLeaves = useMemo(() => {
    if (!gameData.game || gameData.game.tag !== 'halloween') return [];
    
    const leaves = ['🍂', '🍁'];
    const leafCount = 8;
    
    return Array.from({ length: leafCount }, (_, i) => ({
      emoji: leaves[i % 2],
      left: `${10 + Math.random() * 80}%`, // Random position between 10-90%
      animationDelay: `${i * 1.5}s`,
      animationDuration: `${8 + Math.random() * 3}s`, // 8-11s
      fontSize: `${20 + Math.random() * 6}px`, // 20-26px
      opacity: 0.3 + Math.random() * 0.1, // 0.3-0.4
    }));
  }, [gameData.game]);

  if (gameData.isLoading) {
    return <LoadingSpinner />;
  }

  if (gameData.error || !gameData.game) {
    return (
      <div className="game-details-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{gameData.error || "Game not found"}</p>
          <button onClick={() => navigate("/")} className="back-button">
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const activeRegistrations = getActiveRegistrations(gameData.game);
  const waitlistRegistrations = getWaitlistRegistrations(gameData.game);
  const userRegistration = getUserRegistration(gameData.game, user.id);
  // Counts for past games header (exclude waitlist)
  const totalActiveCount = activeRegistrations.length;
  const paidActiveCount = activeRegistrations.filter((reg) => reg.paid).length;

  // Check if the game is in the past and has no payment requests
  const isPastGame = isGamePast(gameData.game.dateTime);
  const hasPaymentRequests = !!gameData.game.collectorUser;
  const isGameAdmin = user.isAdmin || (gameData.game.isAssignedAdmin ?? false);
  const showAddParticipantButton =
    isGameAdmin && !hasPaymentRequests && (isPastGame || gameData.game.readonly);

  // Get the current main button properties
  const {
    show: showMainButton,
    text: mainButtonText,
    onClick: mainButtonClick,
  } = viewModel.getMainButtonProps();

  const isHalloween = gameData.game.tag === 'halloween';

  return (
    <div className={`game-details-container ${isHalloween ? 'halloween-theme' : ''}`}>
      {isHalloween && (
        <>
          <HalloweenDecorations variant="page" />
          <div className="falling-leaves-layer">
            {fallingLeaves.map((leaf, index) => (
              <div
                key={index}
                className="leaf"
                style={{
                  left: leaf.left,
                  animationDelay: leaf.animationDelay,
                  animationDuration: leaf.animationDuration,
                  fontSize: leaf.fontSize,
                  opacity: leaf.opacity,
                }}
              >
                {leaf.emoji}
              </div>
            ))}
          </div>
        </>
      )}
      {inTelegram && (
        <BackButton onClick={() => navigate("/")} />
      )}
      <div className="game-header">
        {showAddParticipantButton && dialogs.showUserSearch && (
          <div className="user-search-container">
              <UserSearchInput
              onSelectUser={(userId) => viewModel.handleAddParticipant(userId)}
              onCancel={() => viewModel.setShowUserSearch(false)}
              disabled={action.isActionLoading}
              placeholder="Search users to add..."
            />
          </div>
        )}

        {gameData.game.title && (
          <div className="game-title">
            {gameData.game.title}
          </div>
        )}

        {/* First line: Game date and time */}
        <div className="game-date-line">
          <div className="game-date">{formatDate(gameData.game.dateTime)}</div>
          {(gameData.game.locationName || gameData.game.locationLink) && (
            <div className="game-location">
              <a
                href={resolveLocationLink(gameData.game.locationName, gameData.game.locationLink)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {gameData.game.locationName || "Open in Maps"}
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

            {gameData.game.paymentAmount > 0 && (
              <div className="payment-amount">
                {(() => {
                  const isUpcomingGame = isGameUpcoming(gameData.game.dateTime);
                  const pricingInfo = formatDisplayPricingInfo(
                    gameData.game.paymentAmount,
                    gameData.game.pricingMode || PricingMode.PER_PARTICIPANT,
                    gameData.game.maxPlayers,
                    activeRegistrations.length,
                    isUpcomingGame
                  );
                  return pricingInfo.displayText;
                })()}
              </div>
            )}
          </div>

          {/* Admin-only: Game management buttons */}
          {(user.isAdmin || (gameData.game.isAssignedAdmin ?? false)) && (
            <AdminActions
              showAddParticipantButton={showAddParticipantButton}
              showUserSearch={dialogs.showUserSearch}
              setShowUserSearch={(show) => viewModel.setShowUserSearch(show)}
              isActionLoading={action.isActionLoading}
              canDelete={isGameUpcoming(gameData.game.dateTime)}
              onDelete={() => viewModel.handleDeleteGame()}
              onEdit={() => navigate(`/game/${gameId}/edit`)}
              canSendPaymentRequests={
                (isGamePast(gameData.game.dateTime) || gameData.game.readonly) &&
                gameData.game.paymentAmount > 0 &&
                !gameData.game.fullyPaid &&
                bunq.hasBunqIntegration &&
                !bunq.isCheckingBunq
              }
              onSendPaymentRequests={() => viewModel.handleSendPaymentRequests()}
              isSendingPaymentRequests={paymentRequest.isSendingPaymentRequests}
              canCheckPayments={
                hasPaymentRequests &&
                gameData.game.paymentAmount > 0 &&
                !gameData.game.fullyPaid &&
                bunq.hasBunqIntegration &&
                !bunq.isCheckingBunq
              }
              onCheckPayments={() => viewModel.handleCheckPayments()}
              isCheckingPayments={paymentRequest.isCheckingPayments}
            />
          )}
        </div>
      </div>
      
      {viewModel.gameCategory && !gameData.game.readonly && (
        <div className="category-info-block-wrapper">
          <CategoryInfoBlock category={viewModel.gameCategory} />
        </div>
      )}

      {isHalloween && (
        <div className="halloween-note">
          <p>
            🎃 Halloween Special! Get ready for a spooky volleyball night! 👻🦇
          </p>
        </div>
      )}

      {gameData.game.readonly && (
        <div className="readonly-note">
          <p>
            🔒 This game is readonly. Registration and deregistration are closed. Please contact the game organizers if you have any questions.
          </p>
        </div>
      )}

      {isPastGame && gameData.game.collectorUser && (user.isAdmin || (gameData.game.isAssignedAdmin ?? false)) && (
        <div className="collector-info">
          <span className="collector-label">Payments collected by</span>
          <div className="collector-user">
            <div className="collector-avatar">
              {gameData.game.collectorUser.avatarUrl ? (
                <img
                  src={gameData.game.collectorUser.avatarUrl}
                  alt={`${gameData.game.collectorUser.displayName}'s avatar`}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {gameData.game.collectorUser.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="collector-name">{gameData.game.collectorUser.displayName}</span>
          </div>
        </div>
      )}

      <div className="players-container">
        {((!gameData.game.readonly || isGameAdmin) || viewModel.shouldShowAddGuestButton()) && (
          <div className="players-stats-header">
            <div className="stats-row">
              {(!gameData.game.readonly || isGameAdmin) && (
                <div className="compact-stats">
                  <span className="registered-count">
                    {isPastGame ? paidActiveCount : activeRegistrations.length}
                  </span>
                  <span className="stats-divider">/</span>
                  <span className="max-count">
                    {isPastGame ? totalActiveCount : gameData.game.maxPlayers}
                  </span>
                  {!isPastGame && waitlistRegistrations.length > 0 && (
                    <span className="waitlist-indicator">
                      (+{waitlistRegistrations.length})
                    </span>
                  )}
                </div>
              )}

              {viewModel.shouldShowAddGuestButton() && (
                <div className="header-actions">
                  <button
                    className="add-guest-button"
                    onClick={() => viewModel.handleGuestRegister()}
                    disabled={action.isActionLoading || dialogs.isGuestRegistering}
                  >
                    {dialogs.isGuestRegistering ? "Registering..." : "Add guest"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeRegistrations.length > 0 ? (
          <div className="players-section">
            <PlayersList
              registrations={activeRegistrations}
              currentUserId={user.id}
              isAdmin={isGameAdmin}
              isPastGame={isGamePast(gameData.game.dateTime)}
              isReadonly={gameData.game.readonly}
              isActionLoading={action.isActionLoading}
              isPaidUpdating={action.isPaidUpdating}
              hasPaymentRequests={hasPaymentRequests}
              onRemovePlayer={(userId, guestName) => viewModel.handleRemovePlayer(userId, guestName)}
              onTogglePaidStatus={(userId, currentPaidStatus) => viewModel.handleTogglePaidStatus(userId, currentPaidStatus)}
              canUnregister={viewModel.canUnregister()}
              onShowUserInfo={isGameAdmin ? (user) => viewModel.handleShowPlayerInfo(user) : undefined}
            />
          </div>
        ) : null}

        {waitlistRegistrations.length > 0 && (
          <div className="players-section waitlist-section">
            <h2>Waiting List</h2>
            <WaitlistList
              registrations={waitlistRegistrations}
              currentUserId={user.id}
              isAdmin={isGameAdmin}
              onShowUserInfo={isGameAdmin ? (user) => viewModel.handleShowPlayerInfo(user) : undefined}
              onRemovePlayer={(userId, guestName) => viewModel.handleRemovePlayerFromWaitingList(userId, guestName)}
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

      <InfoText text={viewModel.getInfoText()} />

      <ActionLoadingOverlay visible={action.isActionLoading} />

      {/* Main button (Telegram SDK inside Telegram, regular button in web) */}
      {showMainButton && (
        inTelegram ? (
          <MainButton
            text={mainButtonText || ""}
            onClick={mainButtonClick}
            progress={action.isActionLoading}
            disabled={action.isActionLoading}
          />
        ) : (
          <div className="bottom-action-bar">
            <button
              className="tg-main-button btn btn-primary"
              onClick={mainButtonClick}
              disabled={action.isActionLoading}
            >
              {action.isActionLoading ? "Processing..." : (mainButtonText || "Action")}
            </button>
          </div>
        )
      )}

      {/* Password Dialog */}
      <PasswordDialog
        isOpen={paymentRequest.showPasswordDialog}
        title="Enter Password"
        message={paymentRequest.passwordDialogAction === 'check_payments'
          ? "Please enter your password to check payment statuses."
          : "Please enter your password to send payment requests."
        }
        onSubmit={(password) => viewModel.handlePasswordSubmit(password)}
        onCancel={() => viewModel.handlePasswordCancel()}
        isProcessing={paymentRequest.passwordDialogAction === 'check_payments' ? paymentRequest.isCheckingPayments : paymentRequest.isSendingPaymentRequests}
        error={paymentRequest.passwordError}
      />

      {/* Guest Registration Dialog */}
      <GuestRegistrationDialog
        isOpen={dialogs.showGuestDialog}
        defaultGuestName={dialogs.defaultGuestName}
        onSubmit={(guestName, inviterUserId) => viewModel.handleGuestSubmit(guestName, inviterUserId)}
        onCancel={() => viewModel.handleGuestCancel()}
        isProcessing={dialogs.isGuestRegistering}
        error={dialogs.guestError}
        allowInviterSelection={isGameAdmin && (isPastGame || gameData.game.readonly) && !hasPaymentRequests}
      />

      {/* Player Info Dialog (admin only) */}
      <PlayerInfoDialog
        isOpen={dialogs.showPlayerInfo}
        onClose={() => viewModel.handleClosePlayerInfo()}
        user={dialogs.selectedUser}
      />

      {/* Bring Ball Dialog */}
      <BringBallDialog
        isOpen={dialogs.showBringBallDialog}
        onSubmit={(bringingTheBall) => viewModel.handleBringBallSubmit(bringingTheBall)}
        onCancel={() => viewModel.handleBringBallCancel()}
        isProcessing={action.isActionLoading}
      />
    </div>
  );
};

export default GameDetails;
