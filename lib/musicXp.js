// lib/musicXp.js
// BẢN CẬP NHẬT — thêm cấp độ (level) + số sao (stars), chỉ lưu LẦN NHIỀU
// SAO NHẤT vào music_lesson_progress (không ghi đè bằng lần chơi kém hơn).
// Vẫn dùng đúng hệ thống XP/streak dùng chung của trường (xp_events,
// student_stats, subject_progress) y hệt bản trước.
import { supabase } from './supabaseClient';

export const MUSIC_SUBJECT_ID = '58714c79-375b-493d-af4b-c930f0bcf629';

// (2 hằng số cũ giữ lại để các file khác nếu còn import thì không lỗi — công thức mới không còn dùng)
export const XP_PER_CORRECT = 10;
export const XP_PERFECT_BONUS = 20;

// ===== Luật qua màn & điểm kinh nghiệm (XP) =====
// Qua màn: đàn đúng ít nhất PASS_PERCENT % số nốt của bài.
export const PASS_PERCENT = 60;
// Điểm gốc khi qua màn LẦN ĐẦU, theo độ khó của cấp độ (nhân với % nốt đúng).
export const LEVEL_BASE_XP = { practice: 30, slow: 60, medium: 100, fast: 150 };
// Chơi lại cấp đã từng qua (ôn tập): chỉ nhận tỉ lệ này của điểm gốc (vẫn nhân với % nốt đúng).
export const REPLAY_FACTOR = 0.25;
// Thưởng thêm cho mỗi SAO MỚI vượt kỷ lục cũ của cấp độ này (không thưởng khi chỉ chơi lại bằng/thấp hơn).
export const STAR_BONUS_XP = 10;
const LEVEL_LABEL = { practice: 'Luyện tập', slow: 'Chậm', medium: 'Vừa', fast: 'Nhanh' };

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
 * Ghi nhận kết quả 1 lượt CHƠI BẢN NHẠC (không còn theo mô hình "câu hỏi
 * đúng/sai" của Tiếng Anh — điểm giờ tính từ độ chính xác cao độ + tiết tấu
 * của cả bài). Vẫn ghi log XP dùng chung để lên chung 1 bảng xếp hạng.
 */
export async function finishMusicLessonAttempt({
  studentId,
  lesson,            // { id, unit_id, pass_score }
  nextLessonId,       // id lesson kế tiếp trong cùng unit, hoặc null
  level,              // 'slow' | 'medium' | 'fast'
  pitchAccuracy,      // 0-100 (% nốt bấm đúng phím)
  rhythmAccuracy,     // 0-100 (% đúng nhịp)
  stars: starsIn,     // 0-3 (hàm này tự ép: qua màn >= 1 sao, chưa qua = 0 sao)
  heartsLeft,
  answerLogs,         // [{ exercise_type: 'play_note', question_content: pitch, correct_answer, student_answer, is_correct, time_taken_seconds }]
}) {
  const score = Math.round((pitchAccuracy + rhythmAccuracy) / 2);
  const completed = pitchAccuracy >= PASS_PERCENT;
  const stars = completed ? Math.max(1, starsIn || 0) : 0;

  // Đã từng qua cấp độ này chưa? (để biết đây là lần đầu hay ôn tập) — đọc TRƯỚC khi ghi tiến độ mới.
  const { data: existing } = await supabase
    .from('music_lesson_progress')
    .select('stars, best_score, is_completed')
    .eq('student_id', studentId).eq('lesson_id', lesson.id).eq('level', level)
    .maybeSingle();
  const prevStars = existing?.stars ?? 0;
  const prevBest = existing?.best_score ?? 0;
  const alreadyCleared = !!existing?.is_completed;

  // XP: chỉ khi qua màn. Điểm gốc theo độ khó × % nốt đúng; ôn tập lại thì giảm còn REPLAY_FACTOR.
  const baseXp = LEVEL_BASE_XP[level] ?? 0;
  const newStars = completed ? Math.max(0, stars - prevStars) : 0;
  const starBonus = newStars * STAR_BONUS_XP;
  const mainXp = completed ? Math.round(baseXp * (pitchAccuracy / 100) * (alreadyCleared ? REPLAY_FACTOR : 1)) : 0;
  const xpEarned = mainXp + starBonus;
  const levelName = LEVEL_LABEL[level] || level;
  const xpNote = !completed
    ? `Cần đàn đúng ít nhất ${PASS_PERCENT}% số nốt để qua màn và nhận điểm KN.`
    : alreadyCleared
      ? `Ôn tập lại cấp ${levelName}: nhận ${Math.round(REPLAY_FACTOR * 100)}% điểm so với lần đầu (đúng ${pitchAccuracy}% số nốt)${starBonus ? ` + ${starBonus} thưởng sao mới` : ''}.`
      : `Qua màn lần đầu cấp ${levelName}: điểm gốc ${baseXp} × ${pitchAccuracy}% số nốt đúng${starBonus ? ` + ${starBonus} thưởng sao mới` : ''}.`;

  const { data: attempt, error: attemptErr } = await supabase
    .from('music_attempts')
    .insert({
      student_id: studentId, lesson_id: lesson.id, finished_at: new Date().toISOString(),
      score, hearts_left: heartsLeft, xp_earned: xpEarned,
      level, stars, pitch_accuracy: pitchAccuracy, rhythm_accuracy: rhythmAccuracy,
    })
    .select().single();
  if (attemptErr) throw attemptErr;

  if (answerLogs.length > 0) {
    const rows = answerLogs.map((a) => ({ ...a, attempt_id: attempt.id }));
    await supabase.from('music_answer_logs').insert(rows);
  }

  // Giữ KỶ LỤC tốt nhất (sao, điểm) và đánh dấu "đã qua" ngay khi qua màn lần đầu — không bị lần chơi kém hơn ghi đè.
  if (!existing || completed && !alreadyCleared || stars > prevStars || score > prevBest) {
    await supabase.from('music_lesson_progress').upsert(
      {
        student_id: studentId, lesson_id: lesson.id, level,
        is_unlocked: true, is_completed: alreadyCleared || completed,
        best_score: Math.max(prevBest, score), stars: Math.max(prevStars, stars), updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,lesson_id,level' }
    );
  }

  // Mở khoá cấp độ kế tiếp (Luyện tập -> Chậm -> Vừa -> Nhanh) nếu qua màn.
  if (completed) {
    const chain = { practice: 'slow', slow: 'medium', medium: 'fast', fast: null };
    const nextLevel = chain[level] ?? null;
    if (nextLevel) {
      await supabase.from('music_lesson_progress').upsert(
        { student_id: studentId, lesson_id: lesson.id, level: nextLevel, is_unlocked: true },
        { onConflict: 'student_id,lesson_id,level' }
      );
    } else if (nextLessonId) {
      // Đã qua cả 4 cấp độ của bài này -> mở bài kế tiếp (cấp Luyện tập)
      await supabase.from('music_lesson_progress').upsert(
        { student_id: studentId, lesson_id: nextLessonId, level: 'practice', is_unlocked: true },
        { onConflict: 'student_id,lesson_id,level' }
      );
    }
  }

  if (xpEarned > 0) {
    await supabase.from('xp_events').insert({
      student_id: studentId, subject_id: MUSIC_SUBJECT_ID, source_type: 'music_lesson',
      source_id: lesson.id, xp_amount: xpEarned, note: `Âm nhạc — cấp ${levelName}, đúng ${pitchAccuracy}% số nốt${alreadyCleared ? ' (ôn tập)' : ''}`,
    });

    const { data: stats } = await supabase
      .from('student_stats').select('total_xp, current_streak, longest_streak, last_activity_date')
      .eq('student_id', studentId).maybeSingle();

    const { streak, dateStr } = computeNextStreak(stats?.last_activity_date || null, stats?.current_streak || 0);
    await supabase.from('student_stats').upsert(
      {
        student_id: studentId, total_xp: (stats?.total_xp || 0) + xpEarned,
        current_streak: streak, longest_streak: Math.max(stats?.longest_streak || 0, streak),
        last_activity_date: dateStr, updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );

    const { data: subProg } = await supabase
      .from('subject_progress').select('subject_xp')
      .eq('student_id', studentId).eq('subject_id', MUSIC_SUBJECT_ID).maybeSingle();
    await supabase.from('subject_progress').upsert(
      { student_id: studentId, subject_id: MUSIC_SUBJECT_ID, subject_xp: (subProg?.subject_xp || 0) + xpEarned },
      { onConflict: 'student_id,subject_id' }
    );
  }

  return { xpEarned, completed, score, stars, xpNote, firstClear: completed && !alreadyCleared };
}
