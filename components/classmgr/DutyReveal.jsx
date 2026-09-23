'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { groupColor } from '@/components/Charts';

// Hiệu ứng "quay ngẫu nhiên" hiện lần lượt từng bạn được xếp trực — kèm tên tổ trưởng của tổ bạn đó —
// để cả lớp xem trực quan, dễ tin là công bằng. Chỉ là hiệu ứng hiển thị: lịch trực đã được tính xong từ trước
// (planDuty), đây không xáo trộn lại kết quả, chỉ "diễn" lại quá trình chọn cho vui và rõ ràng.
// rows: kết quả planDuty (đã gộp theo ngày ở component cha) — mỗi phần tử { date, label, name, group_no, reason }
// leaderOf(group_no): trả về tên tổ trưởng của tổ đó, hoặc null.
export default function DutyReveal({ rows, leaderOf, onClose }) {
  const [i, setI] = useState(0);
  const [spin, setSpin] = useState(true);
  const [spinName, setSpinName] = useState('');
  const timer = useRef(null);
  const pool = useMemo(() => Array.from(new Set(rows.map((r) => r.name))), [rows]);

  const row = rows[i];
  const done = i >= rows.length;

  useEffect(() => {
    if (done) return undefined;
    setSpin(true);
    let tick = 0;
    const total = 14 + Math.floor(Math.random() * 6);
    const step = () => {
      tick += 1;
      setSpinName(pool[Math.floor(Math.random() * pool.length)] || '');
      if (tick >= total) {
        setSpin(false);
        return;
      }
      const delay = 45 + tick * 9; // chậm dần lại trước khi dừng, giống vòng quay
      timer.current = setTimeout(step, delay);
    };
    step();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function next() {
    clearTimeout(timer.current);
    if (spin) {
      // bấm trong lúc đang quay -> dừng ngay tại kết quả thật
      setSpin(false);
      return;
    }
    setI((x) => x + 1);
  }

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin, i]);

  return (
    <div className="dr-stage" role="dialog" aria-label="Quay ngẫu nhiên lịch trực" onClick={next}>
      <style jsx>{`
        .dr-stage { position: fixed; inset: 0; z-index: 800; background: radial-gradient(900px 560px at 50% -10%, #1f6a54 0%, #0e2922 60%); color: #fff;
          display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; cursor: pointer; }
        .dr-close { position: absolute; top: 16px; right: 16px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.08); color: #fff;
          border-radius: 999px; padding: 8px 16px; font-weight: 700; font-size: 13px; cursor: pointer; }
        .dr-prog { position: absolute; top: 18px; left: 20px; font-size: 13px; color: #b9d6cb; font-weight: 700; }
        .dr-day { font-size: clamp(16px, 2.2vw, 22px); color: #b9d6cb; font-weight: 700; margin-bottom: 10px; }
        .dr-name { font-family: 'Baloo 2', sans-serif; font-weight: 700; font-size: clamp(34px, 8vw, 78px); line-height: 1.1; min-height: 1.2em; }
        .dr-name.spin { color: #dfeee7; filter: blur(0.4px); }
        .dr-name.land { color: #f2c94c; animation: drPop 0.5s cubic-bezier(.2,.8,.2,1); }
        .dr-tag { display: inline-block; margin-top: 14px; padding: 6px 18px; border-radius: 999px; font-weight: 800; font-size: clamp(13px, 1.6vw, 17px); color: #fff; }
        .dr-lead { margin-top: 10px; font-size: clamp(14px, 1.8vw, 19px); color: #d7e9e1; }
        .dr-lead b { color: #fff; }
        .dr-hint { position: absolute; bottom: 22px; font-size: 13px; color: #9db7ad; }
        .dr-final { display: flex; flex-direction: column; gap: 10px; max-width: 640px; width: 100%; max-height: 70vh; overflow-y: auto; }
        .dr-final h2 { font-family: 'Baloo 2', sans-serif; font-size: clamp(24px, 4vw, 36px); margin-bottom: 6px; }
        .dr-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: rgba(255,255,255,0.09); border-radius: 12px; padding: 10px 16px; text-align: left; }
        @keyframes drPop { 0% { transform: scale(0.85); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
      `}</style>

      <button className="dr-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>Đóng (Esc)</button>

      {!done ? (
        <>
          <div className="dr-prog">{i + 1} / {rows.length}</div>
          <div className="dr-day">{row.label} · {fmtIsoSafe(row.date)}</div>
          <div className={`dr-name ${spin ? 'spin' : 'land'}`}>{spin ? spinName : row.name}</div>
          {!spin && (
            <>
              {row.group_no ? <span className="dr-tag" style={{ background: groupColor(row.group_no) }}>Tổ {row.group_no}</span> : null}
              <div className="dr-lead">
                {row.group_no ? (leaderOf(row.group_no) ? <>Tổ trưởng: <b>{leaderOf(row.group_no)}</b></> : 'Tổ chưa có tổ trưởng') : 'Trực chung cả lớp'}
              </div>
            </>
          )}
          <div className="dr-hint">{spin ? 'Đang quay…' : 'Chạm màn hình hoặc bấm cách để tiếp tục'}</div>
        </>
      ) : (
        <div className="dr-final" onClick={(e) => e.stopPropagation()}>
          <h2>🎉 Xong rồi!</h2>
          {rows.map((r, k) => (
            <div key={k} className="dr-row">
              <span>{r.label} · {r.name}</span>
              {r.group_no ? <span className="dr-tag" style={{ background: groupColor(r.group_no) }}>Tổ {r.group_no}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtIsoSafe(iso) {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d}/${m}`;
  } catch {
    return '';
  }
}
