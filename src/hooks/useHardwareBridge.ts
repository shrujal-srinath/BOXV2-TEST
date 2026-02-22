export const useHardwareBridge = () => {
    return {
        isConnected: false,
        transport: 'none' as const,
        remoteState: null,
        controlMode: 'web' as const,
        pushGameState: () => { },
        setAuthority: async () => { }
    };
};