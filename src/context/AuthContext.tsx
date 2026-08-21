import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { store } from '../lib/db';
import { clearSensitiveStorage } from '../lib/storageSecurity';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (usernameOrEmail: string, passwordAttempt: string) => boolean;
  loginWithUserId: (userOrId: User | string, token?: string) => boolean;
  logout: () => void;
  switchUser: (userId: string, token?: string) => void;
  updateUser: (updated: User) => void;
  refreshUserData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.getCurrentUser());

  useEffect(() => {
    // If authenticated user session exists, ensure MongoDB sync is triggered on mount
    if (currentUser) {
      store.fetchAuthenticatedData().catch(() => {});
    } else {
      const activeUser = store.getCurrentUser();
      if (activeUser) {
        setCurrentUser({ ...activeUser });
        store.fetchAuthenticatedData().catch(() => {});
      } else {
        store.clearStorageOnUnauthenticated();
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleUsersUpdated = () => {
      const activeUser = store.getCurrentUser();
      if (activeUser) {
        setCurrentUser({ ...activeUser });
      }
    };

    window.addEventListener('bcc_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('bcc_users_updated', handleUsersUpdated);
  }, []);

  const refreshUserData = () => {
    const user = store.getCurrentUser();
    setCurrentUser(user ? { ...user } : null);
  };

  const login = (usernameOrEmail: string, passwordAttempt: string): boolean => {
    const user = store.login(usernameOrEmail, passwordAttempt);
    if (user) {
      setCurrentUser({ ...user });
      store.fetchAuthenticatedData().catch(() => {});
      return true;
    }
    return false;
  };

  const loginWithUserId = (userOrId: User | string, token?: string): boolean => {
    const user = store.loginWithUserId(userOrId, token);
    if (user) {
      setCurrentUser({ ...user });
      store.fetchAuthenticatedData().catch(() => {});
      return true;
    }
    return false;
  };

  const logout = () => {
    store.logout();
    clearSensitiveStorage();
    setCurrentUser(null);
  };

  const switchUser = (userId: string, token?: string) => {
    const user = store.setCurrentUser(userId, token);
    if (user) setCurrentUser({ ...user });
  };

  const updateUser = (updated: User) => {
    const saved = store.updateUser(updated);
    if (currentUser && currentUser.id === saved.id) {
      setCurrentUser({ ...saved });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.role === 'admin',
        login,
        loginWithUserId,
        logout,
        switchUser,
        updateUser,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

