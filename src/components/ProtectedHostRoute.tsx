import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { getGame } from '../services/gameService'; // Ensure this service fetches from Firestore

interface ProtectedHostRouteProps {
    children: React.ReactElement;
}

const ProtectedHostRoute: React.FC<ProtectedHostRouteProps> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const { gameCode } = useParams<{ gameCode: string }>();

    useEffect(() => {
        const unsubscribe = subscribeToAuth(async (currentUser) => {
            setUser(currentUser);

            if (currentUser && gameCode) {
                // Verify ownership against Firestore
                // NOTE: This assumes getGame(code) fetches the doc. 
                // In a real app, you might want a specific checkOwner(code, uid) function to be efficient.
                const game = await getGame(gameCode);
                if (game && game.hostId === currentUser.uid) {
                    setIsOwner(true);
                }
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

    // 2. Must own the game
    if (!isOwner) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <h1 className="text-red-500 font-bold text-2xl">ACCESS DENIED</h1>
                <p className="text-zinc-500 mt-2">You do not have permission to host this game.</p>
                <button onClick={() => window.location.href = '/'} className="mt-8 text-sm underline">Return Home</button>
            </div>
        );
    }

    return children;
};

export default ProtectedHostRoute;