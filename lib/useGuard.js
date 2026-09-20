'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Kiểm tra đăng nhập + quyền truy cập trang.
// kind: 'admin' | 'tpt' | 'saodo' | 'any'
const RULES = {
  admin: (p) => p.role === 'admin',
  tpt: (p) => p.role === 'admin' || !!p.is_tpt,
  saodo: (p) => p.role === 'admin' || !!p.is_saodo,
  any: () => true,
};

const DENIED = {
  admin: 'Trang này chỉ dành cho quản trị viên (admin).',
  tpt: 'Trang này chỉ dành cho cô Tổng phụ trách Đội.',
  saodo: 'Tài khoản của bạn chưa được cấp quyền Sao đỏ.',
};

export function useGuard(kind = 'any') {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_tpt, is_saodo, class_id')
        .eq('id', session.user.id)
        .single();
      if (!alive) return;
      if (!prof || !RULES[kind](prof)) {
        alert(DENIED[kind] || 'Bạn không có quyền vào trang này.');
        router.replace(prof?.role === 'student' ? '/student' : '/');
        return;
      }
      setProfile(prof);
      setReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return { profile, ready, logout };
}
