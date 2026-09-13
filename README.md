# LMS Trường học — Giai đoạn 1

Đăng nhập + Giáo viên giao bài trắc nghiệm + Học sinh làm bài + Chấm điểm tự động.

## 1. Tạo project Supabase (miễn phí, không cần thẻ)
1. Vào supabase.com > New project
2. Vào **SQL Editor** > dán toàn bộ nội dung file `supabase/schema.sql` > Run
3. Vào **Project Settings > API**, copy `Project URL` và `anon public key`

## 2. Chạy thử ở máy mình
```
cp .env.local.example .env.local
# mở .env.local, dán URL + anon key vừa copy vào
npm install
npm run dev
```
Mở http://localhost:3000

## 3. Tạo tài khoản đầu tiên
- Vào trang /login, bấm "Đăng ký" bằng email của giáo viên
- Vào Supabase > SQL Editor, chạy lệnh (đổi email cho đúng):
```sql
update profiles set role = 'teacher'
where id = (select id from auth.users where email = 'giaovien@truong.edu.vn');
```
- Đăng ký thêm tài khoản học sinh (mặc định role = student), rồi gán class_id cho học sinh sau khi giáo viên tạo lớp.

## 4. Đưa lên Vercel (miễn phí, không cần thẻ)
1. Đẩy code này lên 1 repo GitHub mới
2. Vào vercel.com > đăng nhập bằng GitHub > Add New Project > chọn repo này
3. Ở bước cấu hình, thêm 2 Environment Variables giống hệt file `.env.local`:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Bấm Deploy — xong, có link web thật chạy 24/7 miễn phí

## Cấu trúc thư mục
```
app/
  login/page.jsx           - trang đăng nhập / đăng ký
  teacher/page.jsx         - giáo viên: danh sách bài đã giao
  teacher/assignments/new/page.jsx - giáo viên: tạo bài trắc nghiệm mới
  student/page.jsx         - học sinh: danh sách bài cần làm
  student/assignments/[id]/page.jsx - học sinh: làm bài + nộp
  page.jsx                 - tự chuyển hướng theo vai trò
lib/supabaseClient.js      - kết nối tới Supabase
supabase/schema.sql        - toàn bộ cấu trúc database
```
