"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// Thoi gian popup tu dong tat (ms)
const TOAST_DURATION = 5000;

export default function NotificationBell({ studentId }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [ring, setRing] = useState(false);
  const shownRef = useRef(new Set()); // tránh hiện popup 2 lần cho cùng 1 thông báo
  const audioCtxRef = useRef(null);
  const [debugErr, setDebugErr] = useState(null);

  const unread = list.filter((n) => !n.is_read).length;

  const playDing = useCallback((isPositive) => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const notes = isPositive ? [880, 1320] : [660, 523];

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.0001, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.4);
      });
    } catch {
      // Mot so trinh duyet chan am thanh khi chua co tuong tac - bo qua, khong lam vo giao dien
    }
  }, []);

  const showToast = useCallback(
    (n) => {
      if (shownRef.current.has(n.id)) return;
      shownRef.current.add(n.id);
      setToast(n);
      setRing(true);
      playDing((n.xp_amount ?? 0) >= 0);
      setTimeout(() => setRing(false), 800);
      setTimeout(() => setToast((cur) => (cur?.id === n.id ? null : cur)), TOAST_DURATION);
    },
    [playDing]
  );

  // Ham dung chung: tai thong bao tu server, cap nhat danh sach, va bat popup
  // cho thong bao MOI (chua tung hien) neu co. Day la nguon du lieu "chinh",
  // khong phu thuoc vao Realtime (mot so mang truong hoc chan ket noi kieu nay).
  const fetchAndMaybeToast = useCallback(async () => {
    if (!studentId) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setDebugErr(error.message || JSON.stringify(error));
      console.error("Lỗi tải thông báo:", error);
      return;
    }
    setDebugErr(null);
    if (!data) return;
    setList(data);
    const latestUnread = data.find((n) => !n.is_read && !shownRef.current.has(n.id));
    if (latestUnread) {
      showToast(latestUnread);
    }
  }, [studentId, showToast]);

  // Tai lan dau khi vao trang
  useEffect(() => {
    if (!studentId) return;
    setTimeout(() => fetchAndMaybeToast(), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Du phong: cu 20 giay tu kiem tra lai 1 lan bang API thuong (khong dung
  // Realtime) - dam bao khong bao gio bo lo thong bao moi du mang co chan
  // websocket hay khong.
  useEffect(() => {
    if (!studentId) return;
    const id = setInterval(fetchAndMaybeToast, 20000);
    return () => clearInterval(id);
  }, [studentId, fetchAndMaybeToast]);

  // Lắng nghe realtime: có thông báo mới trong lúc đang mở web -> hiện popup ngay
  // (chi la lop "nhanh hon" - neu mang chan realtime thi da co polling ben tren lo)
  useEffect(() => {
    if (!studentId) return;
    const channel = supabase
      .channel("notif-" + studentId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          setList((cur) => (cur.some((n) => n.id === payload.new.id) ? cur : [payload.new, ...cur]));
          showToast(payload.new);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [studentId, showToast]);

  const openPanel = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (!willOpen) return;
    // Luon tai lai moi khi mo chuong, khong chi dua vao du lieu da co san
    // trong bo nho trinh duyet - tranh tinh trang "mo ra khong thay gi".
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      setDebugErr(error.message || JSON.stringify(error));
      console.error("Lỗi tải thông báo:", error);
      return;
    }
    setDebugErr(null);
    if (!data) return;
    setList(data);
    const unreadIds = data.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
      setList((cur) => cur.map((n) => (unreadIds.includes(n.id) ? { ...n, is_read: true } : n)));
    }
  };

  const iconFor = (amount) => {
    if (amount === null || amount === undefined) return "📢";
    return amount < 0 ? "📉" : "🌟";
  };

  const deleteOne = async (id) => {
    setList((cur) => cur.filter((n) => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id).eq("student_id", studentId);
  };

  const deleteAll = async () => {
    if (list.length === 0) return;
    if (!window.confirm("Xoá tất cả thông báo? Không thể hoàn tác.")) return;
    setList([]);
    await supabase.from("notifications").delete().eq("student_id", studentId);
  };

  const isUp = (toast?.xp_amount ?? 0) >= 0;

  return (
    <div className="notif-wrap">
      <button className={`bell ${ring ? "ring" : ""}`} onClick={openPanel} aria-label="Thông báo">
        🔔
        {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="panel">
          <div className="panel-header">
            <span>🔔 Thông báo của em</span>
            <div className="panel-header-actions">
              {list.length > 0 && (
                <button className="clear-all" onClick={deleteAll} title="Xoá tất cả">
                  Xoá hết
                </button>
              )}
              <button className="panel-close" onClick={() => setOpen(false)} aria-label="Đóng">
                ✕
              </button>
            </div>
          </div>
          {debugErr && (
            <div style={{ padding: "10px 16px", background: "#fff1ee", color: "#c0392b", fontSize: 12.5 }}>
              Lỗi tải thông báo: {debugErr}
            </div>
          )}
          {list.length === 0 && !debugErr && (
            <div className="empty">Chưa có thông báo nào, cố lên nhé! 🌱</div>
          )}
          <div className="panel-list">
            {list.map((n) => (
              <div key={n.id} className={`item ${n.is_read ? "" : "unread"}`}>
                <div className="item-icon">{iconFor(n.xp_amount)}</div>
                <div className="item-body">
                  <div className="item-title">{n.title}</div>
                  {n.content && <div className="item-content">{n.content}</div>}
                  <div className="item-time">{new Date(n.created_at).toLocaleString("vi-VN")}</div>
                </div>
                <button className="item-delete" onClick={() => deleteOne(n.id)} aria-label="Xoá thông báo" title="Xoá">
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          className={`toast ${
            toast.xp_amount === null || toast.xp_amount === undefined
              ? "toast-info"
              : isUp
              ? "toast-up"
              : "toast-down"
          }`}
        >
          {toast.xp_amount > 0 && (
            <div className="sparkles" aria-hidden="true">
              <span>✨</span><span>⭐</span><span>✨</span><span>🌟</span>
            </div>
          )}
          <div className="toast-emoji">
            {toast.xp_amount === null || toast.xp_amount === undefined ? "📢" : isUp ? "🎉" : "📌"}
          </div>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.content && <div className="toast-content">{toast.content}</div>}
            {toast.xp_amount !== null && toast.xp_amount !== undefined && (
              <div className={`toast-xp ${isUp ? "" : "toast-xp-down"}`}>
                {isUp ? "+" : ""}
                {toast.xp_amount} KN
              </div>
            )}
          </div>
          <button className="toast-close" aria-label="Đóng thông báo" onClick={() => setToast(null)}>
            ✕
          </button>
          <div className="toast-progress" />
        </div>
      )}

      <style jsx>{`
        .notif-wrap { position: relative; display: inline-block; }

        .bell {
          position: relative; border: none; background: rgba(255,255,255,0.14);
          font-size: 21px; line-height: 1; cursor: pointer; padding: 9px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.28);
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .bell:hover { background: rgba(255,255,255,0.24); transform: translateY(-1px); }
        .bell.ring { animation: swing 0.6s ease; }
        @keyframes swing {
          0%,100% { transform: rotate(0deg); }
          20% { transform: rotate(-18deg); }
          40% { transform: rotate(14deg); }
          60% { transform: rotate(-8deg); }
          80% { transform: rotate(4deg); }
        }
        .badge {
          position: absolute; top: -2px; right: -2px;
          background: linear-gradient(135deg,var(--coral,#ff6b4d),var(--gold,#e8af2e));
          color: #fff; font-size: 11px; font-weight: 700;
          border-radius: 999px; padding: 1px 6px; min-width: 18px;
          text-align: center; box-shadow: 0 2px 6px rgba(255,107,77,0.5);
          border: 2px solid var(--bg-deep2, #124e80);
        }

        .backdrop { display: none; }

        .panel {
          position: fixed; top: 80px; right: 20px; width: 320px; max-height: 420px;
          overflow: hidden; display: flex; flex-direction: column;
          background: var(--card, #fff); border-radius: var(--radius-lg, 18px);
          box-shadow: 0 18px 40px -12px rgba(15,42,68,0.35); z-index: 250;
          border: 1px solid var(--line, #d9e7f5);
          animation: slideDown 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .panel-header {
          padding: 12px 8px 12px 16px; font-weight: 700; font-family: 'Baloo 2', sans-serif;
          font-size: 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: linear-gradient(135deg, var(--bg-deep, #0b3c63), var(--ocean, #1b6fb8));
        }
        .panel-header-actions { display: flex; align-items: center; gap: 4px; }
        .clear-all {
          border: 1px solid rgba(255,255,255,0.45); background: rgba(255,255,255,0.12); color: #fff;
          font-size: 11.5px; font-weight: 600; border-radius: 999px; padding: 4px 10px; cursor: pointer;
          white-space: nowrap; transition: background 0.15s ease;
        }
        .clear-all:hover { background: rgba(255,255,255,0.24); }
        .panel-close {
          border: none; background: transparent; color: #fff; opacity: 0.85;
          font-size: 14px; cursor: pointer; padding: 4px 6px; line-height: 1;
        }
        .panel-close:hover { opacity: 1; }
        .panel-list { overflow-y: auto; }
        .empty { padding: 28px 16px; text-align: center; color: var(--ink-faint, #93aac4); font-size: 14px; }
        .item { padding: 12px 16px; border-bottom: 1px solid var(--line, #eef4fb); display: flex; gap: 10px; align-items: flex-start; }
        .item.unread { background: var(--ocean-tint, #eaf4fc); }
        .item-icon { font-size: 18px; margin-top: 1px; }
        .item-body { flex: 1; min-width: 0; }
        .item-title { font-weight: 700; font-size: 13.5px; color: var(--ink, #0f2a44); }
        .item-content { font-size: 12.5px; color: var(--ink-soft, #4e6a88); margin-top: 2px; line-height: 1.4; }
        .item-time { font-size: 11px; color: var(--ink-faint, #93aac4); margin-top: 4px; }
        .item-delete {
          border: none; background: transparent; color: var(--ink-faint, #b7c4d6);
          font-size: 13px; cursor: pointer; padding: 3px 4px; border-radius: 6px; line-height: 1;
          transition: color 0.15s ease, background 0.15s ease; flex: none;
        }
        .item-delete:hover { color: var(--coral, #ff6b4d); background: rgba(255,107,77,0.1); }

        .toast {
          position: fixed; top: 20px; right: 20px; z-index: 200;
          display: flex; gap: 12px; align-items: flex-start;
          background: var(--card, #fff); border-radius: 18px; padding: 16px 32px 18px 16px;
          box-shadow: 0 20px 44px -10px rgba(15,42,68,0.4); max-width: 340px;
          overflow: hidden;
          animation: popIn 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                     fadeOut 0.4s cubic-bezier(0.4, 0, 1, 1) ${TOAST_DURATION - 400}ms forwards;
        }
        .toast-up {
          border: 1.5px solid var(--gold, #e8af2e);
          background: linear-gradient(180deg, #fff 0%, #fffaf0 100%);
        }
        .toast-down { border: 1.5px solid var(--coral, #ff6b4d); }
        .toast-info { border: 1.5px solid var(--ocean, #1b6fb8); }
        .toast-emoji { font-size: 30px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12)); }
        .toast-body { flex: 1; min-width: 0; }
        .toast-title {
          font-weight: 700; font-size: 14.5px; font-family: 'Baloo 2', sans-serif;
          color: var(--ink, #0f2a44);
        }
        .toast-content { font-size: 13px; color: var(--ink-soft, #4e6a88); margin-top: 3px; line-height: 1.4; }
        .toast-xp {
          display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px;
          font-weight: 800; font-size: 13px; color: #fff;
          background: linear-gradient(135deg, var(--gold-dark,#b9820e), var(--gold,#e8af2e));
          box-shadow: 0 3px 8px rgba(232,175,46,0.4);
          animation: popNum 0.4s ease 0.15s both;
        }
        .toast-xp-down { background: linear-gradient(135deg,#c94a34, var(--coral,#ff6b4d)); box-shadow: 0 3px 8px rgba(255,107,77,0.4); }
        @keyframes popNum { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .toast-close {
          position: absolute; top: 8px; right: 10px;
          border: none; background: transparent; color: var(--ink-faint, #bbb);
          font-size: 13px; cursor: pointer; padding: 4px; line-height: 1;
          transition: color 0.15s ease;
        }
        .toast-close:hover { color: var(--ink-soft, #666); }
        .toast-progress {
          position: absolute; left: 0; bottom: 0; height: 3px; width: 100%;
          background: linear-gradient(90deg, var(--gold,#e8af2e), var(--coral,#ff6b4d));
          transform-origin: left;
          animation: shrink ${TOAST_DURATION}ms linear forwards;
        }

        .sparkles { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
        .sparkles span {
          position: absolute; font-size: 14px; opacity: 0;
          animation: sparkleFly 1.1s ease-out forwards;
        }
        .sparkles span:nth-child(1) { left: 18%; top: 10%; animation-delay: 0.05s; }
        .sparkles span:nth-child(2) { left: 55%; top: 4%;  animation-delay: 0.15s; }
        .sparkles span:nth-child(3) { left: 78%; top: 14%; animation-delay: 0.25s; }
        .sparkles span:nth-child(4) { left: 38%; top: 8%;  animation-delay: 0.35s; }
        @keyframes sparkleFly {
          0% { opacity: 0; transform: translateY(6px) scale(0.4) rotate(0deg); }
          35% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-26px) scale(1.1) rotate(35deg); }
        }

        @keyframes popIn {
          from { opacity: 0; transform: translateX(48px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(24px) scale(0.96); }
        }
        @keyframes shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .toast {
            animation: popIn 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                       fadeOut 0.4s cubic-bezier(0.4, 0, 1, 1) ${TOAST_DURATION - 400}ms forwards !important;
          }
          .toast-progress { animation: shrink ${TOAST_DURATION}ms linear forwards !important; }
        }

        @media (max-width: 480px) {
          .panel { width: 88vw; right: 6px; top: 70px; }
          .toast { left: 12px; right: 12px; max-width: none; top: 12px; }
        }
      `}</style>
    </div>
  );
}
