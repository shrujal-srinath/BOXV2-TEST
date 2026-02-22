// src/services/handheldService.ts
// Legacy handheld service hollowed out.
// Hardware pairing is now handled via useHardwareSignaling.ts + Supabase broadcast channels.

export const HW_SESSION_KEY = 'hw_session';
export type ControlMode = 'web' | 'esp32' | 'shared';

export const hwPath = (_gameCode: string) => `hw-${_gameCode}`;
export const setControlMode = (_mode: ControlMode) => { };
export const activateGameOnDevice = async (_gameCode: string, _hostId: string) => null;
export const requestHandheldPairing = async (_gameCode: string) => null;
export const listenToHandheldStatus = (_gameCode: string, _cb: unknown) => () => { };