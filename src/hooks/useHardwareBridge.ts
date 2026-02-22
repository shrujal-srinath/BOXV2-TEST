export const useHardwareBridge = () => {
    return {
        isConnected: false,
        transport: 'none' as 'none' | 'websocket' | 'rtdb',
        remoteState: null,
        controlMode: 'web' as 'web' | 'hardware' | 'shared',
        pushGameState: (..._args: any[]) => { },
        setAuthority: async (..._args: any[]) => { }
    };
};