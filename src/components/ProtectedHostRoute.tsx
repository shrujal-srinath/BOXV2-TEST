import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { getGameByCode } from '../services/supabaseGameService';

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
                const game = await getGameByCode(gameCode);
                setIsOwner(game?.hostId === currentUser.id);
            } else {
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

    if (!user) return <Navigate to="/" replace />;

    if (gameCode && !isOwner) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <h1 className="text-red-500 font-bold text-2xl">ACCESS DENIED</h1>
                <p className="text-zinc-500 mt-2">You do not have permission to host this game.</p>
                <div className="mt-8 flex gap-4">
                    <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="px-4 py-2 bg-zinc-800 rounded text-xs font-bold uppercase tracking-widest hover:bg-zinc-700"
                    >
                        Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedHostRoute;