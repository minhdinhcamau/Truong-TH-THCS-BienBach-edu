'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Các lớp mà tài khoản hiện tại làm giáo viên chủ nhiệm (rỗng nếu chưa được phân công).
export function useHomeroom(enabled) {
  const [state, setState] = useState({ classes: [], loaded: false });
  useEffect(() => {
    if (!enabled) return;
    supabase.rpc('my_homeroom_classes').then(({ data }) => setState({ classes: data || [], loaded: true }));
  }, [enabled]);
  return state;
}
