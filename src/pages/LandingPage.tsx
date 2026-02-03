import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle, loginAnonymously, subscribeToAuth } from '../services/authService';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [watchCode, setWatchCode] = useState('');

  // Auto-redirect if already logged in (Persistent Session)
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      if (user) navigate('/dashboard');
    });
    return () => unsub();
  }, [navigate]);

  const handleGuestEntry = async () => {
    setLoading(true);
    try {
      await loginAnonymously();
      // Auth subscription above will handle redirect to /dashboard
    } catch (error) {
      alert("Could not start Guest Session");
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await loginWithGoogle();
    // Auth subscription handles redirect
  };

  const handleWatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (watchCode) navigate(`/watch/${watchCode}`);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 font-bold tracking-widest animate-pulse">INITIALIZING SYSTEM...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden text-white font-sans">
      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center z-10">
        <div className="font-black italic text-2xl tracking-tighter">BOX<span className="text-blue-600">V2</span></div>
        <button onClick={handleLogin} className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          Pro Login
        </button>
      </nav>

      {/* Hero Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 z-10">
        <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter mb-6 bg-gradient-to-b from-white to-zinc-600 bg-clip-text text-transparent">
          NEXT-GEN<br />SCORING
        </h1>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs md:text-sm mb-12 max-w-md leading-relaxed">
          Professional grade scoreboard controls for everyone. <br />Syncs instantly to cloud. Works on any screen.
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={handleGuestEntry}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-lg uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all hover:scale-105"
          >
            Start Scoring Now
          </button>

          <form onSubmit={handleWatch} className="relative group">
            <input
              value={watchCode}
              onChange={(e) => setWatchCode(e.target.value.toUpperCase())}
              placeholder="ENTER GAME CODE"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-white p-4 text-center font-bold text-white placeholder-zinc-600 outline-none rounded-lg uppercase tracking-widest text-xs transition-all"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">
              →
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <div className="p-6 text-center text-[10px] text-zinc-700 font-bold uppercase tracking-widest z-10">
        Built by BMSCE Box Team
      </div>

      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
};