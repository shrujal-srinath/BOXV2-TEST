// src/services/handheldService.ts
// Legacy handheld service stubbed out.
// Hardware pairing is now handled via useHardwareSignaling.ts + Supabase broadcast channels.

export const HW_SESSION_KEY = 'hw_session';
export type ControlMode = 'web' | 'esp32' | 'shared';

export const hwPath = (_gameCode: string) => `hw-${_gameCode}`;
export const setControlMode = (_mode: ControlMode) => { };
export const activateGameOnDevice = async (_gameCode: string, _hostId: string) => null;
export const requestHandheldPairing = async (_gameCode: string) => null;
export const listenToHandheldStatus = (_gameCode: string, _cb: unknown) => () => { };

// ConnectControllerModal stubs
export const pairHandheldDevice = async (
    _code: string,
    _userId: string,
    _onPhase?: (phase: string) => void
): Promise<{ success: boolean; message: string }> => {
    return { success: false, message: 'Hardware pairing not yet implemented in V2.' };
};

export const unpairHandheldDevice = async (_code: string, _userId: string) => { };

export const subscribeToDeviceHeartbeat = (
    _code: string,
    _cb: (online: boolean, ts: number) => void
) => () => { };