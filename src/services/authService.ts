// src/services/authService.ts
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

// Re-export the Supabase User type so components importing it don't break
export type { User };

// --- 1. GOOGLE LOGIN (Supabase) ---
export const loginWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Redirects back to your PWA
      }
    });

    if (error) throw error;
    // Note: OAuth redirects the page, so user data is handled by the auth state observer on reload
    return data;
  } catch (error: any) {
    console.error("Google Login Error:", error);
    throw new Error(error.message);
  }
};

// --- 2. EMAIL LOGIN (Supabase) ---
export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pass,
    });

    if (error) throw error;
    return data.user;
  } catch (error: any) {
    console.error("Email Login Error:", error);
    throw new Error(error.message);
  }
};

// --- 3. EMAIL REGISTRATION (Supabase) ---
export const registerWithEmail = async (email: string, pass: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: pass,
    });

    if (error) throw error;
    return data.user;
  } catch (error: any) {
    console.error("Registration Error:", error);
    throw new Error(error.message);
  }
};

// --- 4. GUEST LOGIN (Supabase) ---
export const loginAnonymously = async () => {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) throw error;
    return data.user;
  } catch (error: any) {
    console.error("Anonymous Login Error:", error);
    throw new Error(error.message);
  }
};

// --- 5. LOGOUT (Supabase) ---
export const logoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

// --- 6. AUTH STATE OBSERVER (Supabase) ---
export const subscribeToAuth = (callback: (user: User | null) => void) => {
  // 1. Initial fetch for PWA offline support/quick load
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(session?.user ?? null);
  });

  // 2. Listen for real-time auth events
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  // Return unsubscribe function to match Firebase's pattern
  return () => {
    subscription.unsubscribe();
  };
};

// --- 7. EXPORT AUTH OBJECT ---
// Exporting supabase.auth as 'auth' to prevent import errors in files that used the Firebase 'auth' object
export const auth = supabase.auth;