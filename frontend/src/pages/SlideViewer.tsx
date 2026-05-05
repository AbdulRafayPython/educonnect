import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';

interface Slide {
  id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  file_path: string;
}

interface Course {
  id: string;
  title: string;
}

export default function SlideViewer() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAppStore();
  const navigate = useNavigate();
  const nav = navForRole(role);

  const [slide, setSlide] = useState<Slide | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    (async () => {
      if (!id) return;
      const { data, error } = await supabase.from('slides').select('*').eq('id', id).single();
      if (cancelled) return;
      if (error || !data) { setStatus('missing'); return; }
      setSlide(data as Slide);

      if (data.course_id) {
        const { data: c } = await supabase.from('courses').select('id, title').eq('id', data.course_id).single();
        if (!cancelled && c) setCourse(c as Course);
      }

      const { data: file, error: dlErr } = await supabase.storage
        .from('slides')
        .download(data.file_path);
      if (cancelled) return;
      if (dlErr || !file) {
        setErrorMsg(dlErr?.message || 'Could not load slide file.');
        setStatus('error');
        return;
      }

      const htmlBlob = new Blob([await file.arrayBuffer()], { type: 'text/html;charset=utf-8' });
      createdBlobUrl = URL.createObjectURL(htmlBlob);
      setBlobUrl(createdBlobUrl);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [id]);

  const openInNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  const backTo = role === 'teacher' ? '/teacher/slides' : '/student/slides';

  return (
    <DashboardLayout title="Slide Viewer" navItems={nav}>
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
        <div className="flex flex-row justify-between items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(backTo)}
              className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container active:bg-surface-container/80 transition-colors text-on-surface-variant shrink-0"
              aria-label="Back to slides"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>arrow_back</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-extrabold text-primary tracking-tight truncate">
                {slide?.title || (status === 'loading' ? 'Loading…' : 'Slide deck')}
              </h2>
              {course && (
                <p className="text-[0.6rem] sm:text-[0.65rem] font-bold uppercase tracking-widest text-secondary/60 mt-0.5 truncate">{course.title}</p>
              )}
            </div>
          </div>
          {blobUrl && (
            <button
              type="button"
              onClick={openInNewTab}
              aria-label="Open in new tab"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-bold hover:bg-surface-container-high active:bg-surface-container-high transition-colors shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
              <span className="hidden sm:inline">Open in new tab</span>
            </button>
          )}
        </div>

        {status === 'loading' && (
          <div className="w-full h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-12rem)] rounded-2xl border border-outline-variant/20 flex items-center justify-center bg-surface-container/40">
            <p className="text-sm text-on-surface-variant font-medium">Loading slide deck…</p>
          </div>
        )}

        {status === 'missing' && (
          <div className="w-full py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">error</span>
            <p className="text-on-surface-variant font-medium">Slide deck not found.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-error/60 mb-4 block">error</span>
            <p className="text-on-surface-variant font-medium">Could not load slide deck.</p>
            {errorMsg && <p className="text-xs text-on-surface-variant/70 mt-2">{errorMsg}</p>}
          </div>
        )}

        {status === 'ready' && blobUrl && (
          <iframe
            src={blobUrl}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-[calc(100dvh-10rem)] sm:h-[calc(100dvh-12rem)] rounded-2xl border border-outline-variant/20 bg-white"
            title={slide?.title || 'Slide deck'}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
