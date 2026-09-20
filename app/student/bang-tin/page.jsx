'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { addDays, fmtDate, fmtIso, mondayOf, vnTodayIso } from '@/lib/dates';
import { useStudent } from '../layout';

const KIND_LABEL = { week_plan: 'Kế hoạch tuần', notice: 'Thông báo' };

export default function BangTinPage() {
  const { profile } = useStudent();
  const classId = profile.class_id || null;
  const monday = mondayOf(vnTodayIso());
  const friday = addDays(monday, 4);
  const [items, setItems] = useState(null);
  const [duties, setDuties] = useState([]);

  const load = useCallback(async () => {
    const [a, d] = await Promise.all([
      supabase
        .from('announcements')
        .select('id, kind, title, body, week_start, class_id, pinned, created_at, classes(name)')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.rpc('get_duty_range', { p_from: monday, p_to: friday }),
    ]);
    setItems(a.error ? [] : a.data || []);
    setDuties(d.error ? [] : d.data || []);
  }, [monday, friday]);

  useEffect(() => {
    load();
  }, [load]);

  // Kế hoạch của tuần này; nếu chưa có thì lấy kế hoạch mới nhất
  const plan = useMemo(() => {
    const plans = (items || []).filter((x) => x.kind === 'week_plan');
    return plans.find((x) => x.week_start === monday) || plans[0] || null;
  }, [items, monday]);
  const isThisWeek = plan && plan.week_start === monday;
  const others = useMemo(() => (items || []).filter((x) => !plan || x.id !== plan.id), [items, plan]);

  const days = useMemo(() => [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), [monday]);
  const myDuties = duties.filter((d) => d.class_id === classId);

  return (
    <>
      <style jsx>{`
        .box { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: 18px 20px; margin-bottom: 20px; }
        .box h3 { margin: 0; font-size: 18px; }
        .plan { border-left: 5px solid #c4262e; }
        .tag { display: inline-block; font-size: 11px; font-weight: 800; border-radius: 999px; padding: 2px 10px; margin-right: 6px; background: var(--ocean-tint); color: var(--ocean-dark); }
        .tag.red { background: #fdeceb; color: #a71d24; }
        .tag.pin { background: #fff4dc; color: #8a5b0a; }
        .body { white-space: pre-wrap; font-size: 14.5px; line-height: 1.6; margin: 10px 0 0; }
        .meta { color: var(--ink-soft); font-size: 12px; margin-top: 10px; }
        .ttl { font-family: 'Baloo 2', sans-serif; font-size: 19px; font-weight: 700; margin: 8px 0 0; line-height: 1.25; }
        .duty-note { background: #fff4dc; color: #7a4d00; border-radius: 12px; padding: 10px 14px; font-weight: 700; font-size: 13.5px; margin: 10px 0 0; }
        .dgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
        .dcell { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
        .dcell.today { border-color: #c4262e; background: #fff8f7; }
        .dcell h4 { margin: 0 0 6px; font-size: 13px; }
        .dline { font-size: 13px; padding: 2px 0; }
        .dline.mine { font-weight: 800; color: #a71d24; }
        .dline small { color: var(--ink-soft); }
      `}</style>

      <h2 className="section-title">Bảng tin</h2>
      <p className="section-sub">Kế hoạch tuần, thông báo của cô Tổng phụ trách Đội và lịch trực nhật.</p>

      <div className={`box ${plan ? 'plan' : ''}`}>
        <h3>{isThisWeek ? 'Kế hoạch tuần này' : plan ? 'Kế hoạch gần nhất' : 'Kế hoạch tuần'}</h3>
        {items === null ? (
          <div className="empty-note">Đang tải…</div>
        ) : !plan ? (
          <div className="empty-note">Cô Tổng phụ trách chưa đăng kế hoạch tuần.</div>
        ) : (
          <>
            <div className="ttl">{plan.title}</div>
            <div className="meta">
              {plan.week_start ? `Tuần ${fmtDate(plan.week_start)} – ${fmtDate(addDays(plan.week_start, 6))}` : ''}
              {plan.classes?.name ? ` · Riêng lớp ${plan.classes.name}` : ''}
            </div>
            <p className="body">{plan.body}</p>
          </>
        )}
      </div>

      <div className="box">
        <h3>Lớp trực nhật tuần này</h3>
        {myDuties.length > 0 && (
          <div className="duty-note">
            Lớp em trực nhật: {myDuties.map((d) => `${fmtIso(d.duty_date)} (${d.area})`).join(' · ')}
          </div>
        )}
        {duties.length === 0 ? (
          <div className="empty-note">Chưa có lịch trực nhật cho tuần này.</div>
        ) : (
          <div className="dgrid">
            {days.map((iso) => {
              const list = duties.filter((d) => d.duty_date === iso);
              return (
                <div key={iso} className={`dcell ${iso === vnTodayIso() ? 'today' : ''}`}>
                  <h4>{fmtIso(iso)}{iso === vnTodayIso() ? ' · Hôm nay' : ''}</h4>
                  {list.length === 0 ? (
                    <div className="dline"><small>—</small></div>
                  ) : (
                    list.map((d) => (
                      <div key={d.id} className={`dline ${d.class_id === classId ? 'mine' : ''}`}>
                        Lớp {d.class_name} <small>{d.area}</small>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h3 style={{ margin: '28px 0 12px', fontSize: 18 }}>Thông báo</h3>
      {items !== null && others.length === 0 && <div className="empty-note">Chưa có thông báo nào.</div>}
      {others.map((a) => (
        <div className="box" key={a.id}>
          <div>
            <span className={`tag ${a.kind === 'week_plan' ? 'red' : ''}`}>{KIND_LABEL[a.kind]}</span>
            {a.pinned && <span className="tag pin">Ghim</span>}
            {a.classes?.name && <span className="tag">Riêng lớp {a.classes.name}</span>}
          </div>
          <div className="ttl">{a.title}</div>
          <p className="body">{a.body}</p>
          <div className="meta">
            {new Date(a.created_at).toLocaleString('vi-VN')}
            {a.kind === 'week_plan' && a.week_start ? ` · Tuần ${fmtDate(a.week_start)}` : ''}
          </div>
        </div>
      ))}
    </>
  );
}
