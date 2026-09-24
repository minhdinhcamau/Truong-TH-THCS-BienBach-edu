'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { groupColor } from '@/components/Charts';

// "Trực chéo nề nếp": mỗi tuần, tổ trưởng/tổ phó của một tổ ghi nhận nề nếp cho MỘT TỔ KHÁC (không phải
// tổ của mình), để tránh thiên vị. Chỉ lớp trưởng hoặc GVCN mới xếp được (khác với ai được xếp lịch trực nhật).
// Ẩn hẳn nếu lớp chưa có từ 2 tổ trưởng/tổ phó trở lên (chưa đủ điều kiện xếp chéo).
export default function WatchDutyPanel({ classId, canManage, toast }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('class_get_watch_duty', { p_class_id: classId });
    if (error) setRows([]);
    else setRows(data || []);
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true);
    const { data, error } = await supabase.rpc('class_generate_watch_duty', { p_class_id: classId });
    setBusy(false);
    if (error) {
      toast({ type: 'error', text: error.message });
      return;
    }
    toast({ type: 'ok', text: `Đã xếp trực chéo cho ${data} tổ.` });
    load();
  }

  if (rows === null) return null;
  if (rows.length === 0 && !canManage) return null; // học sinh thường không cần thấy khối rỗng

  return (
    <div className="cm-card" style={{ borderColor: rows.length ? 'var(--cm-accent, #2f6f5e)' : undefined }}>
      <div className="cm-h">
        <h3>🔀 Trực chéo nề nếp tuần này</h3>
        {canManage && <button className="cm-btn cm-btn-sm" disabled={busy} onClick={generate}>{busy ? 'Đang xếp…' : rows.length ? 'Xếp lại' : 'Xếp trực chéo'}</button>}
      </div>
      <p className="cm-hint" style={{ marginTop: 0 }}>
        Tổ trưởng / tổ phó ghi nhận nề nếp cho tổ được phân công dưới đây thay vì tổ của mình, tránh thiên vị. Xếp lại mỗi tuần, không lặp cặp tuần trước.
      </p>
      {rows.length === 0 ? (
        <div className="cm-empty">{canManage ? 'Chưa xếp trực chéo cho tuần này.' : 'Tuần này chưa xếp trực chéo — tổ trưởng ghi nhận cho tổ của mình như bình thường.'}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <div key={r.watcher_group} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--cm-line)', borderRadius: 12, padding: '9px 12px', fontSize: 13.5 }}>
              <span className="cm-chip" style={{ background: groupColor(r.watcher_group), color: '#fff', fontWeight: 800 }}>Tổ {r.watcher_group}</span>
              <span style={{ color: 'var(--cm-muted)' }}>{r.watcher_names || 'chưa có tổ trưởng'}</span>
              <span aria-hidden="true">→ giám sát →</span>
              <span className="cm-chip" style={{ background: groupColor(r.watched_group), color: '#fff', fontWeight: 800 }}>Tổ {r.watched_group}</span>
              <span style={{ color: 'var(--cm-muted)' }}>{r.watched_names || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
