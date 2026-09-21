'use client';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ROLE_LABEL, ROLE_ORDER, roleText } from '@/lib/roles';

// GVCN: xem danh sách học sinh của lớp và cấp / thu hồi chức vụ ban cán sự.
export default function MembersPanel({ classId, students, groupCount, reload, toast }) {
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');

  const options = useMemo(() => {
    const list = [{ value: '', label: '— Học sinh —' }];
    ['lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe'].forEach((r) => list.push({ value: r, label: ROLE_LABEL[r] }));
    ['to_truong', 'to_pho'].forEach((r) => {
      for (let g = 1; g <= groupCount; g += 1) list.push({ value: `${r}:${g}`, label: `${ROLE_LABEL[r]} · Tổ ${g}` });
    });
    return list;
  }, [groupCount]);

  const cadre = useMemo(
    () => students.filter((s) => s.role).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.role_group || 0) - (b.role_group || 0)),
    [students]
  );
  const shown = students.filter((s) => !q.trim() || `${s.full_name} ${s.student_code || ''}`.toLowerCase().includes(q.trim().toLowerCase()));

  async function change(s, value) {
    const [role, group] = value ? value.split(':') : [null, null];
    setBusy(s.student_id);
    const { error } = await supabase.rpc('gvcn_set_role', {
      p_class_id: classId, p_student_id: s.student_id, p_role: role || null, p_group_no: group ? Number(group) : null,
    });
    setBusy('');
    if (error) toast({ type: 'error', text: error.message });
    else {
      toast({ type: 'ok', text: role ? `Đã giao chức vụ cho ${s.full_name}.` : `Đã thu hồi chức vụ của ${s.full_name}.` });
      reload();
    }
  }

  return (
    <>
      <div className="cm-card">
        <div className="cm-h"><h3>Ban cán sự lớp</h3></div>
        {cadre.length === 0 ? (
          <div className="cm-empty">Chưa giao chức vụ nào. Chọn chức vụ cho học sinh ở bảng bên dưới.</div>
        ) : (
          <div className="cm-chips">
            {cadre.map((s) => <span key={s.student_id} className="cm-chip">{roleText(s.role, s.role_group)}: <b>{s.full_name}</b></span>)}
          </div>
        )}
        <p className="cm-hint" style={{ marginTop: 10 }}>
          Sau khi được giao, học sinh sẽ thấy thêm mục “Ban cán sự” trong trang học sinh của mình. Mỗi chức vụ (mỗi tổ) chỉ có một người, giao lại sẽ thay người cũ.
        </p>
      </div>

      <div className="cm-card">
        <div className="cm-h">
          <h3>Học sinh của lớp ({students.length})</h3>
          <input className="cm-input" style={{ maxWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc mã học sinh…" aria-label="Tìm học sinh" />
        </div>
        {students.length === 0 ? (
          <div className="cm-empty">Lớp chưa có học sinh nào. Cô Tổng phụ trách có thể chuyển học sinh vào lớp ở mục “Sao đỏ & tài khoản”.</div>
        ) : (
          <div className="cm-wrap">
            <table className="cm-tbl">
              <thead><tr><th>Họ tên</th><th>Mã HS</th><th>Tổ</th><th>Chức vụ</th></tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.student_id}>
                    <td><b>{s.full_name}</b></td>
                    <td>{s.student_code || '—'}</td>
                    <td>{s.group_no ? `Tổ ${s.group_no}` : <span className="cm-pill mute">Chưa vào tổ</span>}</td>
                    <td>
                      <select
                        className="cm-input"
                        style={{ minWidth: 190 }}
                        disabled={busy === s.student_id}
                        value={s.role ? (s.role_group ? `${s.role}:${s.role_group}` : s.role) : ''}
                        onChange={(e) => change(s, e.target.value)}
                        aria-label={`Chức vụ của ${s.full_name}`}
                      >
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
