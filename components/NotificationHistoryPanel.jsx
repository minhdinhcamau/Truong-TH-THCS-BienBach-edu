"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationHistoryPanel({ onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, content, xp_amount, is_read, created_at, profiles:student_id(full_name, class_id)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setErr(error.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteOld(days, label) {
    const ok = window.confirm(
      `Xóa các thông báo CŨ HƠN ${label} (của học sinh và giáo viên)?\n\nThông báo mới hơn vẫn được giữ. Không thể hoàn tác.`
    );
    if (!ok) return;
    setDeleting(true);
    setErr(null);
    setMsg(null);
    const { data, error } = await supabase.rpc("admin_delete_old_notifications", { p_days: days });
    setDeleting(false);
    if (error) {
      setErr(
        error.message.includes("admin_delete_old_notifications")
          ? "Chưa chạy file SQL gói T2 trong Supabase nên chưa xóa được."
          : error.message
      );
      return;
    }
    setMsg(`Đã xóa ${data ?? 0} thông báo cũ hơn ${label}.`);
    load();
  }

  async function deleteAll() {
    const ok = window.confirm(
      "XÓA TẤT CẢ thông báo của học sinh và giáo viên?\n\nHành động này không thể hoàn tác."
    );
    if (!ok) return;
    setDeleting(true);
    setErr(null);
    setMsg(null);
    const { data, error } = await supabase.rpc("admin_delete_all_notifications");
    setDeleting(false);
    if (error) {
      setErr(
        error.message.includes("admin_delete_all_notifications")
          ? "Chưa chạy file SQL gói T trong Supabase nên chưa xóa được."
          : error.message
      );
      return;
    }
    setRows([]);
    setMsg(`Đã xóa ${data ?? 0} thông báo.`);
  }

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🕘 Lịch sử thông báo (100 gần nhất)</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={deleteAll}
            disabled={deleting}
            style={{
              border: "1px solid #e8b4b0",
              background: "#fff1f0",
              color: "#b3261e",
              borderRadius: 8,
              padding: "7px 12px",
              fontWeight: 700,
              fontSize: 13,
              cursor: deleting ? "default" : "pointer",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Đang xóa…" : "🗑 Xóa tất cả thông báo"}
          </button>
          <button
            onClick={onClose}
            title="Đóng"
            style={{ border: "none", background: "transparent", color: "#999", cursor: "pointer", fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "#52708f", fontWeight: 600 }}>Xóa thông báo cũ hơn:</span>
        {[
          { d: 7, t: "1 tuần" },
          { d: 14, t: "2 tuần" },
          { d: 21, t: "3 tuần" },
          { d: 30, t: "1 tháng" },
        ].map((o) => (
          <button
            key={o.d}
            onClick={() => deleteOld(o.d, o.t)}
            disabled={deleting}
            style={{
              border: "1px solid #cfe2f7",
              background: "#fff",
              color: "#b3261e",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              fontSize: 13,
              minHeight: 38,
              cursor: deleting ? "default" : "pointer",
              opacity: deleting ? 0.6 : 1,
            }}
          >
            🗑 {o.t}
          </button>
        ))}
      </div>

      {msg && <div style={{ fontSize: 13, color: "#1f7a4d", marginBottom: 8, fontWeight: 600 }}>{msg}</div>}
      {loading && <div style={{ fontSize: 13, color: "#8aa39c" }}>Đang tải...</div>}
      {err && <div style={{ fontSize: 13, color: "#e63946" }}>Lỗi: {err}</div>}
      {!loading && !err && rows.length === 0 && (
        <div style={{ fontSize: 13, color: "#8aa39c" }}>Không có thông báo nào.</div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #dce3e0" }}>
                <th style={{ padding: "6px 8px" }}>Người nhận</th>
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
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.profiles?.full_name || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>{r.title}</td>
                  <td style={{ padding: "6px 8px", color: "#4e6a88" }}>{r.content || "—"}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {r.xp_amount === null || r.xp_amount === undefined ? "—" : `${r.xp_amount > 0 ? "+" : ""}${r.xp_amount}`}
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
