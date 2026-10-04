'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Tuần học của năm học, lấy từ lịch năm học (hàm get_school_weeks, Tổng phụ trách đặt "Tuần 1 bắt đầu từ ngày").
//   noOf(weekStartIso) : số tuần (1, 2, 3...) của tuần bắt đầu từ thứ Hai đó; null nếu chưa có lịch hoặc ngoài năm học
//   firstStart         : thứ Hai của tuần 1 (không cho xem lùi trước ngày này); null nếu chưa có lịch
//   currentNo          : số của tuần hiện tại
export function useSchoolWeeks() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let on = true;
    supabase.rpc('get_school_weeks').then(({ data, error }) => {
      if (on) setRows(error ? [] : data || []);
    });
    return () => { on = false; };
  }, []);

  return useMemo(() => {
    const list = rows || [];
    const byStart = new Map(list.map((w) => [String(w.week_start), Number(w.week_no)]));
    const cur = list.find((w) => w.is_current);
    return {
      loaded: rows !== null,
      weeks: list,
      firstStart: list.length ? String(list[0].week_start) : null,
      currentNo: cur ? Number(cur.week_no) : null,
      noOf: (ws) => byStart.get(String(ws)) || null,
    };
  }, [rows]);
}
