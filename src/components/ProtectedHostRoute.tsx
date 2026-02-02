import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { getLocalGame } from '../services/localGameService';

interface ProtectedHostRouteProps {
    children: React.ReactElement;
}

const ProtectedHostRoute: React.FC<ProtectedHostRouteProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { gameCode } = useParams<{ gameCode: string }>();

    useEffect(() => {
        const unsubscribe = subscribeToAuth((user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-white text-xl font-bold">Loading...</div>
            </div>
        );
    }

    // CRITICAL FIX: Allow LOCAL- games without authentication
    const isLocalGame = gameCode?.startsWith('LOCAL-');

    if (isLocalGame) {
        // For local games, verify the game exists in localStorage
        const game = getLocalGame(gameCode);
        if (!game) {
            console.warn(`[ProtectedHostRoute] Local game ${gameCode} not found`);
            return <Navigate to="/" replace />;
        }

        console.log(`[ProtectedHostRoute] ✅ Allowing access to local game: ${gameCode}`);
        return children;
    }

    // For Firebase games, require authentication
    if (!currentUser) {
        console.warn('[ProtectedHostRoute] Firebase game requires authentication');
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedHostRoute;