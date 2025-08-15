import React, { useState, useEffect, useRef } from 'react';
import { gamesApi } from '../services/api';
import { logDebug } from '../debug';
import { FaTimes } from 'react-icons/fa';
import './UserSearchInput.scss';

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
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
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
    setSelectedUser(user);
    setQuery('');
    setShowDropdown(false);
    onSelectUser(user.id);
  };

  const clearSelection = () => {
    setSelectedUser(null);
    setQuery('');
    setUsers([]);
    setShowDropdown(false);
    onCancel();
    // focus back to input on next paint
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedUser) {
        clearSelection();
      } else {
        setShowDropdown(false);
        onCancel();
      }
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
        {selectedUser ? (
          <div className="selected-user-chip">
            <div className="chip-avatar">
              {selectedUser.avatarUrl ? (
                <img src={selectedUser.avatarUrl} alt={`${selectedUser.username}'s avatar`} />
              ) : (
                <span>{selectedUser.username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="chip-name" title={selectedUser.username}>{selectedUser.username}</div>
            <button
              className="chip-remove"
              onClick={clearSelection}
              type="button"
              disabled={disabled}
              aria-label="Clear selection"
            >
              <FaTimes />
            </button>
          </div>
        ) : (
          <>
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
            {isLoading ? (
              <div className="input-spinner" aria-label="Loading" />
            ) : (
              <button 
                className="cancel-button" 
                onClick={onCancel}
                type="button"
                disabled={disabled}
                aria-label="Cancel search"
              >
                <FaTimes />
              </button>
            )}
          </>
        )}
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
