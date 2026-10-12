import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Section, Title } from '@telegram-apps/telegram-ui';
import { CellLink } from '../components/ui/RouterButton';
import { BackButton } from '@twa-dev/sdk/react';
import { useAuthenticatedUser } from '../hooks/useAuthenticatedUser';
import { isGlobalAdmin, isTcOnly } from '../utils/userRoles';
import { isTelegramApp } from '../utils/telegram';
import './PlayersHub.scss';

const PlayersHub: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const inTelegram = isTelegramApp();

  useEffect(() => {
    if (user && !isGlobalAdmin(user)) {
      navigate(isTcOnly(user) ? '/player-levels' : '/');
    }
  }, [user, navigate]);

  if (user && !isGlobalAdmin(user)) {
    return null;
  }

  return (
    <div className="players-hub">
      {inTelegram && <BackButton onClick={() => navigate(-1)} />}
      <List>
        <Section header={<Title Component="h1" weight="1">Players</Title>}>
          <CellLink to="/game-administrators">
            Game administrators
          </CellLink>
          <CellLink to="/player-levels">
            Player levels
          </CellLink>
        </Section>
      </List>
    </div>
  );
};

export default PlayersHub;
