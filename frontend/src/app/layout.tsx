import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioCloud Workbench | ECG Signal Processing & Protein Structure Prediction",
  description: "Advanced biomedical research workbench combining digital ECG signal processing with deep learning protein structure prediction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 selection:bg-teal-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
