// src/pages/PlayerPassportPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import type { PlayerProfile, PlayerTeam } from '../types';
import {
  getMyProfile,
  registerProfile,
  addTeam,
  uploadProfilePhoto,
} from '../services/playerService';
import { subscribeToAuth } from '../services/authService';
import { SPORT_REGISTRY } from '../sports/registry';

const ALL_SPORTS = Object.keys(SPORT_REGISTRY);
const SPORT_LABELS: Record<string, string> = Object.fromEntries(Object.entries(SPORT_REGISTRY).map(([id, m]) => [id, m.label]));
const SPORT_ICONS: Record<string, string> = Object.fromEntries(Object.entries(SPORT_REGISTRY).map(([id, m]) => [id, m.icon as string]));

const TEAM_TYPE_LABELS: Record<string, string> = {
  college: 'College', club: 'Club', school: 'School',
  state: 'State', national: 'National', pickup: 'Pickup',
};

const inputCls = 'w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 focus:border-violet-400 dark:focus:border-violet-700 text-slate-900 dark:text-white text-xs px-3 py-2.5 rounded-lg focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 transition-colors';

type Tab = 'identity' | 'academic' | 'athletic' | 'teams' | 'bio';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'identity', label: 'Identity', icon: '👤' },
  { id: 'academic', label: 'Academic', icon: '🏫' },
  { id: 'athletic', label: 'Athletic', icon: '⚡' },
  { id: 'teams', label: 'Teams', icon: '🏅' },
  { id: 'bio', label: 'Bio & Photo', icon: '📷' },
];

interface TeamDraft {
  team_type: PlayerTeam['team_type'];
  team_name: string;
  jersey_number: string;
  position: string;
  role: PlayerTeam['role'];
  season_from: string;
  season_to: string;
}
const emptyTeam = (): TeamDraft => ({ team_type: 'college', team_name: '', jersey_number: '', position: '', role: 'player', season_from: '', season_to: '' });

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export const PlayerPassportPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forSelf = searchParams.get('type') !== 'other';

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('identity');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<PlayerProfile['gender']>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [usn, setUsn] = useState('');
  const [college, setCollege] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [dominantHand, setDominantHand] = useState<PlayerProfile['dominant_hand']>(null);
  const [position, setPosition] = useState('');
  const [jersey, setJersey] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [teams, setTeams] = useState<TeamDraft[]>([]);

  useEffect(() => {
    const unsub = subscribeToAuth((u) => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  const toggleSport = (s: string) => setSelectedSports(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const addTeamDraft = () => setTeams(p => [...p, emptyTeam()]);
  const removeTeamDraft = (i: number) => setTeams(p => p.filter((_, idx) => idx !== i));
  const patchTeam = (i: number, patch: Partial<TeamDraft>) => setTeams(p => p.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const progressSteps = TABS.map(t => t.id);
  const currentIdx = progressSteps.indexOf(tab);

  const handleSubmit = async () => {
    if (!user) return;
    if (fullName.trim().length < 2) { setError('Full name must be at least 2 characters.'); setTab('identity'); return; }
    if (selectedSports.length === 0) { setError('Select at least one sport.'); setTab('athletic'); return; }
    setError('');
    setSubmitting(true);

    const profile = await registerProfile({
      full_name: fullName.trim(),
      display_name: displayName.trim() || undefined,
      date_of_birth: dob || undefined,
      gender: gender || undefined,
      phone_number: phone.trim() || undefined,
      email: email.trim() || undefined,
      usn: usn.trim() || undefined,
      college_name: college.trim() || undefined,
      college_roll_no: rollNo.trim() || undefined,
      height_cm: heightCm ? parseInt(heightCm) : undefined,
      weight_kg: weightKg ? parseInt(weightKg) : undefined,
      dominant_hand: dominantHand || undefined,
      primary_position: position.trim() || undefined,
      jersey_number: jersey.trim() || undefined,
      sport_ids: selectedSports,
      bio: bio.trim() || undefined,
      registered_by: user.id,
      auth_user_id: forSelf ? user.id : undefined,
      is_claimed: forSelf,
    });

    if (!profile) { setSubmitting(false); setError('Registration failed. Please try again.'); return; }

    if (photoFile) await uploadProfilePhoto(profile.id, photoFile);

    for (const t of teams) {
      if (t.team_name.trim()) {
        await addTeam(profile.id, {
          team_type: t.team_type,
          team_name: t.team_name.trim(),
          jersey_number: t.jersey_number.trim() || null,
          position: t.position.trim() || null,
          role: t.role,
          season_from: t.season_from.trim() || null,
          season_to: t.season_to.trim() || null,
          is_active: true,
        });
      }
    }

    setSubmitting(false);
    setSuccess(true);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || (user as any).is_anonymous) return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">🪪</div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Sign In Required</h2>
        <p className="text-slate-500 dark:text-zinc-500 text-xs mb-6">You need to be signed in to register a player passport.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-violet-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg">Back to Home</button>
      </div>
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6">
      <div className="text-center max-w-sm animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic mb-2">
          Passport {forSelf ? 'Claimed' : 'Registered'}
        </h2>
        <p className="text-slate-500 dark:text-zinc-500 text-xs mb-8">
          {forSelf ? 'Your player passport is active. Stats will be tracked automatically.' : 'The athlete has been registered and can claim their passport by signing in.'}
        </p>
        <div className="flex gap-3 justify-center">
          {!forSelf && (
            <button
              onClick={() => { setSuccess(false); setTab('identity'); setFullName(''); setDisplayName(''); setSelectedSports([]); setTeams([]); setBio(''); }}
              className="px-5 py-3 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
            >
              + Register Another
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-3 bg-violet-700 hover:bg-violet-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors shadow-[0_2px_8px_rgba(109,40,217,0.25)]"
          >
            Back to Dashboard →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-6 py-4 flex items-center gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
            {forSelf ? 'Claim Your Passport' : 'Register an Athlete'}
          </h1>
          <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">
            Step {currentIdx + 1} of {TABS.length} — {TABS[currentIdx]?.label}
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          {TABS.map((t, i) => (
            <div
              key={t.id}
              className={`h-1 rounded-full transition-all duration-300 ${i < currentIdx ? 'w-6 bg-violet-600' : i === currentIdx ? 'w-8 bg-violet-600' : 'w-4 bg-slate-200 dark:bg-zinc-700'}`}
            />
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Big step indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{TABS[currentIdx]?.icon}</span>
            <div>
              <h2 className="text-2xl font-black italic text-slate-900 dark:text-white uppercase tracking-tight">{TABS[currentIdx]?.label}</h2>
              <p className="text-[10px] text-slate-400 dark:text-zinc-600 uppercase tracking-widest font-bold">
                {forSelf ? 'Your' : "Athlete's"} {TABS[currentIdx]?.label.toLowerCase()} information
              </p>
            </div>
          </div>

          {/* Tab pills */}
          <div className="flex gap-1.5 overflow-x-auto mt-4 pb-1">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
                  tab === t.id
                    ? 'bg-violet-600 text-white shadow-[0_2px_6px_rgba(109,40,217,0.3)]'
                    : i < currentIdx
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {i < currentIdx && <span className="text-[8px]">✓</span>}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">

          {/* Identity */}
          {tab === 'identity' && <>
            <Field label="Full Name" required>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={forSelf ? 'Your legal name' : "Athlete's full name"} autoFocus className={inputCls} />
            </Field>
            <Field label="Display Name / Nickname">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="How they appear on the scoreboard" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of Birth">
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Gender">
                <select value={gender ?? ''} onChange={e => setGender((e.target.value as any) || null)} className={inputCls}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone Number">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@example.com" className={inputCls} />
              </Field>
            </div>
          </>}

          {/* Academic */}
          {tab === 'academic' && <>
            <Field label="College / University Name">
              <input value={college} onChange={e => setCollege(e.target.value)} placeholder="e.g. BMS College of Engineering" className={inputCls} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="USN / Seat Number">
                <input value={usn} onChange={e => setUsn(e.target.value)} placeholder="e.g. 1BM21CS001" className={`${inputCls} font-mono`} />
              </Field>
              <Field label="College Roll Number">
                <input value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="e.g. 45" className={`${inputCls} font-mono`} />
              </Field>
            </div>
          </>}

          {/* Athletic */}
          {tab === 'athletic' && <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Default Jersey #">
                <input value={jersey} onChange={e => setJersey(e.target.value)} placeholder="e.g. 23" className={`${inputCls} font-mono`} maxLength={4} autoFocus />
              </Field>
              <Field label="Primary Position">
                <input value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Point Guard, Striker…" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Height (cm)">
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="183" className={`${inputCls} font-mono`} min={100} max={250} />
              </Field>
              <Field label="Weight (kg)">
                <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="72" className={`${inputCls} font-mono`} min={30} max={200} />
              </Field>
              <Field label="Dominant Hand">
                <select value={dominantHand ?? ''} onChange={e => setDominantHand((e.target.value as any) || null)} className={inputCls}>
                  <option value="">—</option>
                  <option value="right">Right</option>
                  <option value="left">Left</option>
                  <option value="ambidextrous">Both</option>
                </select>
              </Field>
            </div>
            <Field label="Sports" required>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ALL_SPORTS.map(s => {
                  const m = SPORT_REGISTRY[s];
                  const active = selectedSports.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleSport(s)}
                      className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full transition-all border ${active ? 'bg-violet-600 text-white border-violet-600 shadow-[0_2px_6px_rgba(109,40,217,0.2)]' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-700 hover:border-violet-400'}`}>
                      <span>{m.icon as string}</span>{m.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </>}

          {/* Teams */}
          {tab === 'teams' && <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 dark:text-zinc-500">Add all teams this player is or was part of.</p>
              <button onClick={addTeamDraft} className="text-[9px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 uppercase tracking-widest">+ Add Team</button>
            </div>
            {teams.length === 0 && (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-mono uppercase tracking-widest">No teams added yet.</p>
                <button onClick={addTeamDraft} className="mt-2 text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">+ Add First Team</button>
              </div>
            )}
            <div className="space-y-3">
              {teams.map((t, i) => (
                <div key={i} className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => removeTeamDraft(i)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 dark:text-zinc-700 dark:hover:text-red-400 text-lg leading-none transition-colors">×</button>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Team Type" required>
                      <select value={t.team_type} onChange={e => patchTeam(i, { team_type: e.target.value as any })} className={inputCls}>
                        {Object.entries(TEAM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                    <Field label="Team Name" required>
                      <input value={t.team_name} onChange={e => patchTeam(i, { team_name: e.target.value })} placeholder="e.g. BMSCE Basketball" className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Jersey #">
                      <input value={t.jersey_number} onChange={e => patchTeam(i, { jersey_number: e.target.value })} placeholder="#23" className={`${inputCls} font-mono`} maxLength={4} />
                    </Field>
                    <Field label="Position">
                      <input value={t.position} onChange={e => patchTeam(i, { position: e.target.value })} placeholder="e.g. PG" className={inputCls} />
                    </Field>
                    <Field label="Role">
                      <select value={t.role ?? 'player'} onChange={e => patchTeam(i, { role: e.target.value as any })} className={inputCls}>
                        <option value="player">Player</option>
                        <option value="captain">Captain</option>
                        <option value="vice_captain">Vice Captain</option>
                        <option value="coach">Coach</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Season From">
                      <input value={t.season_from} onChange={e => patchTeam(i, { season_from: e.target.value })} placeholder="e.g. 2023-24" className={inputCls} />
                    </Field>
                    <Field label="Season To">
                      <input value={t.season_to} onChange={e => patchTeam(i, { season_to: e.target.value })} placeholder="Present or 2024-25" className={inputCls} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </>}

          {/* Bio & Photo */}
          {tab === 'bio' && <>
            <Field label="Profile Photo">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 flex items-center justify-center flex-shrink-0">
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <span className="text-3xl text-slate-400 dark:text-zinc-600">📷</span>
                  }
                </div>
                <label className="flex-1 cursor-pointer py-3 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-colors text-center border border-slate-200 dark:border-zinc-700">
                  {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
            </Field>
            <Field label={`Bio (${bio.length}/280)`}>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="A short note about this athlete…"
                rows={5}
                maxLength={280}
                className={`${inputCls} resize-none`}
                autoFocus
              />
            </Field>
          </>}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 px-4 py-3 rounded-lg">{error}</div>
          )}
        </div>

        {/* Navigation footer */}
        <div className="flex gap-3 mt-6">
          {currentIdx > 0 ? (
            <button
              onClick={() => setTab(TABS[currentIdx - 1].id)}
              className="flex-1 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-bold uppercase tracking-widest text-xs rounded-xl transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs rounded-xl transition-colors"
            >
              Cancel
            </button>
          )}
          {currentIdx < TABS.length - 1 ? (
            <button
              onClick={() => setTab(TABS[currentIdx + 1].id)}
              className="flex-1 py-3.5 bg-violet-700 hover:bg-violet-600 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_2px_8px_rgba(109,40,217,0.25)]"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_2px_8px_rgba(109,40,217,0.25)]"
            >
              {submitting ? 'Registering…' : forSelf ? 'Claim Passport ✓' : 'Register Athlete ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
