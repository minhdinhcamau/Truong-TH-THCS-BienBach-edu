import { supabase } from '@/lib/supabaseClient';

// Gọi API route của module Ngữ văn, tự đính kèm access token của người đang đăng nhập
export async function litFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error || `Lỗi ${res.status}`) + (json.detail ? ` [${json.detail}]` : ''));
  return json;
}
