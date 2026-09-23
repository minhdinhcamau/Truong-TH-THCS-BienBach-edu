'use client';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ROLE_ICON, ROLE_LABEL, ROLE_ORDER, roleText } from '@/lib/roles';

const LEADER_ROLES = ['lop_truong', 'lop_pho_hoc_tap', 'lop_pho_lao_dong', 'lop_pho_van_nghe'];

// GVCN: xem danh sách học sinh của lớp và cấp / thu hồi chức vụ ban cán sự.
// Sau khi đã phân xong lần đầu, danh sách chỉnh sửa được THU GỌN lại thành bảng tóm tắt cho gọn —
// bấm "Sửa phân công" để mở lại danh sách đầy đủ bất cứ lúc nào.
export default function MembersPanel({ classId, students, groupCount, reload, toast }) {
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');

  const cadre = useMemo(
    () => students.filter((s) => s.role).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.role_group || 0) - (b.role_group || 0)),
    [students]
  );
  // Lần đầu (chưa phân ai) thì mở sẵn danh sách để phân; đã có người thì thu gọn lại cho gọn.
  const [unlocked, setUnlocked] = useState(() => cadre.length === 0);

  const options = useMemo(() => {
    const list = [{ value: '', label: '— Học sinh (không chức vụ) —' }];
    LEADER_ROLES.forEach((r) => list.push({ value: r, label: `${ROLE_ICON[r]} ${ROLE_LABEL[r]}` }));
    ['to_truong', 'to_pho'].forEach((r) => {
      for (let g = 1; g <= groupCount; g += 1) list.push({ value: `${r}:${g}`, label: `${ROLE_ICON[r]} ${ROLE_LABEL[r]} · Tổ ${g}` });
    });
    return list;
  }, [groupCount]);

  const leaders = LEADER_ROLES.map((r) => ({ role: r, student: cadre.find((s) => s.role === r) || null }));
  const groupLeads = useMemo(() => {
    const out = [];
    for (let g = 1; g <= groupCount; g += 1) {
      out.push({
        group: g,
        truong: cadre.find((s) => s.role === 'to_truong' && s.role_group === g) || null,
        pho: cadre.find((s) => s.role === 'to_pho' && s.role_group === g) || null,
      });
    }
    return out;
  }, [cadre, groupCount]);

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
        <div className="cm-h">
          <h3>Ban cán sự lớp</h3>
          {!unlocked ? (
            <button className="cm-btn cm-btn-main" onClick={() => setUnlocked(true)}>✏️ Sửa phân công</button>
          ) : cadre.length > 0 ? (
            <button className="cm-btn" onClick={() => setUnlocked(false)}>✓ Xong, thu gọn lại</button>
          ) : null}
        </div>

        {cadre.length === 0 && !unlocked ? (
          <div className="cm-empty">Chưa giao chức vụ nào. Bấm “Sửa phân công” để bắt đầu.</div>
        ) : (
          <div className="mp-summary">
            {leaders.map(({ role, student }) => (
              <div key={role} className={`mp-role-card ${student ? 'filled' : ''}`}>
                <span className="mp-role-ic" aria-hidden="true">{ROLE_ICON[role]}</span>
                <div className="mp-role-txt">
                  <b>{ROLE_LABEL[role]}</b>
                  <span>{student ? student.full_name : 'Chưa giao'}</span>
                </div>
              </div>
            ))}
            {groupLeads.map((g) => (
              <div key={g.group} className="mp-group-card">
                <div className="mp-group-h">Tổ {g.group}</div>
                <div className="mp-group-row"><span aria-hidden="true">{ROLE_ICON.to_truong}</span> {g.truong ? g.truong.full_name : <i>Chưa có tổ trưởng</i>}</div>
                <div className="mp-group-row"><span aria-hidden="true">{ROLE_ICON.to_pho}</span> {g.pho ? g.pho.full_name : <i>Chưa có tổ phó</i>}</div>
              </div>
            ))}
          </div>
        )}
        {cadre.length > 0 && (
          <p className="cm-hint" style={{ marginTop: 12 }}>
            Học sinh có chức vụ sẽ thấy thêm mục “Ban cán sự” trong trang của mình. Mỗi chức vụ (mỗi tổ) chỉ một người — giao lại sẽ thay người cũ.
          </p>
        )}
      </div>

      {unlocked && (
        <div className="cm-card">
          <div className="cm-h">
            <h3>Học sinh của lớp ({students.length})</h3>
          </div>
          <input className="cm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc mã học sinh…" aria-label="Tìm học sinh" style={{ marginBottom: 12 }} />

          {students.length === 0 ? (
            <div className="cm-empty">Lớp chưa có học sinh nào. Trang Quản trị có thể chuyển học sinh vào lớp.</div>
          ) : (
            <div className="mp-list">
              {shown.map((s) => (
                <div key={s.student_id} className="mp-row">
                  <div className="mp-row-info">
                    <b>{s.full_name}</b>
                    <span>{s.student_code || '—'} · {s.group_no ? `Tổ ${s.group_no}` : 'Chưa vào tổ'}</span>
                  </div>
                  <select
                    className="cm-input mp-row-select"
                    disabled={busy === s.student_id}
                    value={s.role ? (s.role_group ? `${s.role}:${s.role_group}` : s.role) : ''}
                    onChange={(e) => change(s, e.target.value)}
                    aria-label={`Chức vụ của ${s.full_name}`}
                  >
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
              {shown.length === 0 && <div className="cm-empty">Không tìm thấy học sinh nào khớp “{q}”.</div>}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .mp-summary { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
        .mp-role-card { display: flex; align-items: center; gap: 10px; border: 1.5px solid var(--cm-line); border-radius: 12px; padding: 10px 12px; background: #fafcfb; }
        .mp-role-card.filled { border-color: var(--cm-accent, #2f6f5e); background: #f3f9f6; }
        .mp-role-ic { font-size: 22px; flex: none; }
        .mp-role-txt { display: flex; flex-direction: column; min-width: 0; font-size: 13px; }
        .mp-role-txt b { font-size: 12.5px; }
        .mp-role-txt span { color: var(--cm-muted); font-weight: 700; }
        .mp-role-card.filled .mp-role-txt span { color: var(--cm-ink); }
        .mp-group-card { border: 1.5px dashed var(--cm-line); border-radius: 12px; padding: 10px 12px; font-size: 13px; }
        .mp-group-h { font-weight: 800; margin-bottom: 4px; }
        .mp-group-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; color: var(--cm-muted); }
        .mp-group-row i { color: var(--cm-muted); font-style: normal; opacity: 0.8; }

        .mp-list { display: grid; gap: 8px; }
        .mp-row { display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--cm-line); border-radius: 12px; padding: 12px; }
        .mp-row-info { display: flex; flex-direction: column; font-size: 14px; }
        .mp-row-info span { color: var(--cm-muted); font-size: 12.5px; margin-top: 2px; }
        .mp-row-select { width: 100%; }
        @media (min-width: 640px) {
          .mp-row { flex-direction: row; align-items: center; justify-content: space-between; }
          .mp-row-select { width: auto; min-width: 230px; }
        }
      `}</style>
    </>
  );
}
