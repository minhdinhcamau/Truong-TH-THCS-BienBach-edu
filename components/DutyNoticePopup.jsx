'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// Hộp thông báo (popup) "Lớp của bạn trực nhật tuần N".
// Dùng cho học sinh (trong app/student/layout.jsx) và giáo viên (HomeroomShell, trang chủ giáo viên).
//  - Chỉ hiện khi tuần HIỆN TẠI đã được Tổng phụ trách công bố và lớp của người xem (học sinh: lớp mình;
//    giáo viên: lớp chủ nhiệm) có khu vực trực.
//  - Mỗi người chỉ thấy MỘT lần cho mỗi tuần, bấm "Đã rõ" hoặc "Xem bản đồ" là không hiện lại (nhớ trong trình duyệt).
//  - Nếu thông báo của chuông vừa hiện popup cho cùng tuần này (trong ~2,5 phút) thì hộp này không hiện thêm để khỏi trùng.
//  - Tự kiểm tra lại mỗi 60 giây để người đang mở web thấy ngay sau khi công bố.
// href: trang bản đồ cho vai trò hiện tại (/student/truc-nhat hoặc /teacher/truc-nhat).
const RECENT_MS = 2.5 * 60 * 1000;
const CHECK_MS = 60 * 1000;

export default function DutyNoticePopup({ href = '/student/truc-nhat' }) {
  const [notice, setNotice] = useState(null); // { week, rows: [{ name, zones: [] }], uid }
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const seenRef = useRef(new Set()); // dự phòng khi trình duyệt chặn localStorage

  const check = useCallback(async () => {
    if (busyRef.current || openRef.current) return;
    busyRef.current = true;
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;

      const m = await supabase.rpc('duty_map_get', { p_week_no: 0 });
      if (m.error || !m.data) return;
      const cur = m.data.current_week;
      const pubs = m.data.published_weeks || [];
      const mine = new Set(m.data.my_class_ids || []);
      if (!cur || !pubs.includes(cur) || mine.size === 0) return;

      const key = `duty_seen_${uid}_${cur}`;
      if (seenRef.current.has(key)) return;
      try { if (localStorage.getItem(key)) return; } catch (e) { /* trình duyệt chặn lưu: vẫn hiện hộp */ }

      const d = await supabase.rpc('duty_map_get', { p_week_no: cur });
      if (d.error || !d.data) return;
      const zones = d.data.zones || [];
      const byClass = new Map();
      (d.data.assign || []).forEach((r) => {
        if (!mine.has(r.class_id)) return;
        const z = zones.find((x) => x.id === r.zone_id);
        if (!z) return;
        if (!byClass.has(r.class_id)) byClass.set(r.class_id, { name: r.class_name, zones: [] });
        byClass.get(r.class_id).zones.push(z.name);
      });
      if (byClass.size === 0) return;

      // Chuông thông báo vừa hiện popup cho tuần này thì thôi, đánh dấu đã thấy
      const { data: recent } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('student_id', uid)
        .like('title', `%trực nhật tuần ${cur}`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (recent && recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RECENT_MS) {
        try { localStorage.setItem(key, '1'); } catch (e) { /* bỏ qua */ }
        return;
      }

      const rows = Array.from(byClass.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
      openRef.current = true;
      setNotice({ week: cur, rows, uid });
    } catch (e) {
      // Không để lỗi mạng làm hỏng trang
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(check, 1200);
    const id = setInterval(check, CHECK_MS);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [check]);

  function close() {
    if (notice) {
      const key = `duty_seen_${notice.uid}_${notice.week}`;
      seenRef.current.add(key);
      try { localStorage.setItem(key, '1'); } catch (e) { /* bỏ qua */ }
    }
    openRef.current = false;
    setNotice(null);
  }

  if (!notice) return null;

  return (
    <div className="dnp-bg" role="dialog" aria-modal="true" aria-label="Thông báo trực nhật">
      <style jsx global>{`
        .dnp-bg { position: fixed; inset: 0; z-index: 320; display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(11, 32, 52, 0.52); animation: dnpFade 0.25s ease; }
        .dnp { position: relative; width: 400px; max-width: 100%; background: #fff; border-radius: 26px; padding: 30px 26px 24px;
          border: 2px solid #3b82c4; box-shadow: 0 30px 70px -14px rgba(0, 0, 0, 0.5); text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 10px; animation: dnpPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .dnp-ic { font-size: 50px; line-height: 1; filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15)); }
        .dnp h2 { margin: 0; font-size: 19px; line-height: 1.3; color: #0f2a44; font-family: 'Baloo 2', 'Be Vietnam Pro', sans-serif; }
        .dnp-sub { margin: 0; font-size: 13.5px; color: #4e6a88; }
        .dnp-list { width: 100%; display: grid; gap: 8px; margin: 4px 0 2px; max-height: 38vh; overflow-y: auto; }
        .dnp-row { background: #eef5fd; border-radius: 14px; padding: 10px 12px; text-align: left; }
        .dnp-row b { display: block; font-size: 15px; color: #17406b; }
        .dnp-row span { font-size: 14px; color: #24476f; }
        .dnp-act { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; width: 100%; }
        .dnp-btn { flex: 1 1 140px; min-height: 46px; padding: 11px 18px; border-radius: 999px; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer;
          text-decoration: none; display: inline-flex; align-items: center; justify-content: center; border: 1.5px solid #b9d4f0; background: #fff; color: #1f5a96; }
        .dnp-btn.main { background: linear-gradient(135deg, #245f9a, #3b82c4); border-color: transparent; color: #fff; box-shadow: 0 8px 20px -4px rgba(27, 111, 184, 0.55); }
        @keyframes dnpFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dnpPop { from { opacity: 0; transform: scale(0.75) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .dnp, .dnp-bg { animation: none; } }
      `}</style>
      <div className="dnp">
        <div className="dnp-ic" aria-hidden="true">🧹</div>
        <h2>{notice.rows.length > 1 ? `Các lớp trực nhật tuần ${notice.week}` : `Lớp ${notice.rows[0].name} trực nhật tuần ${notice.week}`}</h2>
        <p className="dnp-sub">Tổng phụ trách Đội vừa công bố kết quả phân công trực nhật.</p>
        <div className="dnp-list">
          {notice.rows.map((r) => (
            <div key={r.name} className="dnp-row">
              <b>Lớp {r.name}</b>
              <span>Khu vực: {r.zones.join(', ')}</span>
            </div>
          ))}
        </div>
        <div className="dnp-act">
          <Link href={href} className="dnp-btn" onClick={close}>Xem bản đồ</Link>
          <button type="button" className="dnp-btn main" onClick={close}>✓ Đã rõ</button>
        </div>
      </div>
    </div>
  );
}
