import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { getGame } from '../services/gameService';

interface ProtectedHostRouteProps {
    children: React.ReactElement;
}

const ProtectedHostRoute: React.FC<ProtectedHostRouteProps> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);

    // Check if we are on a route that requires game ownership (e.g., /host/:gameCode)
    const { gameCode } = useParams<{ gameCode: string }>();

    useEffect(() => {
        const unsubscribe = subscribeToAuth(async (currentUser) => {
            setUser(currentUser);

            if (currentUser && gameCode) {
                // We are trying to access a specific game, so verify ownership
                const game = await getGame(gameCode);
                // Check if current user is the host
                if (game && game.hostId === currentUser.uid) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                }
            } else {
                // We are on a general protected page (Dashboard, Setup, etc.)
                // No specific game ownership needed, just authentication.
                setIsOwner(true);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [gameCode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-pulse text-zinc-500 font-mono text-sm">VERIFYING IDENTITY...</div>
            </div>
        );
    }

    // 1. Must be logged in (Anon or Pro)
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // 2. If a gameCode is present, must be the owner
    // (If no gameCode, isOwner defaults to true in the effect above)
    if (gameCode && !isOwner) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <h1 className="text-red-500 font-bold text-2xl">ACCESS DENIED</h1>
                <p className="text-zinc-500 mt-2">You do not have permission to host this game.</p>
                <div className="mt-8 flex gap-4">
                    <button onClick={() => window.location.href = '/dashboard'} className="px-4 py-2 bg-zinc-800 rounded text-xs font-bold uppercase tracking-widest hover:bg-zinc-700">Dashboard</button>
                    <button onClick={() => window.location.href = '/'} className="px-4 py-2 border border-zinc-700 rounded text-xs font-bold uppercase tracking-widest hover:text-white text-zinc-400">Home</button>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedHostRoute;