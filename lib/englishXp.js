// lib/englishXp.js
// ⚠️ Giả định lib/supabaseClient.js export ra `supabase`. Nếu bạn export
// tên khác (vd `export default supabase`), sửa lại dòng import bên dưới.
import { supabase } from './supabaseClient';

// Số XP cộng cho mỗi câu trả lời đúng, và bonus khi làm hết bài không mất tim
export const XP_PER_CORRECT = 10;
export const XP_PERFECT_BONUS = 20;

/**
 * Lấy tên bậc xếp hạng theo tổng XP.
 */
export async function getRankForXp(xp) {
  const { data, error } = await supabase
    .from('rank_tiers')
    .select('name, min_xp, badge_color')
    .lte('min_xp', xp)
    .order('min_xp', { ascending: false })
    .limit(1)
    .single();
  if (error) return { name: 'Học sinh mới', badge_color: '#9CA3AF' };
  return data;
}

/**
 * Cập nhật streak: nếu học sinh đã học hôm nay rồi thì giữ nguyên,
 * nếu học liên tiếp từ hôm qua thì +1, nếu bỏ cách >=2 ngày thì reset về 1.
 */
export function computeNextStreak(lastStudyDate, currentStreak) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (!lastStudyDate) return { streak: 1, dateStr: todayStr, changed: true };
  if (lastStudyDate === todayStr) return { streak: currentStreak, dateStr: todayStr, changed: false };

  const last = new Date(lastStudyDate);
  const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
  const nextStreak = diffDays === 1 ? currentStreak + 1 : 1;
  return { streak: nextStreak, dateStr: todayStr, changed: true };
}

/**
 * Ghi nhận kết quả 1 lượt học: cộng XP, cập nhật streak, mở khóa bài kế tiếp
 * nếu đạt điểm pass_score. Gọi hàm này ngay sau khi học sinh nộp bài.
 */
export async function finishLessonAttempt({
  studentId,
  lesson,       // { id, unit_id, order_index, pass_score }
  nextLessonId, // id bài học kế tiếp trong cùng unit, hoặc null nếu là bài cuối
  score,        // 0-100
  heartsLeft,
  answerLogs,   // [{ exercise_type, question_content, correct_answer, student_answer, is_correct, time_taken_seconds }]
}) {
  const isPerfect = heartsLeft === undefined ? false : answerLogs.every((a) => a.is_correct);
  const correctCount = answerLogs.filter((a) => a.is_correct).length;
  const xpEarned = correctCount * XP_PER_CORRECT + (isPerfect ? XP_PERFECT_BONUS : 0);

  // 1. Lưu attempt
  const { data: attempt, error: attemptErr } = await supabase
    .from('eng_attempts')
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
    const { error: logErr } = await supabase.from('eng_answer_logs').insert(rows);
    if (logErr) throw logErr;
  }

  // 3. Cập nhật tiến trình bài học (điểm cao nhất, hoàn thành hay chưa)
  const completed = score >= lesson.pass_score;
  await supabase.from('eng_lesson_progress').upsert(
    {
      student_id: studentId,
      lesson_id: lesson.id,
      is_unlocked: true,
      is_completed: completed,
      best_score: score, // nếu muốn giữ điểm cao nhất cũ, có thể so sánh trước khi upsert
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id,lesson_id' }
  );

  // 4. Mở khóa bài kế tiếp nếu đạt điểm
  if (completed && nextLessonId) {
    await supabase.from('eng_lesson_progress').upsert(
      { student_id: studentId, lesson_id: nextLessonId, is_unlocked: true },
      { onConflict: 'student_id,lesson_id' }
    );
  }

  // 5. Cộng XP + cập nhật streak trên profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, streak_days, last_study_date')
    .eq('id', studentId)
    .single();

  const { streak, dateStr } = computeNextStreak(profile?.last_study_date, profile?.streak_days || 0);

  await supabase
    .from('profiles')
    .update({
      xp: (profile?.xp || 0) + xpEarned,
      streak_days: streak,
      last_study_date: dateStr,
    })
    .eq('id', studentId);

  return { xpEarned, completed, streak };
}
