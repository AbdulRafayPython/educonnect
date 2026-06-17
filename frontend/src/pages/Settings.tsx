import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { navForRole } from '../lib/nav';
import {
  TEACHER_TIMEZONE,
  browserTimezone,
  timezoneList,
  formatInTimezone,
  tzOffsetLabel,
  tzDeltaFromTeacher,
} from '../lib/time';

export default function Settings() {
  const { profile, role, user, setProfile } = useAppStore();
  const nav = navForRole(role);

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileMsg(null);
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, avatar_url: avatarUrl || null })
      .eq('id', user.id)
      .select()
      .single();
    setProfileSaving(false);
    if (error) {
      setProfileMsg({ kind: 'err', text: error.message });
    } else {
      if (data) setProfile(data);
      setProfileMsg({ kind: 'ok', text: 'Profile updated.' });
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (newPassword.length < 6) {
      setPwMsg({ kind: 'err', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: 'err', text: 'Passwords do not match.' });
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwMsg({ kind: 'err', text: error.message });
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ kind: 'ok', text: 'Password updated successfully.' });
    }
  };

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <DashboardLayout title="Settings" navItems={nav}>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">Account Settings</h2>
          <p className="text-on-surface-variant text-sm mt-1">Manage your profile and password.</p>
        </div>

        {/* Profile section */}
        <section className="bg-surface-container-lowest rounded-2xl p-7 border border-outline-variant/10 space-y-5">
          <h3 className="font-extrabold text-primary text-base">Profile</h3>

          <div className="flex items-center gap-5">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl academic-gradient flex items-center justify-center text-white text-2xl font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface">{profile?.email}</p>
              <p className="text-[0.65rem] uppercase tracking-widest text-secondary/60 font-bold mt-1">{role}</p>
            </div>
          </div>

          {profileMsg && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${profileMsg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-error-container text-on-error-container'}`}>
              {profileMsg.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Avatar URL (optional)</label>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface"
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={profileSaving || !fullName}
              className="px-5 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
            >
              {profileSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </section>

        {/* Time zone section */}
        <TimezoneSection />

        {/* Password section */}
        <section className="bg-surface-container-lowest rounded-2xl p-7 border border-outline-variant/10 space-y-5">
          <h3 className="font-extrabold text-primary text-base">Change Password</h3>

          {pwMsg && (
            <div className={`px-4 py-3 rounded-xl text-sm font-medium ${pwMsg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-error-container text-on-error-container'}`}>
              {pwMsg.text}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface"
                placeholder="Repeat new password"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={changePassword}
              disabled={pwSaving || !newPassword || !confirmPassword}
              className="px-5 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
            >
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

// Live timezone matcher: pick your IANA zone and see your local time next to the
// teacher's (Pakistan) in real time, so session timings are unambiguous.
function TimezoneSection() {
  const { profile, user, setProfile, role } = useAppStore();
  const [tz, setTz] = useState<string>(profile?.timezone || browserTimezone());
  const [now, setNow] = useState<Date>(new Date());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setTz(profile?.timezone || browserTimezone());
  }, [profile?.timezone]);

  // Tick the clocks once per second.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const zones = timezoneList();
  const isTeacher = role === 'teacher';
  const dirty = (profile?.timezone || '') !== tz;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { data, error } = await supabase
      .from('profiles')
      .update({ timezone: tz })
      .eq('id', user.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
    } else {
      if (data) setProfile(data);
      setMsg({ kind: 'ok', text: 'Time zone saved.' });
    }
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-7 border border-outline-variant/10 space-y-5">
      <div>
        <h3 className="font-extrabold text-primary text-base">Time Zone</h3>
        <p className="text-on-surface-variant text-xs mt-1">
          {isTeacher
            ? 'Your working zone. Students match their schedule to this.'
            : 'Set your zone to see session times in your local time and match your teacher’s schedule.'}
        </p>
      </div>

      {/* Live comparison clocks */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl academic-gradient text-white p-4">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-white/70">Your time</p>
          <p className="text-2xl font-extrabold mt-1 tabular-nums">{formatInTimezone(now, tz)}</p>
          <p className="text-[0.7rem] text-white/70 mt-1 truncate">{tz.replace(/_/g, ' ')} · {tzOffsetLabel(tz)}</p>
        </div>
        <div className="rounded-2xl bg-surface-variant/40 p-4">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant">Teacher’s time</p>
          <p className="text-2xl font-extrabold mt-1 text-on-surface tabular-nums">{formatInTimezone(now, TEACHER_TIMEZONE)}</p>
          <p className="text-[0.7rem] text-on-surface-variant mt-1 truncate">{TEACHER_TIMEZONE.replace(/_/g, ' ')} · {tzOffsetLabel(TEACHER_TIMEZONE)}</p>
        </div>
      </div>

      {!isTeacher && (
        <div className="flex items-center justify-center">
          <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {tzDeltaFromTeacher(tz)}
          </span>
        </div>
      )}

      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-error-container text-on-error-container'}`}>
          {msg.text}
        </div>
      )}

      <div>
        <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Your Time Zone</label>
        <div className="flex gap-2">
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface"
          >
            {!zones.includes(tz) && <option value={tz}>{tz}</option>}
            {zones.map((z) => (
              <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setTz(browserTimezone())}
            title="Use my device’s time zone"
            className="px-3 py-3 rounded-xl bg-surface-container text-primary text-sm font-bold hover:bg-surface-container-high transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>my_location</span>
            <span className="hidden sm:inline">Detect</span>
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-5 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Time Zone'}
        </button>
      </div>
    </section>
  );
}
