import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api.js';

const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [businessProfile, setBusinessProfile] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [profileRes, statusRes] = await Promise.all([
        api.get('/settings/business-profile'),
        api.get('/onboarding/status'),
      ]);
      setBusinessProfile(profileRes.data);
      setOnboardingCompleted(statusRes.data.completed);
    } catch (err) {
      // Ignore errors when not authenticated
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('pa_token');
    if (token) refresh();
    else setLoading(false);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ businessProfile, onboardingCompleted, loading, refresh }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
