"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationHistoryPanel({ onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, content, xp_amount, is_read, created_at, profiles:student_id(full_name, class_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows(data || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        border: "1px solid #cfe2f7",
        borderRadius: 14,
        padding: 18,
        maxWidth: 720,
        background: "#f7fbff",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🕘 Lịch sử thông báo đã gửi (100 gần nhất)</div>
        <button
          onClick={onClose}
          title="Đóng"
          style={{ border: "none", background: "transparent", color: "#999", cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {loading && <div style={{ fontSize: 13, color: "#8aa39c" }}>Đang tải...</div>}
      {err && <div style={{ fontSize: 13, color: "#e63946" }}>Lỗi: {err}</div>}
      {!loading && !err && rows.length === 0 && (
        <div style={{ fontSize: 13, color: "#8aa39c" }}>Chưa gửi thông báo nào.</div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #dce3e0" }}>
                <th style={{ padding: "6px 8px" }}>Học sinh</th>
                <th style={{ padding: "6px 8px" }}>Tiêu đề</th>
                <th style={{ padding: "6px 8px" }}>Nội dung</th>
                <th style={{ padding: "6px 8px" }}>KN</th>
                <th style={{ padding: "6px 8px" }}>Đã đọc</th>
                <th style={{ padding: "6px 8px" }}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #eef4fb" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                    {r.profiles?.full_name || "—"}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.title}</td>
                  <td style={{ padding: "6px 8px", color: "#4e6a88" }}>{r.content || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {r.xp_amount === null || r.xp_amount === undefined
                      ? "—"
                      : `${r.xp_amount > 0 ? "+" : ""}${r.xp_amount}`}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{r.is_read ? "✓" : ""}</td>
                  <td style={{ padding: "6px 8px", color: "#8aa39c", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
