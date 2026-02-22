export const HW_SESSION_KEY = 'BOX_HW_SESSION';
export type ControlMode = 'web' | 'hardware' | 'shared';
export const hwPath = { root: (_c: string) => '', controlMode: (_c: string) => '' };
export const pairHandheldDevice = async (_code: string, _userId: string, onPhase: any) => {
    onPhase('error');
    return { success: false, message: 'Hardware bridge currently offline for V2 transition' };
};
export const unpairHandheldDevice = async (_code: string, _userId: string) => { };
export const subscribeToDeviceHeartbeat = (_code: string, _cb: any) => () => { };
export const requestHandheldPairing = async () => null;
export const listenToHandheldStatus = () => () => { };