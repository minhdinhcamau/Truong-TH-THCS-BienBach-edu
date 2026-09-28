'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

// Chuong khieu nai o dau moi trang TPT (gan trong AppShell): dem so khieu nai dang cho
// (ca 2 he thong: diem lop cua TPT/Sao do, va vi pham ca nhan cua ban can su/GVCN), phat
// 1 tieng "keng" ngan (~0.18s), da tao san duoi dang WAV base64 hop le - khong can tai
// file rieng, khong phu thuoc mang ngoai.
const BEEP = 'data:audio/wav;base64,UklGRsQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAFAAB/0PzurlgUAil3yfjwtGAaAyVvwfTyumghBSFouvDywHAnBx5hsuvzxXgtCRtaq+fzyn80DBhUo+HyzoY7DxdOnNzx0o1CExVIlNbw1pRJFxVDjdDu2ZtQGxQ+hsrs26FXIBQ6f8Tp3qdeJBU2eL7m36xlKRYycrfj4LFrLxcvbLHf4bZyNBksZqrb4rt5OhsqYKTX4b9/Px0oWp7T4cOFRSAmVZfO4MaLSyMlUZHJ38mRUSYkTIvE3cuWVyokSIW/286cXS4kRH+62c+hYzIlQXm019GlaTYlPnSv1NKqbjsnO26p0dKudD8oOWmkzdOyekQqN2WeytO1f0ksNWCZxtK4hE4uNFyUwtK7iVMxM1iOvtG+jlg0MlSJus/Ak103MlCEtc7Cl2I6Mk1/sczDnGc+Mkp6rMrEoGxBM0d1qMfFo3FFNEVxo8TGp3ZJNUNtnsLGqnpNN0Fpmr/GrX9ROEBllbvGsINVOj9hkbjFsohZPT5djLTEtIxePz5aiLHDtpBiQj1Xg63CuJRmRD1Vf6nAuZdrRz5Se6W+uptvSj5Qd6K8u55zTj9Oc566u6F3UUBMb5q4vKR7VEFLbJa1u6Z/WENJaZKyu6iDXEVJZY6vu6uGX0dIYoqsuqyKY0lHYIapua6NZktHXYOmuK+Rak1HW3+jtrCUblBIWXugtbGXcVJIV3ics7KZdVVJVXWZsbKceFhKVHKWr7KefFtLU2+SrbKgf15MUmyPq7KigmFNUWmMqLKkhWRPUGeIprGmiGdRUGSFo7Cni2pTUGKCoK+ojm1VUGB/nq6pkXBXUF98m62qk3NZUF15mKuqlXZbUVt2laqrmHleUlp0kqirmXxgU1lxj6arm39jVFhvjaSqnYJlVVhtiqKqnoRoVldqh6CqoIdrWFdohJ6poYltWVdngpuoooxwW1dlf5mno45yXVdjfJemo5B1X1diepSlpJJ4YVhheJKjpJR6Y1hgdY+ipJZ9ZVlfc42gpJd/Z1pecYufpJiBaVteb4idpJqEa1xdbYabo5uGbl5dbIOZo5yIcF9daoGXop2KcmBdaX+VoZ2MdGJdaH2ToJ6Nd2RdZnuRn56PeWVeZXmPnp6Re2deZHeNnZ+SfWlfZHWLm5+Tf2tgY3OJmp6VgWxhY3KHmJ6Wg25iYnCFl56XhXBjYm+DlZ2Xh3JkYm2Bk52YiHRlYmx/kpyZinZmYmt9kJuZi3hoYmp7jpqajXppY2l6jZmajntrY2h4i5iaj31sZGh3iZeakH9uZGd1h5aakYFvZWd0hpWZkoJxZmdyhJOZk4RyZ2ZxgpKZlIV0aGZwgZCYlId2aWZvf4+YlYh3amZufY6XlYl5a2dtfIyWlot6bGdseouVlox8bmdseYmUlo1+b2hreIiTlo5/cGhrd4aSlo+AcmlqdYWRlo+Cc2pqdIOQlZCDdGpqc4KPlZGEdmtqcoCOlJGGd2xqcX+NlJKHeG1qcX6Lk5KIem5qcHyKk5KJe29rb3uJkpKKfHBrb3qIkZKLfnFrbnmGkJKMf3JsbniFj5KMgHRsbneEj5KNgXVtbXaDjpKOg3ZubXWBjZKOhHdubXSAjJGOhXhvbXN/i5GPhnlwbXN+iZCPh3txbXJ9iJCPh3xybnJ8h4+PiH1ybnF7ho6PiX5zbnF6hY6Pin90b3B5hI2PioB1b3B4g4yPi4F2cHB3gouPi4J3cHB2gYuPjIN4cXB2gIqOjIR5cXB1f4mOjIV6cnB1foiOjYV7c3B0fYeNjYZ8dHB0fIaNjYd9dHBze4WMjYd+dXFze4SMjYh/dnFzeoOLjYmAd3FyeYKKjYmBeHJyeIKKjYqCeHJyeIGJjIqCeXNyd4CIjIqDenNyd3+HjIqEe3Rydn6Hi4uEfHVydn2Gi4uFfXVydX2Fi4uGfXZzdXyEios=';

export default function AppealAlert() {
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(null); // { text } - banh mieng khi co khieu nai moi
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const seenIds = useRef(null); // null = lan dau, chua co gi de so sanh -> khong phat am thanh
  const audioRef = useRef(null);
  const flashTimer = useRef(null);

  const poll = useCallback(async () => {
    const { data, error } = await supabase.rpc('tpt_pending_appeals_summary', { p_limit: 10 });
    if (error || !data) return;
    setCount(data.count || 0);
    setItems(data.items || []);

    const ids = new Set((data.items || []).map((x) => x.id));
    if (seenIds.current) {
      const fresh = (data.items || []).filter((x) => !seenIds.current.has(x.id));
      if (fresh.length > 0) {
        audioRef.current?.play().catch(() => {}); // trinh duyet co the chan tu phat neu chua co tuong tac nao - bo qua loi
        const f = fresh[0];
        clearTimeout(flashTimer.current);
        setFlash({
          text: fresh.length === 1
            ? `Khiếu nại mới: ${f.student_name || '—'} · ${f.reason_label} (lớp ${f.class_name})`
            : `${fresh.length} khiếu nại mới, gần nhất: ${f.student_name || '—'} (lớp ${f.class_name})`,
        });
        flashTimer.current = setTimeout(() => setFlash(null), 8000);
      }
    }
    seenIds.current = ids;
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  return (
    <div style={{ position: 'relative' }}>
      <audio ref={audioRef} src={BEEP} preload="auto" />
      <button
        onClick={() => setOpen((v) => !v)}
        className="out-btn"
        aria-label={`Khiếu nại đang chờ: ${count}`}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        🔔 Khiếu nại
        {count > 0 && (
          <span
            style={{
              background: '#fff', color: '#c4262e', borderRadius: 999, fontSize: 11, fontWeight: 800,
              minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {flash && (
        <div
          role="status"
          style={{
            position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
            background: '#1b2430', color: '#fff', padding: '10px 18px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, boxShadow: '0 10px 26px -8px rgba(0,0,0,0.4)',
            maxWidth: 'calc(100% - 32px)', textAlign: 'center',
          }}
        >
          🔔 {flash.text}
        </div>
      )}

      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: '110%', width: 320, maxWidth: '90vw', background: '#fff',
            color: '#1b2430', borderRadius: 12, boxShadow: '0 14px 34px -10px rgba(0,0,0,0.35)', zIndex: 400,
            border: '1px solid #e2e7ee', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #eef1f5', fontWeight: 800, fontSize: 13.5 }}>
            Khiếu nại đang chờ ({count})
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: 14, color: '#627083', fontSize: 13 }}>Không có khiếu nại nào đang chờ. 🎉</div>
            ) : (
              items.map((it) => (
                <Link
                  key={it.id}
                  href={it.kind === 'class' ? '/tpt/khieu-nai' : '/teacher/khieu-nai'}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block', padding: '9px 14px', borderBottom: '1px solid #f3f5f8',
                    textDecoration: 'none', color: 'inherit', fontSize: 12.5,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{it.student_name || 'Cả lớp'} · Lớp {it.class_name}</div>
                  <div style={{ color: '#627083' }}>
                    {it.reason_label} · {it.kind === 'class' ? 'Điểm lớp (TPT)' : 'Cá nhân (GVCN)'}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
