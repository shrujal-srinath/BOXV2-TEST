import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { subscribeToAuth } from '../services/authService';
import { getGame, isGameOwner } from '../services/gameService';
import { User } from 'firebase/auth';

interface ProtectedHostRouteProps {
    children: React.ReactNode;
}

const ProtectedHostRoute: React.FC<ProtectedHostRouteProps> = ({ children }) => {
    const { gameCode } = useParams<{ gameCode: string }>();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeToAuth((currentUser) => {
            setUser(currentUser);

            if (currentUser && gameCode) {
                // Check if current user is the game owner
                const ownerStatus = isGameOwner(gameCode, currentUser.uid);
                setIsOwner(ownerStatus);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [gameCode]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: '#000000',
                color: '#ffffff'
            }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '4px solid rgba(204, 0, 0, 0.1)',
                    borderTopColor: '#cc0000',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ marginTop: '1rem' }}>Verifying access...</p>
            </div>
        );
    }

    // If not logged in, redirect to login
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // If game doesn't exist, redirect to dashboard
    if (!gameCode || !getGame(gameCode)) {
        return <Navigate to="/dashboard" replace />;
    }

    // If not the owner, redirect to watch mode
    if (!isOwner) {
        return <Navigate to={`/watch/${gameCode}`} replace />;
    }

    // User is authenticated and owns the game
    return <>{children}</>;
};

export default ProtectedHostRoute;