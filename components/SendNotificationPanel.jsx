"use client";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// scope: 'student' | 'class' | 'grade' | 'all'
export default function SendNotificationPanel({ students, classes, gradeOptions, onClose }) {
  const [scope, setScope] = useState("student");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [grade, setGrade] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const sortedStudents = useMemo(
    () => [...(students || [])].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "vi")),
    [students]
  );

  const canSubmit =
    title.trim() &&
    ((scope === "student" && studentId) ||
      (scope === "class" && classId) ||
      (scope === "grade" && grade) ||
      scope === "all");

  const submit = async () => {
    if (!canSubmit) {
      setMsg({ type: "error", text: "Vui lòng nhập tiêu đề và chọn đối tượng nhận" });
      return;
    }
    setLoading(true);
    setMsg(null);

    const params = {
      p_title: title.trim(),
      p_message: message.trim() || null,
      p_student_id: scope === "student" ? studentId : null,
      p_class_id: scope === "class" ? classId : null,
      p_grade: scope === "grade" ? Number(grade) : null,
      p_all: scope === "all",
    };

    const { data, error } = await supabase.rpc("admin_send_notification", params);
    setLoading(false);
    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({ type: "ok", text: `Đã gửi thông báo tới ${data} học sinh.` });
      setTitle("");
      setMessage("");
    }
  };

  return (
    <div
      style={{
        border: "1px solid #cfe2f7",
        borderRadius: 14,
        padding: 18,
        maxWidth: 520,
        background: "#f7fbff",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>📢 Gửi thông báo</div>
        <button
          onClick={onClose}
          title="Đóng"
          style={{ border: "none", background: "transparent", color: "#999", cursor: "pointer", fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { key: "student", label: "1 học sinh" },
          { key: "class", label: "Cả lớp" },
          { key: "grade", label: "Cả khối" },
          { key: "all", label: "Toàn trường" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setScope(opt.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: scope === opt.key ? "1.5px solid #1b6fb8" : "1px solid #dce3e0",
              background: scope === opt.key ? "#1b6fb8" : "#fff",
              color: scope === opt.key ? "#fff" : "#37423e",
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {scope === "student" && (
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{ width: "100%", padding: 9, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="">-- Chọn học sinh --</option>
          {sortedStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.student_code || s.id} {s.className ? `· ${s.className}` : ""}
            </option>
          ))}
        </select>
      )}

      {scope === "class" && (
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          style={{ width: "100%", padding: 9, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="">-- Chọn lớp --</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {scope === "grade" && (
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={{ width: "100%", padding: 9, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd" }}
        >
          <option value="">-- Chọn khối --</option>
          {gradeOptions.map((g) => (
            <option key={g} value={g}>
              Khối {g}
            </option>
          ))}
        </select>
      )}

      {scope === "all" && (
        <div style={{ fontSize: 13, color: "#8aa39c", marginBottom: 10 }}>
          Sẽ gửi cho toàn bộ học sinh trong trường.
        </div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Nghỉ học ngày mai)"
        style={{ width: "100%", padding: 9, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd" }}
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Nội dung chi tiết (không bắt buộc)"
        rows={3}
        style={{ width: "100%", padding: 9, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={submit}
          disabled={loading || !canSubmit}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            background: canSubmit ? "#1b6fb8" : "#a9c6de",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Đang gửi..." : "Gửi thông báo"}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "9px 18px",
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
        <div style={{ marginTop: 10, fontSize: 13, color: msg.type === "error" ? "#e63946" : "#1b6fb8" }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
