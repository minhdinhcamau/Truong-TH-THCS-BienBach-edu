'use client';
// lib/useMusicAccess.js
// BẢN SỬA — dùng đúng bảng "teacher_assignments" đã có sẵn trong dự án
// (không phải "subject_teachers" mình tự đặt nhầm lúc trước).
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MUSIC_SUBJECT_ID } from '@/lib/musicXp';

export function useMusicAccess(enabled) {
  const [state, setState] = useState({ assigned: false, loaded: false });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setState({ assigned: false, loaded: true }); return; }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'admin') { if (alive) setState({ assigned: true, loaded: true }); return; }

      const { data } = await supabase
        .from('teacher_assignments')
        .select('subject_id')
        .eq('teacher_id', user.id)
        .eq('subject_id', MUSIC_SUBJECT_ID);
      if (alive) setState({ assigned: (data || []).length > 0, loaded: true });
    })();
    return () => { alive = false; };
  }, [enabled]);

  return state;
}
