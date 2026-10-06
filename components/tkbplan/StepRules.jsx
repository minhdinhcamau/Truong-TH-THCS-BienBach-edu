'use client';
import { DAY_LABEL } from '@/lib/tkbSolver';
import { Switch, Field } from './ui';

const num = (v, d = 0) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v));

export default function StepRules({ cfg, edit, bells }) {
  const opt = (p) => edit((c) => ({ ...c, options: { ...c.options, ...p } }));
  const nSang = bells.filter((b) => b.session === 'sang' && b.period > 0).length;
  const nChieu = bells.filter((b) => b.session === 'chieu' && b.period > 0).length;
  return (
    <>
      <div className="pl-cols">
        <div className="card">
          <div className="card-h"><h3>Khung giờ học</h3></div>
          <div className="lbl" style={{ marginTop: 0 }}>Các ngày học</div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {[2, 3, 4, 5, 6, 7].map((d) => (
              <button key={d} type="button" className={`pl-chipbtn ${cfg.days.includes(d) ? 'on' : ''}`} aria-pressed={cfg.days.includes(d)} onClick={() => edit((c) => ({ ...c, days: c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort() }))}>{DAY_LABEL[d]}</button>
            ))}
          </div>
          <div className="pl-grid2">
            <Field label="Tiết buổi sáng" id="q-s"><input id="q-s" type="number" min="1" max="6" className="input" value={cfg.sang} onChange={(e) => edit((c) => ({ ...c, sang: num(e.target.value, 5) }))} /></Field>
            <Field label="Tiết buổi chiều" id="q-c"><input id="q-c" type="number" min="0" max="6" className="input" value={cfg.chieu} onChange={(e) => edit((c) => ({ ...c, chieu: num(e.target.value, 4) }))} /></Field>
            <Field label="Tối đa tiết/ngày/giáo viên" id="q-m"><input id="q-m" type="number" min="1" max="9" className="input" value={cfg.maxPerDay} onChange={(e) => edit((c) => ({ ...c, maxPerDay: num(e.target.value, 7) }))} /></Field>
            <div />
            <Field label="Định mức mặc định (tiết/tuần)" id="q-q"><input id="q-q" type="number" min="0" className="input" value={cfg.defaultQuota} onChange={(e) => edit((c) => ({ ...c, defaultQuota: num(e.target.value, 19) }))} /></Field>
            <Field label="Tối đa mặc định (tiết/tuần)" id="q-x"><input id="q-x" type="number" min="0" className="input" value={cfg.defaultMax} onChange={(e) => edit((c) => ({ ...c, defaultMax: num(e.target.value, 23) }))} /></Field>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>Nên khớp bảng “Giờ học các tiết” (hiện {nSang} tiết sáng, {nChieu} tiết chiều). Giáo viên có tiết chuẩn riêng thì định mức tính theo tiết chuẩn; giá trị mặc định chỉ dùng cho người chưa có.</p>
        </div>

        <div className="card">
          <div className="card-h"><h3>Môn học buổi chiều</h3></div>
          <Switch checked={cfg.morningOnly !== false} onChange={(v) => edit((c) => ({ ...c, morningOnly: v }))} title="Chỉ các môn dưới đây được học buổi chiều">Mọi môn còn lại chỉ xếp buổi sáng.</Switch>
          <Switch checked={cfg.afternoonStrict !== false} onChange={(v) => edit((c) => ({ ...c, afternoonStrict: v }))} title="Bắt buộc các môn này học buổi chiều">Tắt đi thì các môn này được xếp cả hai buổi.</Switch>
          <Field label="Các môn học buổi chiều (cách nhau dấu phẩy)" id="q-pm">
            <input id="q-pm" className="input" key={(cfg.afternoonSubjects || []).join('|')} defaultValue={(cfg.afternoonSubjects || []).join(', ')} onBlur={(e) => edit((c) => ({ ...c, afternoonSubjects: e.target.value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <p className="hint" style={{ marginTop: 8 }}>Mặc định: Mỹ thuật, Âm nhạc, Thể dục, Giáo dục địa phương. Hệ thống hiểu cả tên viết tắt (MT, Nhạc, GDTC, GDĐP).</p>
        </div>

        <div className="card">
          <div className="card-h"><h3>Ngày nghỉ và công bằng</h3></div>
          <Switch checked={!!cfg.options.useFairness} onChange={(v) => opt({ useFairness: v })} title="Dùng ngày nghỉ và công bằng giờ vào/ra">Tắt thì giáo viên không bị xếp ngày nghỉ riêng, trừ thầy cô bạn đã chọn ngày nghỉ cụ thể.</Switch>
          <Switch checked={!!cfg.options.requireExactQuota} onChange={(v) => opt({ requireExactQuota: v })} title="Báo đỏ khi giáo viên lệch định mức">Chỉ nhắc, vẫn cho xếp.</Switch>
          <div className="pl-grid2" style={{ marginTop: 6 }}>
            <Field label="Khi có giáo viên không thể nghỉ trọn 1 ngày" id="q-no">
              <select id="q-no" className="input" value={cfg.options.onNoDayOff} onChange={(e) => opt({ onNoDayOff: e.target.value })}><option value="warn">Cảnh báo và vẫn xếp</option><option value="stop">Dừng, không xếp</option></select>
            </Field>
            <Field label="Công bằng giờ vào / giờ ra" id="q-f">
              <select id="q-f" className="input" value={cfg.options.wFair} onChange={(e) => opt({ wFair: Number(e.target.value) })}><option value={0}>Tắt</option><option value={6}>Vừa</option><option value={12}>Mạnh (khuyên dùng)</option><option value={24}>Rất mạnh</option></select>
            </Field>
            <Field label="Độ kỹ khi xếp" id="q-e">
              <select id="q-e" className="input" value={cfg.options.effort} onChange={(e) => opt({ effort: Number(e.target.value) })}><option value={0}>Nhanh</option><option value={1}>Vừa</option><option value={2}>Kỹ</option><option value={3}>Rất kỹ (chậm)</option></select>
            </Field>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>“Công bằng” là làm cho số buổi vào tiết 1, ra cuối buổi, vào muộn, ra sớm của các giáo viên xấp xỉ nhau. Giáo viên thỉnh giảng có thể tắt “Tính công bằng” trong hồ sơ ở bước 1.</p>
        </div>

        <div className="card">
          <div className="card-h"><h3>Nhóm giáo viên dạy và ra về cùng nhau</h3></div>
          <p className="hint">Các giáo viên trong nhóm được xếp cùng ngày nghỉ và, ở những ngày cùng dạy, cùng giờ vào và giờ ra (theo mức có thể).</p>
          {cfg.carpool.length === 0 && <div className="empty" style={{ padding: 8 }}>Chưa có nhóm nào.</div>}
          {cfg.carpool.map((g, gi) => (
            <div key={gi} className="card" style={{ marginTop: 8, padding: 14 }}>
              <div className="row">
                <input className="input" style={{ width: 200 }} value={g.name} onChange={(e) => edit((c) => ({ ...c, carpool: c.carpool.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)) }))} aria-label="Tên nhóm" />
                <span className="hint" style={{ margin: 0 }}>{g.teachers.length} người</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => edit((c) => ({ ...c, carpool: c.carpool.filter((_, i) => i !== gi) }))}>Xóa nhóm</button>
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                {cfg.teachers.map((t) => {
                  const on = g.teachers.includes(t.name);
                  return <button key={t.name} type="button" aria-pressed={on} className={`pl-chipbtn ${on ? 'on' : ''}`} onClick={() => edit((c) => ({ ...c, carpool: c.carpool.map((x, i) => (i === gi ? { ...x, teachers: on ? x.teachers.filter((n) => n !== t.name) : [...x.teachers, t.name] } : x)) }))}>{t.name}</button>;
                })}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => edit((c) => ({ ...c, carpool: [...c.carpool, { name: `Nhóm ${c.carpool.length + 1}`, teachers: [] }] }))}>＋ Thêm nhóm đi cùng</button>
        </div>
      </div>
    </>
  );
}
