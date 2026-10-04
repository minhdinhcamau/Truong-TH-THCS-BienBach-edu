export const metadata = {
  title: 'LMS Trường học',
  description: 'Nền tảng học tập của trường',
  // Biểu tượng hiện trên thẻ trình duyệt, lấy từ public/logo-truong.png
  icons: {
    icon: [{ url: '/logo-truong.png', type: 'image/png' }],
    shortcut: '/logo-truong.png',
    apple: '/logo-truong.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Be Vietnam Pro', sans-serif", margin: 0, background: '#EFF5F3' }}>
        {children}
      </body>
    </html>
  );
}
