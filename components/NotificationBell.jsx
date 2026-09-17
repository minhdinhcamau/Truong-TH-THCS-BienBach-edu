"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// Thoi gian popup tu dong tat (ms)
const TOAST_DURATION = 4500;

export default function NotificationBell({ studentId }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [ring, setRing] = useState(false);
  const audioCtxRef = useRef(null);

  const unread = list.filter((n) => !n.is_read).length;

  // Tải thông báo cũ khi vào trang
  useEffect(() => {
    if (!studentId) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => data && setList(data));
  }, [studentId]);

  // Phat am thanh "ting" bang Web Audio API - khong can file mp3
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
      setToast(n);
      setRing(true);
      playDing((n.xp_amount ?? 0) >= 0);
      setTimeout(() => setRing(false), 800);
      setTimeout(() => setToast((cur) => (cur?.id === n.id ? null : cur)), TOAST_DURATION);
    },
    [playDing]
  );

  // Lắng nghe realtime: có thông báo mới -> hiện popup + đẩy vào danh sách
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
          setList((cur) => [payload.new, ...cur]);
          showToast(payload.new);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [studentId, showToast]);

  const openPanel = async () => {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("student_id", studentId)
        .eq("is_read", false);
      setList((cur) => cur.map((n) => ({ ...n, is_read: true })));
    }
  };

  return (
    <div className="notif-wrap">
      <button className={`bell ${ring ? "ring" : ""}`} onClick={openPanel} aria-label="Thông báo">
        🔔
        {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="panel">
          <div className="panel-header">Thông báo của em</div>
          {list.length === 0 && <div className="empty">Chưa có thông báo nào 🌱</div>}
          {list.map((n) => (
            <div key={n.id} className={`item ${n.is_read ? "" : "unread"}`}>
              <div className="item-title">{n.title}</div>
              {n.content && <div className="item-content">{n.content}</div>}
              <div className="item-time">
                {new Date(n.created_at).toLocaleString("vi-VN")}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          className={`toast ${(toast.xp_amount ?? 0) < 0 ? "toast-down" : "toast-up"}`}
        >
          <div className="toast-emoji">{(toast.xp_amount ?? 0) < 0 ? "📉" : "🌟"}</div>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.content && <div className="toast-content">{toast.content}</div>}
          </div>
          <button
            className="toast-close"
            aria-label="Đóng thông báo"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
          <div className="toast-progress" />
        </div>
      )}

      <style jsx>{`
        .notif-wrap { position: relative; display: inline-block; }
        .bell {
          position: relative; border: none; background: transparent;
          font-size: 24px; cursor: pointer; padding: 6px; border-radius: 50%;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .bell:hover { background: rgba(0,0,0,0.05); }
        .bell.ring { animation: swing 0.6s ease; }
        @keyframes swing {
          0%,100% { transform: rotate(0deg); }
          20% { transform: rotate(-18deg); }
          40% { transform: rotate(14deg); }
          60% { transform: rotate(-8deg); }
          80% { transform: rotate(4deg); }
        }
        .badge {
          position: absolute; top: 0; right: 0;
          background: linear-gradient(135deg,#ff5f6d,#ffc371);
          color: #fff; font-size: 11px; font-weight: 700;
          border-radius: 999px; padding: 1px 6px; min-width: 18px;
          text-align: center; box-shadow: 0 2px 6px rgba(255,95,109,0.5);
        }
        .panel {
          position: absolute; right: 0; top: 44px; width: 300px; max-height: 380px;
          overflow-y: auto; background: #fff; border-radius: 16px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.15); z-index: 50;
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .panel-header { padding: 12px 16px; font-weight: 700; border-bottom: 1px solid #f0f0f0; }
        .empty { padding: 24px 16px; text-align: center; color: #999; font-size: 14px; }
        .item { padding: 10px 16px; border-bottom: 1px solid #f5f5f5; }
        .item.unread { background: #fff8ec; }
        .item-title { font-weight: 600; font-size: 14px; }
        .item-content { font-size: 13px; color: #555; margin-top: 2px; }
        .item-time { font-size: 11px; color: #aaa; margin-top: 4px; }

        .toast {
          position: fixed; top: 20px; right: 20px; z-index: 100;
          display: flex; gap: 10px; align-items: flex-start;
          background: #fff; border-radius: 16px; padding: 14px 30px 16px 16px;
          box-shadow: 0 14px 36px rgba(0,0,0,0.2); max-width: 320px;
          border-left: 5px solid #ffb703;
          overflow: hidden;
          animation: popIn 0.45s cubic-bezier(0.22, 1, 0.36, 1),
                     fadeOut 0.45s cubic-bezier(0.4, 0, 1, 1) ${TOAST_DURATION - 450}ms forwards;
        }
        .toast-down { border-left-color: #ff5f6d; }
        .toast-up { border-left-color: #06d6a0; }
        .toast-emoji { font-size: 26px; }
        .toast-body { flex: 1; }
        .toast-title { font-weight: 700; font-size: 14px; }
        .toast-content { font-size: 13px; color: #555; margin-top: 3px; }
        .toast-close {
          position: absolute; top: 8px; right: 10px;
          border: none; background: transparent; color: #bbb;
          font-size: 13px; cursor: pointer; padding: 2px 4px; line-height: 1;
          transition: color 0.15s ease;
        }
        .toast-close:hover { color: #666; }
        .toast-progress {
          position: absolute; left: 0; bottom: 0; height: 3px; width: 100%;
          background: linear-gradient(90deg, #06d6a0, #ffd166);
          transform-origin: left;
          animation: shrink ${TOAST_DURATION}ms linear forwards;
        }
        @keyframes popIn {
          from { opacity: 0; transform: translateX(40px) scale(0.9); }
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
      `}</style>
    </div>
  );
}
