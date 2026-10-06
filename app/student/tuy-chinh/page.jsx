'use client';
// app/student/tuy-chinh/page.jsx — Tùy chỉnh khung avatar và khung bài đăng/bình luận. Chỉ chọn được khung đã mở khóa theo hạng.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import AvatarFrame from '../../../components/AvatarFrame';
import { AVATAR_FRAMES, CHAT_FRAMES, levelOfXp, rankNameOfLevel, resolveAvatar, resolveChat } from '../../../lib/cosmetics';
import { useStudent } from '../layout';

const Lock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function TuyChinhPage() {
  const { profile, stats, refresh } = useStudent();
  const level = levelOfXp(stats.total_xp);
  const [selA, setSelA] = useState(null);
  const [selC, setSelC] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('student_cosmetics').select('avatar_frame, chat_frame').eq('student_id', profile.id).maybeSingle();
      setSelA(resolveAvatar(level, data?.avatar_frame));
      setSelC(resolveChat(level, data?.chat_frame));
      setReady(true);
    })();
  }, [profile.id, level]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.rpc('cosmetics_set', { p_avatar: selA, p_chat: selC });
    setSaving(false);
    if (!error) refresh?.();
    setMsg(error ? { ok: false, t: error.message.includes('cosmetics_set') ? 'Chưa chạy SQL gói T trên Supabase.' : error.message } : { ok: true, t: 'Đã lưu. Bạn bè sẽ thấy khung mới ngay trên bài đăng của em.' });
  }

  if (!ready) return <div className="tc"><p style={{ color: '#52708f' }}>Đang tải…</p></div>;

  return (
    <div className="tc">
      <header>
        <h2>Tùy chỉnh khung</h2>
        <p>Hạng hiện tại của em: <b>{rankNameOfLevel(level)}</b>. Lên hạng cao hơn để mở thêm khung đẹp hơn.</p>
      </header>

      <section className="tc-card tc-preview" aria-label="Xem trước">
        <div className="tc-pv-h">Xem trước</div>
        <div className="tc-pv-post" data-cf={selC && selC !== 'none' ? selC : undefined}>
          <div className="tc-pv-row">
            <AvatarFrame src={profile.photo_url} name={profile.full_name} xp={stats.total_xp} frame={selA || level} size={76} />
            <div>
              <b>{profile.full_name}</b>
              <small>Vừa xong · Lớp {profile.classes?.name || '—'}</small>
            </div>
          </div>
          <p>Bài này giúp em xem khung đang chọn trông như thế nào.</p>
          <div className="tc-pv-reply" data-cf={selC && selC !== 'none' ? selC : undefined}><b>{profile.full_name}</b><span>Đây là khung bình luận của em.</span></div>
        </div>
      </section>

      <section className="tc-card">
        <h3>Khung ảnh đại diện</h3>
        <div className="tc-grid">
          {AVATAR_FRAMES.map((f) => {
            const locked = f.minLevel > level;
            return (
              <button key={f.id} type="button" disabled={locked} className={`tc-opt ${selA === f.id ? 'on' : ''} ${locked ? 'lock' : ''}`} onClick={() => setSelA(f.id)} aria-pressed={selA === f.id}>
                <AvatarFrame src={profile.photo_url} name={profile.full_name} frame={f.id} size={72} />
                <b>{f.name}</b>
                {locked ? <span className="tc-need"><Lock /> Cần đạt {rankNameOfLevel(f.minLevel)}</span> : <span className="tc-ok">{selA === f.id ? 'Đang dùng' : 'Đã mở khóa'}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="tc-card">
        <h3>Khung bài đăng và bình luận</h3>
        <div className="tc-grid tc-grid-c">
          {CHAT_FRAMES.map((f) => {
            const locked = f.minLevel > level;
            return (
              <button key={f.id} type="button" disabled={locked} className={`tc-opt ${selC === f.id ? 'on' : ''} ${locked ? 'lock' : ''}`} onClick={() => setSelC(f.id)} aria-pressed={selC === f.id}>
                <div className="tc-mini" data-cf={f.id === 'none' ? undefined : f.id}><i /><i /><i /></div>
                <b>{f.name}</b>
                <small>{f.desc}</small>
                {locked ? <span className="tc-need"><Lock /> Cần đạt {rankNameOfLevel(f.minLevel)}</span> : <span className="tc-ok">{selC === f.id ? 'Đang dùng' : 'Đã mở khóa'}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="tc-bar">
        {msg && <span className={`tc-msg ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</span>}
        <button className="tc-save" onClick={save} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu lựa chọn'}</button>
      </div>

      <style jsx>{`
        .tc { display: grid; gap: 14px; padding-bottom: 84px; }
        header h2 { margin: 0 0 4px; font-size: 22px; color: #173f6b; }
        header p { margin: 0; font-size: 14px; color: #52708f; }
        .tc-card { background: #fff; border: 1px solid #d3e4f6; border-radius: 18px; padding: 16px; box-shadow: 0 8px 24px -20px rgba(40, 90, 150, .6); }
        .tc-card h3 { margin: 0 0 12px; font-size: 16px; color: #173f6b; }
        .tc-pv-h { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #6a86a4; margin-bottom: 10px; }
        .tc-pv-post { background: #fff; border-radius: 16px; padding: 14px; border: 1px solid #d3e4f6; }
        .tc-pv-row { display: flex; align-items: center; gap: 10px; }
        .tc-pv-row small { display: block; color: #6a86a4; font-size: 12px; }
        .tc-pv-post p { margin: 10px 0; font-size: 14px; color: #243b53; }
        .tc-pv-reply { background: #eaf2fc; border-radius: 14px; padding: 9px 12px; font-size: 13px; display: grid; gap: 2px; border: 1px solid #d3e4f6; }
        .tc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .tc-grid-c { grid-template-columns: repeat(2, 1fr); }
        .tc-opt { display: grid; justify-items: center; align-content: start; gap: 4px; padding: 12px 8px; text-align: center; background: #f6faff; border: 2px solid #d3e4f6; border-radius: 16px; cursor: pointer; font: inherit; color: #173f6b; min-height: 44px; }
        .tc-opt small { font-size: 11.5px; color: #6a86a4; }
        .tc-opt b { font-size: 13px; }
        .tc-opt.on { border-color: #2f7fd1; background: #e8f3ff; box-shadow: 0 0 0 3px rgba(47, 127, 209, .18); }
        .tc-opt.lock { cursor: not-allowed; background: #f1f4f8; }
        .tc-opt.lock :global(.afr), .tc-opt.lock .tc-mini { filter: grayscale(.85); opacity: .55; }
        .tc-need { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: #8a6d1d; background: #fff4d6; border-radius: 999px; padding: 3px 9px; }
        .tc-ok { font-size: 11.5px; font-weight: 700; color: #1d7a4d; }
        .tc-mini { width: 100%; max-width: 150px; height: 54px; border-radius: 12px; background: #fff; padding: 10px; display: grid; gap: 5px; align-content: center; border: 2px solid #d3e4f6; }
        .tc-mini i { display: block; height: 5px; border-radius: 3px; background: #dbe5f1; }
        .tc-mini i:nth-child(2) { width: 70%; } .tc-mini i:nth-child(3) { width: 45%; }
        .tc-bar { position: fixed; left: 0; right: 0; bottom: calc(68px + env(safe-area-inset-bottom)); z-index: 20; display: flex; gap: 10px; align-items: center; justify-content: flex-end; padding: 10px 14px; background: rgba(255, 255, 255, .92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-top: 1px solid #d3e4f6; }
        .tc-save { min-height: 44px; padding: 0 22px; border: 0; border-radius: 999px; background: linear-gradient(135deg, #2f7fd1, #1f5a96); color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }
        .tc-save:disabled { opacity: .6; }
        .tc-msg { flex: 1; font-size: 13px; line-height: 1.3; }
        .tc-msg.ok { color: #1d7a4d; } .tc-msg.bad { color: #c0392b; }
        @media (min-width: 901px) {
          .tc { max-width: 760px; margin: 0 auto; padding-bottom: 90px; }
          .tc-bar { bottom: 0; } .tc-grid { grid-template-columns: repeat(6, 1fr); } .tc-grid-c { grid-template-columns: repeat(5, 1fr); }
        }
        @media (max-width: 380px) { .tc-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
