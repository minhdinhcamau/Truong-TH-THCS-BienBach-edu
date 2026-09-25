'use client';
// lib/useMusicAccess.js
// Mirror đúng cấu trúc lib/useHomeroom.js — kiểm tra giáo viên hiện tại có
// được ADMIN phân công dạy môn Âm nhạc không (bảng subject_teachers, xem
// music-schema-v2.sql). Dùng để CHỈ hiện mục "Âm nhạc" trong nav giáo viên
// cho đúng người được phân công, y như "Chủ nhiệm lớp" chỉ hiện cho GVCN.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useMusicAccess(enabled) {
  const [state, setState] = useState({ assigned: false, loaded: false });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setState({ assigned: false, loaded: true }); return; }

      // Admin luôn xem được mọi môn, giống cách "staff" xử lý ở trang chủ nhiệm.
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'admin') { if (alive) setState({ assigned: true, loaded: true }); return; }

      const { data } = await supabase
        .from('subject_teachers')
        .select('subjects(name)')
        .eq('teacher_id', user.id);
      const assigned = (data || []).some((r) => r.subjects?.name === 'Âm nhạc');
      if (alive) setState({ assigned, loaded: true });
    })();
    return () => { alive = false; };
  }, [enabled]);

  return state;
}
