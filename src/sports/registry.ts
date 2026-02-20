// src/sports/registry.ts
import { basketballManifest } from './manifest';
import { SportManifest } from '../../core/types/Manifest';

// We cast it to `any` here strictly for the Dictionary mapping, 
// because different sports have different Action/State types.
// The `useGameEngine` hook safely infers the types back out.
export const SPORT_REGISTRY: Record<string, SportManifest<any, any, any>> = {
    basketball: basketballManifest,
    // badminton: badmintonManifest, // (Coming soon!)
};

// Strongly typed list of supported sport IDs
export type SupportedSport = keyof typeof SPORT_REGISTRY;

export const isSportSupported = (sportId: string): sportId is SupportedSport => {
    return sportId in SPORT_REGISTRY;
};