'use client';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Gọi onPing() ngay khi bảng điểm trừ thay đổi (thời gian thực).
// Có thêm lượt tải lại định kỳ 60 giây phòng khi kết nối realtime bị rớt.
export function useRankingPing(onPing) {
  const ref = useRef(onPing);
  ref.current = onPing;

  useEffect(() => {
    const channel = supabase
      .channel(`ranking-ping-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ranking_ping' }, () => ref.current?.())
      .subscribe();
    const timer = setInterval(() => ref.current?.(), 60000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
