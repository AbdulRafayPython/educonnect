import DashboardLayout from '../components/DashboardLayout';
import GroupRoom from '../components/GroupRoom';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import type { ChatParticipant } from '../lib/chat';

export default function MasterclassRoom() {
  const { role, user, profile } = useAppStore();
  const nav = navForRole(role);

  const me: ChatParticipant | null = user
    ? {
        id: user.id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: profile?.role ?? role,
      }
    : null;

  return (
    <DashboardLayout title="Group Room" navItems={nav}>
      {!me ? (
        <div className="text-center py-20 text-on-surface-variant">Loading…</div>
      ) : (
        <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-9rem)] rounded-2xl border border-outline-variant/15 overflow-hidden bg-surface-container-lowest">
          <GroupRoom me={me} />
        </div>
      )}
    </DashboardLayout>
  );
}
