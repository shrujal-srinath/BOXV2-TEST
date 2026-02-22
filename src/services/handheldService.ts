export const HW_SESSION_KEY = 'BOX_HW_SESSION';
export type ControlMode = 'web' | 'hardware' | 'shared';
export const hwPath = { root: (_c: string) => '', controlMode: (_c: string) => '' };

export const pairHandheldDevice = async (_code: string, _userId: string, onPhase: any) => {
    onPhase('error');
    return { success: false, message: 'Hardware bridge currently offline' };
};
export const unpairHandheldDevice = async (_code: string, _userId: string) => { };
export const subscribeToDeviceHeartbeat = (_code: string, _cb: any) => () => { };
export const requestHandheldPairing = async () => null;
export const listenToHandheldStatus = () => () => { };

// Variadic stubs — accept any number of args so callers with extra params compile cleanly
export const setControlMode = async (..._args: any[]) => { };
export const subscribeToControlMode = (_code: string, _cb: any) => () => { };
export const activateGameOnDevice = async (..._args: any[]) => { };