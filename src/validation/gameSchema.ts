import { z } from 'zod';
import type { BasketballGame } from '../types';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const PlayerSchema = z.object({
    id: z.string(),
    name: z.string(),
    number: z.string(),
    position: z.string(),
    points: z.number().min(0),
    fouls: z.number().min(0).max(6),
    assists: z.number().min(0),
    rebounds: z.number().min(0),
    steals: z.number().min(0),
    blocks: z.number().min(0),
    turnovers: z.number().min(0),
    disqualified: z.boolean(),
    fieldGoalsMade: z.number().min(0),
    fieldGoalsAttempted: z.number().min(0),
    threePointsMade: z.number().min(0),
    threePointsAttempted: z.number().min(0),
    freeThrowsMade: z.number().min(0),
    freeThrowsAttempted: z.number().min(0),
});

const TeamDataSchema = z.object({
    name: z.string().min(1, "Team name required"),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color hex"),
    score: z.number().min(0),
    timeouts: z.number().min(0).max(5),
    timeoutsFirstHalf: z.number().min(0).max(3),
    timeoutsSecondHalf: z.number().min(0).max(3),
    fouls: z.number().min(0),
    foulsThisQuarter: z.number().min(0),
    players: z.array(PlayerSchema).min(0),
});

const GameSettingsSchema = z.object({
    gameName: z.string().min(1),
    periodDuration: z.number().min(1).max(30),
    shotClockDuration: z.number().min(0).max(45),
    periodType: z.enum(['quarter', 'half']),
    gameMode: z.enum(['quick', 'stats', 'advanced']).optional(),
    periods: z.number().optional(),
    courtNumber: z.string().optional(),
    tournamentId: z.string().optional(),
    fixtureId: z.string().optional(),
});

const GameStateSchema = z.object({
    period: z.number().min(1).max(8),
    gameTime: z.object({
        minutes: z.number().min(0).max(60),
        seconds: z.number().min(0).max(59),
        tenths: z.number().min(0).max(9),
    }),
    shotClock: z.number().min(0).max(45),
    gameRunning: z.boolean(),
    shotClockRunning: z.boolean(),
    possession: z.enum(['A', 'B']).optional(),
});

// ─── THE CANONICAL SCHEMA ────────────────────────────────────────────────────

export const BasketballGameSchema = z.object({
    code: z.string().length(4).regex(/^[A-Z0-9]{4}$/, "Invalid game code format"),
    hostId: z.string().uuid("Invalid host ID"),
    sportId: z.string().min(1, "sportId is required"),
    sport: z.string().optional(), // @deprecated but allowed for backward compat
    status: z.enum(['live', 'completed', 'archived']),
    gameType: z.enum(['local', 'online']),
    createdAt: z.number().positive(),
    lastUpdate: z.number().positive(),
    settings: GameSettingsSchema,
    gameState: GameStateSchema,
    teamA: TeamDataSchema,
    teamB: TeamDataSchema,
}).strict(); // Reject unknown fields

// ─── Validator Functions ─────────────────────────────────────────────────────

export type ValidationResult<T> = {
    success: boolean;
    data?: T;
    errors?: string[];
};

export function validateBasketballGame(data: unknown): ValidationResult<BasketballGame> {
    const result = BasketballGameSchema.safeParse(data);

    if (result.success) {
        // Normalize legacy fields
        const normalized = { ...result.data };
        normalized.sportId = normalized.sportId || normalized.sport || 'basketball';
        normalized.sport = normalized.sportId; // Keep in sync

        return { success: true, data: normalized as BasketballGame };
    }

    const issues = result.error.issues;
    return {
        success: false,
        errors: issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    };
}

// ─── Generic Game Schema (for future multi-sport support) ───────────────────

export const BaseGameSchema = z.object({
    code: z.string().min(4).max(10),
    hostId: z.string().uuid(),
    sportId: z.string(),
    status: z.enum(['live', 'completed', 'archived']),
    createdAt: z.number().positive(),
    lastUpdate: z.number().positive(),
    rules: z.record(z.string(), z.unknown()), // Sport-specific rules
    state: z.record(z.string(), z.unknown()), // Sport-specific state
    teamA: z.object({
        name: z.string(),
        color: z.string(),
        score: z.number(),
    }),
    teamB: z.object({
        name: z.string(),
        color: z.string(),
        score: z.number(),
    }),
}).passthrough();

export function validateGenericGame(data: unknown): ValidationResult<z.infer<typeof BaseGameSchema>> {
    const result = BaseGameSchema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const issues = result.error.issues;
    return {
        success: false,
        errors: issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
    };
}
