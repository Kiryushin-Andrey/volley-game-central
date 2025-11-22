import { memo, useState, useEffect } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { renderFormattedText } from '../utils/textFormatting';
import './CategoryInfoBlock.scss';

type GameCategory = 'thursday-5-1' | 'thursday-deti-plova' | 'sunday' | 'other';

interface CategoryInfoBlockProps {
  category: string;
}

const getCategoryDescription = (cat: GameCategory): string => {
  const registrationRules = `

The participant list is frozen 5 hours before the game. Until that time, you can deregister without penalties. After that, deregistration is no longer possible.

If you cannot come - let the people from the waitlist now, either in DM or in the group chat. You'll still get the payment request, but you can forward it to your replacement. Or simply give away your slot.
After the game, the bot will send tickets to all participants from the main list, which need to be paid within 24 hours. If you silently skip games or don't pay for attendance - after a couple of warnings, a ban will follow.

We recommend joining one of our community chats:
Telegram Group (mostly Russian-speaking): https://t.me/+nZxG6L8bbcxhMTg0
WhatsApp Group (less active, but English-speaking): https://chat.whatsapp.com/DE3sBMgi55tCEkyeUnA6be`;
  
  const categoryDescriptions: Record<GameCategory, string> = {
    'thursday-5-1': 
      'Thursday 5-1 games are advanced level games played with 5-1 positions. All participants are expected to have solid basic volleyball skills and be familiar in practice with the 5-1 scheme. The level of the games can be roughly estimated as 2-4 class of Nevobo competitions, although we have regular players both higher and lower than that, as well as players that do not take part in Nevobo competitions at all. In general, if you play in Nevobo competitions at any level for at least half a year, practicing positions there, you are welcome to join Thursday 5-1 games. If you aren\'t playing in Nevobo competitions but you\'d like to join 5-1 games, get in touch with the experienced members of this group, they will be glad to get to know you and evaluate your volleyball skills.' + 
      registrationRules,
    
    'thursday-deti-plova': 
      'The second hall on Thursdays is used 2 times per month. The first and third Thursday of the month. First and foremost, we use it for training (with a coach), and if there\'s time left, we play 1-2 games to practice the material we learned during training. Priority registration is given to the Deti Plova team (registration opens 10 days before the game). Open registration for everyone else for the remaining spots opens 3 days before the game.' + 
      registrationRules,
    
    'sunday': 
      'Sunday games are social and chill-out, no particular level enforced. The players are supposed to split into more or less equal teams on the spot and then shuffle if needed. By default we have 14 spots available, all the others go to the waitlist. If the total number of registered players reaches 22, we book a second field and the game is extended to 28 players. The second field is usually booked manually on Friday or Saturday, given that there are at least 22 players on the list.' + 
      registrationRules,
    
    'other': 
      'Other: Games that don\'t fit into the standard categories' + 
      registrationRules
  };
  
  return categoryDescriptions[cat];
};

const CategoryInfoBlock = memo(({ category }: CategoryInfoBlockProps) => {
  const [showDialog, setShowDialog] = useState(false);
  
  useEffect(() => {
    if (!showDialog) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDialog(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showDialog]);
  
  const categoryInfo: Record<string, { header: string; short: string; withPositions: boolean }> = {
    'thursday-5-1': {
      header: 'Thursday 5-1',
      short: 'Competitive games with assigned positions (5-1 system)',
      withPositions: true
    },
    'thursday-deti-plova': {
      header: 'Thursday Deti Plova',
      short: 'Recreational games without assigned positions',
      withPositions: false
    },
    'sunday': {
      header: 'Sunday',
      short: 'Recreational games without assigned positions',
      withPositions: false
    }
  };
  
  const info = categoryInfo[category];
  if (!info) return null;
  
  const fullDescription = getCategoryDescription(category as GameCategory);
  const blockClassName = `category-info-block ${info.withPositions ? 'with-positions' : 'without-positions'}`;
  
  return (
    <>
      <div className={blockClassName}>
        <span className="category-info-text">{info.header}: {info.short}</span>
        <FaInfoCircle 
          className="category-info-icon" 
          onClick={() => setShowDialog(true)}
        />
      </div>
      {showDialog && (
        <div className="category-info-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="category-info-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="category-info-dialog-header">
              <h3>{info.header}</h3>
              <button className="close-button" onClick={() => setShowDialog(false)}>×</button>
            </div>
            <div className="category-info-dialog-content">
              {renderFormattedText(fullDescription)}
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default CategoryInfoBlock;