// src/services/castControlService.ts
// ═══════════════════════════════════════════════════════════════
// Phone ↔ Kiosk control channel (Supabase Broadcast)
//
// Channel: cast-control:{tvCode}   (distinct from cast-signal:{tvCode})
// Direction: phone → kiosk only (one-way broadcast)
// Persistence: none — ephemeral broadcast, no DB writes
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import type { GameConfig } from '../hooks/useRefereeBox';

// ── Event payloads ─────────────────────────────────────────────

export interface PhoneConnectedEvent {
    event: 'phone-connected';
    phoneId: string;
    timestamp: number;
}

export interface ConfigUpdateEvent {
    event: 'config-update';
    config: Partial<GameConfig>;
    step: number;
    timestamp: number;
}

export interface SetupStartEvent {
    event: 'setup-start';
    config: GameConfig;
    timestamp: number;
}

export interface WatchGameEvent {
    event: 'watch-game';
    gameCode: string;
    timestamp: number;
}

export interface PhoneDisconnectedEvent {
    event: 'phone-disconnected';
    phoneId: string;
    timestamp: number;
}

export type PhoneControlEvent =
    | PhoneConnectedEvent
    | ConfigUpdateEvent
    | SetupStartEvent
    | WatchGameEvent
    | PhoneDisconnectedEvent;

// ── Phone side ─────────────────────────────────────────────────

export interface PhoneControlChannel {
    sendEvent: (event: PhoneControlEvent) => void;
    disconnect: () => void;
}

export function openPhoneControlChannel(tvCode: string): PhoneControlChannel {
    const upper = tvCode.toUpperCase();
    let subscribed = false;
    const queue: PhoneControlEvent[] = [];

    const channel = supabase
        .channel(`cast-control:${upper}`)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                subscribed = true;
                queue.forEach(evt =>
                    channel.send({ type: 'broadcast', event: evt.event, payload: evt })
                        .catch(e => console.warn('[CastControl] queued send failed:', e))
                );
                queue.length = 0;
            }
        });

    const sendEvent = (evt: PhoneControlEvent) => {
        if (subscribed) {
            channel.send({ type: 'broadcast', event: evt.event, payload: evt })
                .catch(e => console.warn('[CastControl] send failed:', e));
        } else {
            queue.push(evt);
        }
    };

    const disconnect = () => supabase.removeChannel(channel);

    return { sendEvent, disconnect };
}

// ── Kiosk side ─────────────────────────────────────────────────

export function subscribePhoneControl(
    tvCode: string,
    onEvent: (event: PhoneControlEvent) => void
): () => void {
    const upper = tvCode.toUpperCase();

    const channel = supabase
        .channel(`cast-control:${upper}`)
        .on('broadcast', { event: 'phone-connected' },    ({ payload }) => onEvent(payload as PhoneConnectedEvent))
        .on('broadcast', { event: 'config-update' },      ({ payload }) => onEvent(payload as ConfigUpdateEvent))
        .on('broadcast', { event: 'setup-start' },        ({ payload }) => onEvent(payload as SetupStartEvent))
        .on('broadcast', { event: 'watch-game' },         ({ payload }) => onEvent(payload as WatchGameEvent))
        .on('broadcast', { event: 'phone-disconnected' }, ({ payload }) => onEvent(payload as PhoneDisconnectedEvent))
        .subscribe();

    return () => supabase.removeChannel(channel);
}
