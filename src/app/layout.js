import "./globals.css";

export const metadata = {
  title: "Library Management API",
  description: "Backend API for WAD final examination",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
