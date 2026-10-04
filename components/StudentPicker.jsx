'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

// Ô chọn học sinh có gõ tìm: gõ tên hoặc họ và tên (có dấu hay không dấu đều được), danh sách gợi ý hiện ra để bấm chọn.
// Chọn xong thì ô tự mất con trỏ nên bàn phím điện thoại tự đóng.
//   roster   : [{ student_id, full_name }]
//   value    : student_id đang chọn ('' nếu chưa chọn)
//   onChange : (student_id) => void
//   noneLabel: nếu có (vd. 'Cả lớp (không chọn học sinh)') thì cho phép không chọn ai
//   invalid  : viền đỏ khi bắt buộc mà chưa chọn
export function normVi(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function StudentPicker({ id, roster, value, onChange, noneLabel, invalid, placeholder = 'Gõ tên hoặc họ và tên…' }) {
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const selected = useMemo(() => roster.find((s) => s.student_id === value) || null, [roster, value]);

  const items = useMemo(() => {
    const q = normVi(typing ? query : '');
    const tokens = q ? q.split(' ') : [];
    const list = roster
      .map((s, idx) => ({ s, n: normVi(s.full_name), idx }))
      .filter((x) => tokens.every((t) => x.n.includes(t)))
      .map((x) => {
        const words = x.n.split(' ');
        const last = words[words.length - 1];
        let rank = 3;
        if (!tokens.length) rank = 3;
        else if (last.startsWith(tokens[0])) rank = 0; // gõ tên gọi (từ cuối) thì lên đầu
        else if (words.some((w) => w.startsWith(tokens[0]))) rank = 1;
        else rank = 2;
        return { ...x, rank };
      })
      .sort((a, b) => a.rank - b.rank || a.idx - b.idx);
    return list.slice(0, 60).map((x) => x.s);
  }, [roster, query, typing]);

  const showNone = !!noneLabel && !(typing && query.trim());
  const rows = useMemo(() => (showNone ? [{ student_id: '', full_name: noneLabel, none: true }, ...items] : items), [showNone, noneLabel, items]);

  useEffect(() => { setActive(0); }, [query, open]);

  function pick(sid) {
    onChange(sid);
    setTyping(false);
    setQuery('');
    setOpen(false);
    // Bỏ con trỏ khỏi ô nhập để bàn phím điện thoại tự đóng
    inputRef.current?.blur();
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open && rows[active]) { e.preventDefault(); pick(rows[active].student_id); } }
    else if (e.key === 'Escape') { setOpen(false); setTyping(false); setQuery(''); inputRef.current?.blur(); }
  }

  const shown = typing ? query : selected ? selected.full_name : '';

  return (
    <div className="sp">
      <style jsx>{`
        .sp { position: relative; }
        .box { display: flex; align-items: center; gap: 6px; }
        .box input { flex: 1; min-width: 0; font-size: 16px; min-height: 46px; padding: 0 12px; border: 1.5px solid var(--line, #e1e8f0); border-radius: 10px; background: #fff; color: inherit; }
        .box input.bad { border-color: var(--red, #c4262e); }
        .box input:focus { outline: 2px solid var(--red, #c4262e); outline-offset: 0; }
        .clr { flex: none; width: 46px; height: 46px; border: 1.5px solid var(--line, #e1e8f0); background: #fff; border-radius: 10px; cursor: pointer; color: #5f6f83; display: inline-flex; align-items: center; justify-content: center; }
        .list { margin-top: 6px; border: 1.5px solid var(--line, #e1e8f0); border-radius: 12px; background: #fff; max-height: 232px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .opt { display: block; width: 100%; text-align: left; border: none; background: #fff; padding: 0 14px; min-height: 46px; font-size: 15px; cursor: pointer; color: inherit; border-top: 1px solid #eef1f5; }
        .opt:first-child { border-top: none; }
        .opt.on { background: #fff1f0; }
        .opt.none { color: #5f6f83; font-style: italic; }
        .opt.sel { font-weight: 800; }
        .none-msg { padding: 14px; font-size: 13.5px; color: #5f6f83; }
        .chosen { margin-top: 6px; font-size: 12.5px; color: #1a8a58; font-weight: 700; display: flex; align-items: center; gap: 5px; }
      `}</style>
      <div className="box">
        <input
          id={id}
          ref={inputRef}
          className={invalid ? 'bad' : ''}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={shown}
          placeholder={selected || typing ? '' : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setTyping(true); setOpen(true); }}
          onBlur={() => setTimeout(() => { setOpen(false); setTyping(false); setQuery(''); }, 150)}
          onKeyDown={onKeyDown}
        />
        {(selected || (typing && query)) && (
          <button type="button" className="clr" aria-label="Xóa lựa chọn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); setTyping(false); setQuery(''); inputRef.current?.focus(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      {open && (
        <div className="list" role="listbox">
          {rows.length === 0 ? (
            <div className="none-msg">Không thấy bạn nào tên “{query}” trong lớp này.</div>
          ) : rows.map((r, i) => (
            <button
              type="button"
              key={r.student_id || 'none'}
              role="option"
              aria-selected={r.student_id === value}
              className={`opt ${i === active ? 'on' : ''} ${r.none ? 'none' : ''} ${r.student_id && r.student_id === value ? 'sel' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r.student_id)}
            >
              {r.full_name}
            </button>
          ))}
        </div>
      )}
      {selected && !open && (
        <div className="chosen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          Đã chọn: {selected.full_name}
        </div>
      )}
    </div>
  );
}
