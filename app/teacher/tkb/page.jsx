'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useGuard } from '@/lib/useGuard';
import { useHomeroom } from '@/lib/useHomeroom';
import HomeroomShell from '@/components/HomeroomShell';
import ClassTimetable from '@/components/Timetable';
import { loadBellTimes, loadTeacherTimetable } from '@/lib/tkbClient';

// Thời khóa biểu RIÊNG của giáo viên: hệ thống tự gom mọi tiết có tên thầy cô trong thời khóa biểu toàn trường.
// Tổng phụ trách và admin còn chọn xem được thời khóa biểu của từng giáo viên khác.
export default function TeacherTimetablePage() {
  const router = useRouter();
  const { profile, ready, logout } = useGuard('any');
  const isStudent = !!profile && profile.role === 'student' && !profile.is_tpt;
  const staff = !!profile && (profile.role === 'admin' || !!profile.is_tpt);
  const homeroom = useHomeroom(ready && !isStudent);

  const [bells, setBells] = useState([]);
  const [teachers, setTeachers] = useState([]); // chỉ tải cho Tổng phụ trách / admin
  const [viewId, setViewId] = useState(''); // '' = của chính mình
  const [view, setView] = useState({ rows: [], error: null, effectiveFrom: null });
  const [names, setNames] = useState([]);
  const [aliasText, setAliasText] = useState('');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState(null); // { ok: boolean, text }

  useEffect(() => { if (ready && isStudent) router.replace('/student/thoi-khoa-bieu'); }, [ready, isStudent, router]);

  useEffect(() => {
    if (!ready || isStudent) return;
    loadBellTimes().then(setBells);
    if (staff) supabase.rpc('tkb_list_teachers').then(({ data }) => setTeachers(data || []));
  }, [ready, isStudent, staff]);

  const reload = useCallback(async () => {
    const pid = viewId || null;
    const [v, n] = await Promise.all([loadTeacherTimetable(pid), supabase.rpc('teacher_tkb_names', { p_profile_id: pid })]);
    setView(v);
    const list = n.data || [];
    setNames(list);
    setAliasText(list.some((x) => x.manual) ? list.map((x) => x.name).join(', ') : '');
    setLoading(false);
  }, [viewId]);

  useEffect(() => {
    if (!ready || isStudent) return;
    setLoading(true);
    reload();
  }, [ready, isStudent, reload]);

  async function saveAlias() {
    const { error } = await supabase.rpc('teacher_set_tkb_alias', { p_aliases: aliasText, p_profile_id: viewId || null });
    if (error) {
      setNote({ ok: false, text: error.message });
      return;
    }
    setNote({ ok: true, text: aliasText.trim() ? 'Đã lưu tên trên thời khóa biểu.' : 'Đã bỏ khai báo, hệ thống tự khớp theo họ tên.' });
    reload();
  }

  if (!ready || isStudent) return <div style={{ padding: 60, textAlign: 'center', color: '#5b6e66' }}>Đang tải…</div>;

  const showHomeroom = staff || homeroom.classes.length > 0;
  const viewName = viewId ? (teachers.find((t) => t.id === viewId)?.full_name || '') : (profile?.full_name || '');
  const roleLabel = staff ? (profile.role === 'admin' ? 'Quản trị viên' : 'Tổng phụ trách Đội') : 'Giáo viên';

  return (
    <HomeroomShell profile={profile} roleLabel={roleLabel} active="tkb" showHomeroom={showHomeroom} onLogout={logout}>
      <h1 className="hr-title">Thời khóa biểu của {viewId ? 'giáo viên' : 'tôi'}</h1>
      <p className="hr-sub">
        Hệ thống lấy mọi tiết có tên thầy cô trong thời khóa biểu toàn trường do cô Tổng phụ trách cập nhật. Bấm “Lưu ảnh” để tải về điện thoại hoặc “In” để in ra giấy.
      </p>

      {staff && (
        <div className="hr-card">
          <label htmlFor="tkb-who" style={{ display: 'block', fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>Xem thời khóa biểu của</label>
          <select id="tkb-who" value={viewId} onChange={(e) => { setViewId(e.target.value); setNote(null); }}
            style={{ width: '100%', maxWidth: 360, padding: '10px 12px', borderRadius: 10, border: '1px solid #dce6e1', fontSize: 15, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Của tôi ({profile.full_name})</option>
            {teachers.filter((t) => t.id !== profile.id).map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}{t.is_tpt ? ' (Tổng phụ trách)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div className="hr-card">
        {loading ? (
          <div className="hr-empty">Đang tải…</div>
        ) : view.error ? (
          <div className="hr-empty">{view.error}</div>
        ) : view.rows.length === 0 ? (
          <div className="hr-empty">
            Chưa tìm thấy tiết nào của {viewId ? 'giáo viên này' : 'thầy cô'} trong thời khóa biểu hiện hành.
            Nếu tên trong thời khóa biểu khác tên tài khoản, hãy khai báo “tên trên thời khóa biểu” ở bên dưới.
          </div>
        ) : (
          <ClassTimetable rows={view.rows} className={viewName} badge={viewName} title="THỜI KHÓA BIỂU GIÁO VIÊN" effectiveFrom={view.effectiveFrom} bells={bells} />
        )}
      </div>

      <div className="hr-card">
        <h3 style={{ fontSize: 16, marginBottom: 6 }}>Tên trên thời khóa biểu</h3>
        <p className="hr-sub" style={{ margin: '0 0 10px' }}>
          Thời khóa biểu ghi tên gọi ngắn (ví dụ “Đỉnh”), hệ thống khớp với họ tên trong tài khoản kết thúc bằng tên đó. Nếu bị thiếu tiết hoặc khớp nhầm người trùng tên, nhập đúng tên ghi trong thời khóa biểu (nhiều tên cách nhau bằng dấu phẩy). Để trống rồi lưu để quay lại tự khớp.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {names.length === 0
            ? <span style={{ background: '#fff4dc', color: '#8a5b0a', borderRadius: 999, padding: '3px 12px', fontSize: 12.5, fontWeight: 700 }}>Chưa khớp tên nào trong thời khóa biểu</span>
            : names.map((n) => (
              <span key={n.name} style={{ background: '#e8f2ee', color: '#234f42', borderRadius: 999, padding: '3px 12px', fontSize: 12.5, fontWeight: 700 }}>
                {n.manual ? 'Đã khai báo' : 'Tự khớp'}: {n.name}
              </span>
            ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input value={aliasText} onChange={(e) => setAliasText(e.target.value)} placeholder="Ví dụ: Việt Anh" aria-label="Tên trên thời khóa biểu"
            style={{ flex: '1 1 220px', padding: '10px 12px', borderRadius: 10, border: '1px solid #dce6e1', fontSize: 16, fontFamily: 'inherit' }} />
          <button type="button" onClick={saveAlias}
            style={{ padding: '10px 20px', borderRadius: 10, border: 0, background: '#2f6f5e', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}>
            Lưu tên
          </button>
        </div>
        {note && <p style={{ margin: '10px 0 0', fontSize: 13.5, fontWeight: 600, color: note.ok ? '#1a7f4e' : '#b3261e' }}>{note.text}</p>}
      </div>
    </HomeroomShell>
  );
}
