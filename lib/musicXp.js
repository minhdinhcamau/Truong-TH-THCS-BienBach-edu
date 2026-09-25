// lib/musicXp.js
//
// BẢN CẬP NHẬT — mirror 1-1 theo lib/englishXp.js thật (bạn vừa gửi), dùng
// đúng hệ thống XP/streak dùng chung của trường:
//   - xp_events(student_id, subject_id, source_type, source_id, xp_amount, note, created_by)
//   - student_stats(student_id, total_xp, current_streak, longest_streak, last_activity_date)
//   - subject_progress(student_id, subject_id, subject_xp)
// Khác biệt với bản đoán trước: KHÔNG tự tạo bảng music_lesson_attempts
// nữa, thay bằng 3 bảng mirror đúng tên kiểu Tiếng Anh: music_attempts,
// music_answer_logs, music_lesson_progress (xem music-schema-v2.sql).
import { supabase } from './supabaseClient';

// id môn Âm nhạc trong bảng "subjects" (dùng chung với Tiếng Anh) — đã điền UUID thật.
export const MUSIC_SUBJECT_ID = '58714c79-375b-493d-af4b-c930f0bcf629';

export const XP_PER_CORRECT = 10;
export const XP_PERFECT_BONUS = 20;

// Dùng lại y hệt công thức streak của Tiếng Anh — nếu bạn tách hàm này ra
// một file dùng chung (vd lib/xpCore.js) sau này, nhớ cập nhật cả 2 nơi gọi.
export function computeNextStreak(lastActivityDate, currentStreak) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (!lastActivityDate) return { streak: 1, dateStr: todayStr, changed: true };
  if (lastActivityDate === todayStr) return { streak: currentStreak, dateStr: todayStr, changed: false };

  const last = new Date(lastActivityDate);
  const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
  const nextStreak = diffDays === 1 ? currentStreak + 1 : 1;
  return { streak: nextStreak, dateStr: todayStr, changed: true };
}

/**
 * Ghi nhận kết quả 1 lượt học Âm nhạc — cùng luồng với finishLessonAttempt()
 * bên Tiếng Anh, chỉ đổi tên bảng eng_* -> music_* và subject_id.
 */
export async function finishMusicLessonAttempt({
  studentId,
  lesson,       // { id, unit_id, pass_score }
  nextLessonId, // id lesson kế tiếp trong cùng unit, hoặc null
  score,        // 0-100
  heartsLeft,
  answerLogs,   // [{ exercise_type, question_content, correct_answer, student_answer, is_correct, time_taken_seconds }]
}) {
  const isPerfect = answerLogs.every((a) => a.is_correct);
  const correctCount = answerLogs.filter((a) => a.is_correct).length;
  const xpEarned = correctCount * XP_PER_CORRECT + (isPerfect ? XP_PERFECT_BONUS : 0);

  // 1. Lưu attempt
  const { data: attempt, error: attemptErr } = await supabase
    .from('music_attempts')
    .insert({
      student_id: studentId,
      lesson_id: lesson.id,
      finished_at: new Date().toISOString(),
      score,
      hearts_left: heartsLeft,
      xp_earned: xpEarned,
    })
    .select()
    .single();
  if (attemptErr) throw attemptErr;

  // 2. Lưu chi tiết từng câu
  if (answerLogs.length > 0) {
    const rows = answerLogs.map((a) => ({ ...a, attempt_id: attempt.id }));
    const { error: logErr } = await supabase.from('music_answer_logs').insert(rows);
    if (logErr) throw logErr;
  }

  // 3. Cập nhật tiến trình bài học
  const completed = score >= lesson.pass_score;
  await supabase.from('music_lesson_progress').upsert(
    {
      student_id: studentId,
      lesson_id: lesson.id,
      is_unlocked: true,
      is_completed: completed,
      best_score: score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,lesson_id' }
  );

  // 4. Mở khoá bài kế tiếp nếu đạt điểm
  if (completed && nextLessonId) {
    await supabase.from('music_lesson_progress').upsert(
      { student_id: studentId, lesson_id: nextLessonId, is_unlocked: true },
      { onConflict: 'student_id,lesson_id' }
    );
  }

  if (xpEarned > 0) {
    // 5. Ghi log XP vào bảng dùng chung
    await supabase.from('xp_events').insert({
      student_id: studentId,
      subject_id: MUSIC_SUBJECT_ID,
      source_type: 'music_lesson',
      source_id: lesson.id,
      xp_amount: xpEarned,
      note: `Hoàn thành bài học Âm nhạc (điểm ${score}%)`,
    });

    // 6. Cộng dồn student_stats (tổng XP + streak toàn trường — DÙNG CHUNG với Tiếng Anh)
    const { data: stats } = await supabase
      .from('student_stats')
      .select('total_xp, current_streak, longest_streak, last_activity_date')
      .eq('student_id', studentId)
      .maybeSingle();

    const { streak, dateStr } = computeNextStreak(stats?.last_activity_date || null, stats?.current_streak || 0);
    const newTotalXp = (stats?.total_xp || 0) + xpEarned;
    const newLongest = Math.max(stats?.longest_streak || 0, streak);

    await supabase.from('student_stats').upsert(
      {
        student_id: studentId,
        total_xp: newTotalXp,
        current_streak: streak,
        longest_streak: newLongest,
        last_activity_date: dateStr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );

    // 7. Cộng dồn subject_progress (XP riêng của môn Âm nhạc)
    const { data: subProg } = await supabase
      .from('subject_progress')
      .select('subject_xp')
      .eq('student_id', studentId)
      .eq('subject_id', MUSIC_SUBJECT_ID)
      .maybeSingle();

    await supabase.from('subject_progress').upsert(
      { student_id: studentId, subject_id: MUSIC_SUBJECT_ID, subject_xp: (subProg?.subject_xp || 0) + xpEarned },
      { onConflict: 'student_id,subject_id' }
    );

    return { xpEarned, completed, streak };
  }

  return { xpEarned: 0, completed, streak: null };
}
