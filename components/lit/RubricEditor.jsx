'use client';
import { round025 } from '@/lib/litConfig';

let seq = 0;
export const newCriterion = (over = {}) => ({
  key: `c${Date.now()}_${seq++}`,
  name: '',
  description: '',
  max_points: 1,
  ...over,
});

// Bảng chỉnh barem: giáo viên sửa tên, điểm, mô tả mức đạt của từng tiêu chí
export default function RubricEditor({ criteria, onChange, maxScore }) {
  const sum = round025(criteria.reduce((s, c) => s + (Number(c.max_points) || 0), 0));
  const ok = sum === Number(maxScore);

  const update = (i, patch) => onChange(criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i) => onChange(criteria.filter((_, idx) => idx !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= criteria.length) return;
    const a = [...criteria];
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };

  return (
    <div className="rb">
      <style jsx>{`
        .rb { display: grid; gap: 10px; }
        .row { background: #fff; border: 1px solid #e5eeec; border-left: 4px solid #225da3; border-radius: 12px; padding: 12px 14px; display: grid; gap: 8px; }
        .top { display: flex; gap: 8px; align-items: center; }
        .name { flex: 1; font-weight: 700; }
        .pts { width: 84px; text-align: center; }
        input, textarea { width: 100%; padding: 9px 11px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; box-sizing: border-box; }
        input:focus, textarea:focus { outline: none; border-color: #225da3; }
        .tools { display: flex; gap: 2px; background: #f8fafb; border: 1px solid #eef1f0; border-radius: 10px; padding: 3px; }
        .mini { border: none; background: transparent; border-radius: 7px; width: 28px; height: 28px; cursor: pointer; color: #4b5563; }
        .mini:hover { background: #e5e7eb; }
        .mini:disabled { opacity: 0.3; cursor: not-allowed; }
        .mini.danger { color: #a3374a; }
        .foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .add { border: 1.5px dashed #b9d4ee; background: #f5faff; color: #225da3; font-weight: 700; border-radius: 10px; padding: 9px 16px; cursor: pointer; }
        .sum { font-size: 13.5px; font-weight: 700; padding: 6px 12px; border-radius: 999px; }
        .sum.ok { color: #1a7f4e; background: #EAFBEA; }
        .sum.bad { color: #a3374a; background: #fdeef0; }
        .empty { text-align: center; color: #9ca3af; padding: 24px; border: 1px dashed #cfe2f7; border-radius: 12px; background: #fff; font-size: 14px; }
      `}</style>

      {criteria.length === 0 && (
        <div className="empty">Chưa có tiêu chí nào. Bấm “AI soạn barem” hoặc thêm tiêu chí thủ công.</div>
      )}

      {criteria.map((c, i) => (
        <div className="row" key={c.key}>
          <div className="top">
            <input className="name" value={c.name} placeholder="Tên tiêu chí (vd: Mở bài)" onChange={(e) => update(i, { name: e.target.value })} />
            <input className="pts" type="number" min="0.25" step="0.25" value={c.max_points}
              onChange={(e) => update(i, { max_points: e.target.value })} title="Điểm tối đa" />
            <div className="tools">
              <button type="button" className="mini" onClick={() => move(i, -1)} disabled={i === 0} title="Lên">↑</button>
              <button type="button" className="mini" onClick={() => move(i, 1)} disabled={i === criteria.length - 1} title="Xuống">↓</button>
              <button type="button" className="mini danger" onClick={() => remove(i)} title="Xóa">🗑</button>
            </div>
          </div>
          <textarea rows={3} value={c.description} placeholder="Yêu cầu cần đạt và các mức điểm (Tốt / Khá / Trung bình / Yếu)"
            onChange={(e) => update(i, { description: e.target.value })} />
        </div>
      ))}

      <div className="foot">
        <button type="button" className="add" onClick={() => onChange([...criteria, newCriterion()])}>＋ Thêm tiêu chí</button>
        <span className={`sum ${ok ? 'ok' : 'bad'}`}>
          Tổng {sum}/{maxScore} điểm {ok ? '✓' : `— cần bằng ${maxScore}`}
        </span>
      </div>
    </div>
  );
}
