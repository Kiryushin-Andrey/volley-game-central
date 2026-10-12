import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Banner, Button, Placeholder, Title } from "@telegram-apps/telegram-ui";
import { User, PricingMode } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import PasswordDialog from "../components/PasswordDialog";
import GuestRegistrationDialog from "../components/GuestRegistrationDialog";
import BringBallDialog from "../components/BringBallDialog";
import { UserSearchInput } from "../components/UserSearchInput";
import { HalloweenDecorations } from "../components/HalloweenDecorations";
import { NewYearPageDecorations } from "../components/NewYearPageDecorations";
import { March8PageDecorations } from "../components/March8PageDecorations";
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
import { GameDetailsViewModel } from "../viewmodels/GameDetailsViewModel";
import { uiPrompts } from "../utils/uiPrompts";
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
  const location = useLocation();
  const inTelegram = isTelegramApp();

  // VM owns UI state; React.useSyncExternalStore is the idiomatic subscribe bridge
  const viewModel = useMemo(
    () =>
      new GameDetailsViewModel({
        navigate,
        user,
        prompts: uiPrompts,
      }),
    [navigate, user],
  );

  const { gameData, action, bunq, paymentRequest, dialogs } =
    useSyncExternalStore(
      viewModel.subscribe,
      viewModel.getSnapshot,
      viewModel.getSnapshot,
    );

  useEffect(() => {
    if (gameId) {
      viewModel.loadGame(parseInt(gameId));
    }
  }, [gameId, viewModel, location.pathname, location.search]);

  // Check Bunq integration status for admin users
  useEffect(() => {
    if (gameData.game) {
      const isGameAdmin = user.isAdmin || (gameData.game.isAssignedAdmin ?? false);
      viewModel.checkBunqIntegration(isGameAdmin);
    }
  }, [user.isAdmin, gameData.game?.isAssignedAdmin, gameData.game, viewModel]);



  if (gameData.isLoading) {
    return <LoadingSpinner />;
  }

  if (gameData.error || !gameData.game) {
    return (
      <div className="game-details-container">
        <Placeholder
          header={<Title Component="h2">Error</Title>}
          description={gameData.error || "Game not found"}
          action={
            <Button onClick={() => navigate("/")} className="back-button">
              Back to Games
            </Button>
          }
        />
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
  const canOpenPlayerInfo = isGameAdmin || user.isTc;
  const playerInfoViewer = user.isAdmin ? 'globalAdmin' : user.isTc ? 'tc' : 'assignedGameAdmin';
  const showAddParticipantButton =
    isGameAdmin && !hasPaymentRequests && (isPastGame || gameData.game.readonly);

  // Get the current main button properties
  const {
    show: showMainButton,
    text: mainButtonText,
    onClick: mainButtonClick,
  } = viewModel.getMainButtonProps();

  const isHalloween = gameData.game.tag === 'halloween';
  const isNewYear = gameData.game.tag === 'newyear';
  const isMarch8 = gameData.game.tag === 'march8';

  return (
    <div className={`game-details-container ${isHalloween ? 'halloween-theme' : ''} ${isNewYear ? 'newyear-theme' : ''} ${isMarch8 ? 'march8-theme' : ''}`}>
      {isHalloween && (
        <HalloweenDecorations variant="page" showFallingLeaves={true} />
      )}
      {isNewYear && (
        <NewYearPageDecorations />
      )}
      {isMarch8 && (
        <March8PageDecorations />
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
          <CategoryInfoBlock
            category={viewModel.gameCategory}
            unregisterDeadlineHours={gameData.game.unregisterDeadlineHours}
          />
        </div>
      )}

      {(gameData.game.myOffers?.length ?? 0) > 0 && (
        <div className="spot-offer-banner my-offers">
          {gameData.game.myOffers!.map((offer) => (
            <div key={offer.id} className="spot-offer-row">
              <span>
                {offer.guestName
                  ? `You're offering guest "${offer.guestName}"'s spot…`
                  : "You're offering your spot…"}
              </span>
              <button
                type="button"
                className="spot-offer-cancel"
                disabled={action.isActionLoading}
                onClick={() => viewModel.handleCancelSpotOffer(offer.guestName)}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {(gameData.game.activeSpotOffers ?? [])
        .filter(
          (offer) =>
            !gameData.game!.readonly &&
            !isGamePast(gameData.game!.dateTime) &&
            offer.offererUserId !== user.id,
        )
        .map((offer) => {
          const label = offer.guestName
            ? `${offer.offererDisplayName || 'Someone'}'s guest "${offer.guestName}"`
            : offer.offererDisplayName || 'Someone';
          const canAccept = viewModel.canAcceptOffer(offer);
          return (
            <div key={`accept-${offer.id}`} className="spot-offer-banner accept">
              <span>{label} is offering a spot for the game</span>
              {canAccept && (
                <button
                  type="button"
                  className="spot-offer-accept"
                  disabled={action.isActionLoading}
                  onClick={() => viewModel.handleAcceptSpotOffer(offer.id)}
                >
                  Accept
                </button>
              )}
            </div>
          );
        })}

      {isHalloween && (
        <Banner className="halloween-note" type="section" description="🎃 Halloween Special! Get ready for a spooky volleyball evening! 👻🦇" />
      )}

      {isNewYear && (
        <Banner className="newyear-note" type="section" description="❄️ New Year Special! Get ready for a festive volleyball evening! 🎄☃️" />
      )}

      {isMarch8 && (
        <Banner className="march8-note" type="section" description="🌸 March 8 Special! Spring, flowers & beauty — get ready for a lovely volleyball evening! 💐🌷" />
      )}

      {gameData.game.readonly && (
        <Banner
          className="readonly-note"
          type="section"
          description="🔒 This game is readonly. Registration and deregistration are closed. Please contact the game organizers if you have any questions."
        />
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
                  <Button
                    size="s"
                    mode="bezeled"
                    className="add-guest-button"
                    onClick={() => viewModel.handleGuestRegister()}
                    disabled={action.isActionLoading || dialogs.isGuestRegistering}
                  >
                    {dialogs.isGuestRegistering ? "Registering..." : "Add guest"}
                  </Button>
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
              canTapPlayerInfo={canOpenPlayerInfo}
              onShowUserInfo={canOpenPlayerInfo ? (u) => viewModel.handleShowPlayerInfo(u) : undefined}
              canOfferGuestSpot={(guestName) => viewModel.canOfferSpot(guestName)}
              onOfferGuestSpot={(guestName) => {
                void viewModel.handleOfferSpot(guestName);
              }}
            />
          </div>
        ) : null}

        {!isPastGame && waitlistRegistrations.length > 0 && (
          <div className="players-section waitlist-section">
            <h2>Waiting List</h2>
            <WaitlistList
              registrations={waitlistRegistrations}
              currentUserId={user.id}
              canTapPlayerInfo={canOpenPlayerInfo}
              onShowUserInfo={canOpenPlayerInfo ? (u) => viewModel.handleShowPlayerInfo(u) : undefined}
              onRemovePlayer={(userId, guestName) => viewModel.handleRemovePlayerFromWaitingList(userId, guestName)}
            />
          </div>
        )}

        {activeRegistrations.length === 0 &&
          waitlistRegistrations.length === 0 && (
            <Placeholder
              className="no-players"
              header={<Title Component="h2">No players registered yet</Title>}
              description="Be the first to join this game!"
            />
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
            <Button
              size="l"
              stretched
              className="tg-main-button"
              onClick={mainButtonClick}
              disabled={action.isActionLoading}
            >
              {action.isActionLoading ? "Processing..." : (mainButtonText || "Action")}
            </Button>
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

      {/* Player Info Dialog (game admin, global admin, or TC) */}
      <PlayerInfoDialog
        isOpen={dialogs.showPlayerInfo}
        onClose={() => viewModel.handleClosePlayerInfo()}
        user={dialogs.selectedUser}
        viewer={playerInfoViewer}
        loadLevelProfile={user.isAdmin || user.isTc}
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
