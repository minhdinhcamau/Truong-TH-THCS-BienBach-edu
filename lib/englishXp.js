// lib/englishXp.js
// Đã sửa lại để dùng ĐÚNG hệ thống XP/streak có sẵn của trường:
//   - xp_events(student_id, subject_id, source_type, source_id, xp_amount, note, created_by)
//   - student_stats(student_id, total_xp, current_streak, longest_streak, last_activity_date)
//   - subject_progress(student_id, subject_id, subject_xp)
// KHÔNG dùng profiles.xp / profiles.streak_days / profiles.last_study_date nữa
// (những cột đó do mình lỡ ADD vào profiles ở bản trước, giờ không dùng tới,
// để nguyên cho an toàn, không cần xóa).
import { supabase } from './supabaseClient';

// ⚠️ id môn Tiếng Anh, lấy từ bảng subjects — nếu bạn tạo lại môn học này
// với id khác, nhớ cập nhật lại giá trị bên dưới.
export const ENGLISH_SUBJECT_ID = 'af49beac-2974-44f1-bc83-53c5c4915d65';

export const XP_PER_CORRECT = 10;
export const XP_PERFECT_BONUS = 20;

/**
 * Lấy tên bậc xếp hạng theo tổng XP (dùng chung toàn trường, không đổi).
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
 * Tính streak mới dựa trên last_activity_date hiện có trong student_stats.
 */
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
 * Ghi nhận kết quả 1 lượt học tiếng Anh:
 * - Lưu attempt + answer_logs (như cũ)
 * - Cập nhật eng_lesson_progress, mở bài kế tiếp nếu đạt điểm (như cũ)
 * - Ghi 1 dòng vào xp_events, rồi cộng dồn thủ công vào student_stats + subject_progress
 */
export async function finishLessonAttempt({
  studentId,
  lesson,       // { id, unit_id, order_index, pass_score }
  nextLessonId, // id bài học kế tiếp trong cùng unit, hoặc null nếu là bài cuối
  score,        // 0-100
  heartsLeft,
  answerLogs,   // [{ exercise_type, question_content, correct_answer, student_answer, is_correct, time_taken_seconds }]
}) {
  const isPerfect = answerLogs.every((a) => a.is_correct);
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

  // 3. Cập nhật tiến trình bài học
  const completed = score >= lesson.pass_score;
  await supabase.from('eng_lesson_progress').upsert(
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

  // 4. Mở khóa bài kế tiếp nếu đạt điểm
  if (completed && nextLessonId) {
    await supabase.from('eng_lesson_progress').upsert(
      { student_id: studentId, lesson_id: nextLessonId, is_unlocked: true },
      { onConflict: 'student_id,lesson_id' }
    );
  }

  if (xpEarned > 0) {
    // 5. Ghi log XP — dùng đúng bảng xp_events có sẵn của trường
    await supabase.from('xp_events').insert({
      student_id: studentId,
      subject_id: ENGLISH_SUBJECT_ID,
      source_type: 'eng_lesson',
      source_id: lesson.id,
      xp_amount: xpEarned,
      note: `Hoàn thành bài học tiếng Anh (điểm ${score}%)`,
    });

    // 6. Cộng dồn vào student_stats (tổng XP + streak toàn trường)
    const { data: stats } = await supabase
      .from('student_stats')
      .select('total_xp, current_streak, longest_streak, last_activity_date')
      .eq('student_id', studentId)
      .maybeSingle();

    const { streak, dateStr } = computeNextStreak(
      stats?.last_activity_date || null,
      stats?.current_streak || 0
    );
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

    // 7. Cộng dồn vào subject_progress (XP riêng của môn Tiếng Anh)
    const { data: subProg } = await supabase
      .from('subject_progress')
      .select('subject_xp')
      .eq('student_id', studentId)
      .eq('subject_id', ENGLISH_SUBJECT_ID)
      .maybeSingle();

    await supabase.from('subject_progress').upsert(
      {
        student_id: studentId,
        subject_id: ENGLISH_SUBJECT_ID,
        subject_xp: (subProg?.subject_xp || 0) + xpEarned,
      },
      { onConflict: 'student_id,subject_id' }
    );

    return { xpEarned, completed, streak: streak };
  }

  return { xpEarned: 0, completed, streak: null };
}
