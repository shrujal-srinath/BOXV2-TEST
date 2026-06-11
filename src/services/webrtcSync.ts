// src/services/webrtcSync.ts
// ═══════════════════════════════════════════════════════════════════════════
// WEBRTC PEER-TO-PEER DATA SYNC
// Bypasses cloud servers to send clock data directly over local WiFi/LAN
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// ─── HOST MANAGER (1-to-Many) ────────────────────────────────────────────────
export class HostWebRTCManager {
    private gameCode: string;
    private channel: any;
    // `dc`   — lossy/low-latency channel for high-frequency clock ticks (a dropped
    //          tick self-heals on the next one).
    // `snap` — reliable, ordered channel for full game snapshots, where a dropped
    //          packet must NOT strand a stale score on the receiver.
    private peers: Map<string, { pc: RTCPeerConnection, dc: RTCDataChannel, snap: RTCDataChannel }> = new Map();

    constructor(gameCode: string) {
        this.gameCode = gameCode;
        this.initSignaling();
    }

    private initSignaling() {
        this.channel = supabase.channel(`webrtc-${this.gameCode}`);

        this.channel.on('broadcast', { event: 'signaling' }, async ({ payload }: any) => {
            if (payload.target !== 'host') return;

            if (payload.type === 'join') {
                await this.createPeer(payload.clientId);
            } else if (payload.type === 'answer' && this.peers.has(payload.clientId)) {
                await this.peers.get(payload.clientId)!.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } else if (payload.type === 'ice' && this.peers.has(payload.clientId)) {
                await this.peers.get(payload.clientId)!.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        }).subscribe();
    }

    private async createPeer(clientId: string) {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        const dc = pc.createDataChannel('game-sync', { ordered: true, maxRetransmits: 0 }); // UDP-like speed
        const snap = pc.createDataChannel('game-snapshot', { ordered: true }); // reliable, for full snapshots

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.channel.send({ type: 'broadcast', event: 'signaling', payload: { type: 'ice', target: clientId, candidate: e.candidate } });
            }
        };

        this.peers.set(clientId, { pc, dc, snap });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.channel.send({
            type: 'broadcast', event: 'signaling',
            payload: { type: 'offer', target: clientId, sdp: offer }
        });
    }

    public broadcast(data: string) {
        this.peers.forEach(peer => {
            if (peer.dc.readyState === 'open') {
                peer.dc.send(data);
            }
        });
    }

    /** Send full game snapshots over the reliable, ordered channel. */
    public broadcastReliable(data: string) {
        this.peers.forEach(peer => {
            if (peer.snap.readyState === 'open') {
                peer.snap.send(data);
            }
        });
    }

    /** Number of peers with at least one open data channel — drives "X connected" UI. */
    public get connectedCount(): number {
        let n = 0;
        this.peers.forEach(peer => {
            if (peer.dc.readyState === 'open' || peer.snap.readyState === 'open') n++;
        });
        return n;
    }

    public cleanup() {
        this.peers.forEach(peer => peer.pc.close());
        this.peers.clear();
        if (this.channel) supabase.removeChannel(this.channel);
    }
}

// ─── SPECTATOR MANAGER (1-to-1) ──────────────────────────────────────────────
export class SpectatorWebRTCManager {
    private gameCode: string;
    private clientId: string;
    private channel: any;
    private pc: RTCPeerConnection | null = null;
    private onMessage: (msg: string) => void;

    constructor(gameCode: string, onMessage: (msg: string) => void) {
        this.gameCode = gameCode;
        this.onMessage = onMessage;
        this.clientId = Math.random().toString(36).substring(7);
        this.initSignaling();
    }

    private initSignaling() {
        this.channel = supabase.channel(`webrtc-${this.gameCode}`);

        this.channel.on('broadcast', { event: 'signaling' }, async ({ payload }: any) => {
            if (payload.target !== this.clientId) return;

            if (payload.type === 'offer') {
                await this.handleOffer(payload.sdp);
            } else if (payload.type === 'ice' && this.pc) {
                await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        }).subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
                // Announce presence to host
                this.channel.send({ type: 'broadcast', event: 'signaling', payload: { type: 'join', target: 'host', clientId: this.clientId } });
            }
        });
    }

    private async handleOffer(sdp: any) {
        this.pc = new RTCPeerConnection(ICE_SERVERS);

        this.pc.ondatachannel = (e) => {
            e.channel.onmessage = (msg) => this.onMessage(msg.data);
        };

        this.pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.channel.send({ type: 'broadcast', event: 'signaling', payload: { type: 'ice', target: 'host', clientId: this.clientId, candidate: e.candidate } });
            }
        };

        await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        this.channel.send({
            type: 'broadcast', event: 'signaling',
            payload: { type: 'answer', target: 'host', clientId: this.clientId, sdp: answer }
        });
    }

    public cleanup() {
        if (this.pc) this.pc.close();
        if (this.channel) supabase.removeChannel(this.channel);
    }
}