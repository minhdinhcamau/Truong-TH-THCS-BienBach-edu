"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SendNotificationForm({ studentIds, onDone, onClose }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    if (!title.trim()) {
      setMsg({ type: "error", text: "Vui lòng nhập tiêu đề thông báo" });
      return;
    }
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("admin_send_notification", {
      p_student_ids: studentIds,
      p_title: title.trim(),
      p_message: message.trim() || null,
    });
    setLoading(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "ok", text: `Đã gửi thông báo tới ${data} học sinh.` });
      setTitle("");
      setMessage("");
      onDone?.(data);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #cfe2f7",
        borderRadius: 12,
        padding: 16,
        maxWidth: 420,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Gửi thông báo tới {studentIds.length} học sinh</div>
        <button
          onClick={onClose}
          title="Đóng"
          style={{ border: "none", background: "transparent", color: "#999", cursor: "pointer", fontSize: 13 }}
        >
          ✕
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Nhắc nhở nộp bài tập)"
        autoFocus
        style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Nội dung chi tiết (không bắt buộc)"
        rows={3}
        style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#1b6fb8",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Đang gửi..." : "Gửi thông báo"}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#f1f1f1",
            color: "#444",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Huỷ
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 8, fontSize: 13, color: msg.type === "error" ? "#e63946" : "#1b6fb8" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
