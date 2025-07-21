import React, { useState, useEffect, useRef } from 'react';
import { gamesApi } from '../services/api';
import { logDebug } from '../debug';
import { FaTimes } from 'react-icons/fa';

interface UserSearchInputProps {
  onSelectUser: (userId: number) => void;
  onCancel: () => void;
  disabled?: boolean;
  placeholder?: string;
}

interface UserOption {
  id: number;
  username: string;
  telegramId: string | null;
  avatarUrl?: string | null;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  onSelectUser,
  onCancel,
  disabled = false,
  placeholder = 'Search users...',
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setUsers([]);
        setShowDropdown(false);
        return;
      }

      try {
        setIsLoading(true);
        const results = await gamesApi.searchUsers(query);
        setUsers(results);
        setShowDropdown(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        logDebug('Error searching users');
        logDebug(error);
        setUsers([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectUser = (user: UserOption) => {
    setQuery('');
    setShowDropdown(false);
    onSelectUser(user.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      onCancel();
      return;
    }

    if (users.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < users.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectUser(users[selectedIndex]);
    }
  };

  return (
    <div className="user-search-container" ref={dropdownRef}>
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="search-input"
          autoFocus
        />
        <button 
          className="cancel-button" 
          onClick={onCancel}
          type="button"
          disabled={disabled}
          aria-label="Cancel search"
        >
          <FaTimes />
        </button>
      </div>
      
      {showDropdown && (
        <div className="user-search-dropdown">
          {isLoading ? (
            <div className="dropdown-loading">Loading...</div>
          ) : users.length > 0 ? (
            <ul className="user-search-results">
              {users.map((user, index) => (
                <li
                  key={user.id}
                  className={`user-search-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="player-info">
                    <div className="player-avatar">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={`${user.username}'s avatar`}
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    </div>
                    <div className="player-name">
                      {user.username}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 ? (
            <div className="no-results">No users found</div>
          ) : null}
        </div>
      )}
    </div>
  );
};
