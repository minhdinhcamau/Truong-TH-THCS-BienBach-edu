export const metadata = {
  title: 'LMS Trường học',
  description: 'Nền tảng học tập của trường',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: 'sans-serif', margin: 0, background: '#EFF5F3' }}>
        {children}
      </body>
    </html>
  );
}
