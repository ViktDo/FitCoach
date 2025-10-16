export const metadata = { title: 'FitCoach' };

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{margin:0, fontFamily:'ui-sans-serif,system-ui'}}>
        {children}
      </body>
    </html>
  );
}
