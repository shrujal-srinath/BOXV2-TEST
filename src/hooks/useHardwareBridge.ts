// src/hooks/useHardwareBridge.ts
// Legacy bridge hollowed out.
// Hardware signaling is now handled by useHardwareSignaling.ts

export function useHardwareBridge() {
    return {
        isConnected: false,
        transport: null as null | string,
        controlMode: 'web' as const,
        setAuthority: (_mode: string) => { },
        pushGameState: (_state: unknown) => { },
        remoteState: null as null,
    };
}