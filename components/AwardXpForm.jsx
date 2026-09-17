"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AwardXpForm({ studentId, studentName, onDone }) {
  // Mac dinh AN - chi hien bang khi admin bam nut "Cong diem KN"
  const [open, setOpen] = useState(false);
  // Khong con tu dien san 50 nua, de trong bat buoc admin nhap tay
  const [xp, setXp] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const closeAndReset = () => {
    setOpen(false);
    setXp("");
    setReason("");
    setMsg(null);
  };

  const submit = async () => {
    const xpNumber = Number(xp);
    if (xp === "" || Number.isNaN(xpNumber) || xpNumber === 0) {
      setMsg({ type: "error", text: "Vui lòng nhập số điểm khác 0" });
      return;
    }
    setLoading(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("award_xp", {
      p_student_id: studentId,
      p_xp_amount: xpNumber,
      p_reason: reason || null,
    });
    setLoading(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "ok", text: `Đã cộng ${xp} KN. Tổng KN mới: ${data.new_total_xp} (${data.new_rank})` });
      setXp("");
      setReason("");
      onDone?.(data);
    }
  };

  // Trang thai THU GON: chi hien 1 nut nho, khong chiem cho trong bang
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "4px 10px",
          borderRadius: 8,
          background: "transparent",
          color: "#06d6a0",
          border: "1px solid #06d6a0",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        + Cộng điểm KN
      </button>
    );
  }

  // Trang thai MO RONG: hien form day du, co nut Thu gon o goc tren
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, maxWidth: 360 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Cộng điểm cho {studentName}</div>
        <button
          onClick={closeAndReset}
          title="Thu gọn"
          style={{ border: "none", background: "transparent", color: "#999", cursor: "pointer", fontSize: 13 }}
        >
          Thu gọn ✕
        </button>
      </div>
      <input
        type="number"
        value={xp}
        onChange={(e) => setXp(e.target.value)}
        placeholder="Số điểm (VD: 50, âm để trừ)"
        autoFocus
        style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Nội dung / lý do (VD: Hăng hái phát biểu tiết Toán)"
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
            background: "#06d6a0",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Đang lưu..." : "Lưu & Gửi thông báo"}
        </button>
        <button
          onClick={closeAndReset}
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
        <div style={{ marginTop: 8, fontSize: 13, color: msg.type === "error" ? "#e63946" : "#06d6a0" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
