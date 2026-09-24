'use client';
import { useMemo, useState } from 'react';
import { groupColor } from '@/components/Charts';

function initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  return p.slice(-2).map((w) => w[0]).join('').toUpperCase() || '?';
}

// Bộ chọn học sinh dạng thẻ, gom theo TỔ (Tổ 1, Tổ 2…) — tối ưu để chạm trên điện thoại,
// thay cho <select> dài khó bấm đúng. `students`: [{ student_id, full_name, group_no }].
// scopeGroup (tuỳ chọn): chỉ 1 tổ trưởng/tổ phó thì chỉ hiện đúng tổ của họ, không cần chia nhóm.
export default function StudentPicker({ students, value, onChange, scopeGroup, placeholder = 'Tìm tên học sinh…' }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return students.filter((s) => !k || s.full_name.toLowerCase().includes(k));
  }, [students, q]);

  const groups = useMemo(() => {
    if (scopeGroup) return [{ group: scopeGroup, list: filtered }];
    const map = new Map();
    filtered.forEach((s) => {
      const g = s.group_no || 0;
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(s);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([group, list]) => ({ group, list }));
  }, [filtered, scopeGroup]);

  const selected = students.find((s) => s.student_id === value);

  return (
    <div className="sp-root">
      <style jsx>{`
        .sp-root { display: flex; flex-direction: column; gap: 10px; }
        .sp-search { position: relative; }
        .sp-search input { width: 100%; padding: 11px 14px 11px 38px; border: 1.5px solid var(--cm-line); border-radius: 12px; font-size: 15px; background: #fff; color: var(--cm-ink); }
        .sp-search input:focus { border-color: var(--cm-accent, #2f6f5e); outline: none; }
        .sp-search::before { content: '🔎'; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; opacity: 0.6; }
        .sp-groups { display: flex; flex-direction: column; gap: 12px; max-height: 420px; overflow-y: auto; padding-right: 2px; }
        .sp-gh { font-size: 12px; font-weight: 800; color: #fff; display: inline-flex; align-self: flex-start; padding: 3px 12px; border-radius: 999px; }
        .sp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
        .sp-chip {
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 6px;
          padding: 10px 6px 9px; border-radius: 14px; border: 1.5px solid var(--cm-line); background: #fff;
          cursor: pointer; text-align: center; min-height: 82px; position: relative;
        }
        .sp-chip:active { transform: scale(0.98); }
        .sp-chip.on { border-color: var(--cm-accent, #2f6f5e); background: #f3f9f6; box-shadow: 0 0 0 1px var(--cm-accent, #2f6f5e) inset; }
        .sp-av { flex: none; width: 34px; height: 34px; border-radius: 50%; background: #dfe6ec; color: #46586b; font-size: 12.5px; font-weight: 800; display: grid; place-items: center; }
        .sp-chip.on .sp-av { background: var(--cm-accent, #2f6f5e); color: #fff; }
        .sp-name { font-size: 12.5px; font-weight: 700; line-height: 1.28; color: var(--cm-ink); word-break: break-word; }
        .sp-check { position: absolute; top: 6px; right: 8px; color: var(--cm-accent, #2f6f5e); font-weight: 800; font-size: 13px; }
        .sp-empty { text-align: center; color: var(--cm-muted); font-size: 13.5px; padding: 18px 0; }
        .sp-selected { display: flex; align-items: center; gap: 8px; background: #f3f9f6; border: 1.5px solid var(--cm-accent, #2f6f5e); border-radius: 12px; padding: 8px 12px; font-size: 13.5px; font-weight: 700; }
        .sp-selected button { margin-left: auto; border: none; background: none; color: var(--cm-muted); font-size: 16px; cursor: pointer; padding: 2px 6px; }
      `}</style>

      {selected && (
        <div className="sp-selected">
          <span className="sp-av" style={{ width: 26, height: 26, fontSize: 10.5, background: 'var(--cm-accent, #2f6f5e)', color: '#fff' }}>{initials(selected.full_name)}</span>
          Đã chọn: {selected.full_name}{selected.group_no ? ` · Tổ ${selected.group_no}` : ''}
          <button onClick={() => onChange('')} aria-label="Bỏ chọn">✕</button>
        </div>
      )}

      <div className="sp-search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </div>

      <div className="sp-groups">
        {groups.length === 0 && <div className="sp-empty">Không có học sinh nào.</div>}
        {groups.map(({ group, list }) => (
          <div key={group}>
            {!scopeGroup && <div className="sp-gh" style={{ background: groupColor(group || 1) }}>{group ? `Tổ ${group}` : 'Chưa vào tổ'}</div>}
            <div className="sp-grid" style={{ marginTop: scopeGroup ? 0 : 6 }}>
              {list.map((s) => (
                <button key={s.student_id} type="button" className={`sp-chip ${value === s.student_id ? 'on' : ''}`} onClick={() => onChange(s.student_id)} aria-pressed={value === s.student_id}>
                  {value === s.student_id && <span className="sp-check">✓</span>}
                  <span className="sp-av">{initials(s.full_name)}</span>
                  <span className="sp-name">{s.full_name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
