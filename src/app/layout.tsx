import type { Metadata, Viewport } from "next";
import "@fontsource/cinzel/700.css";
import "@fontsource/cinzel/900.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import { IdeaButton } from "@/components/idea-button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Kumite",
  description: "Workouts, desk sets, and the week's goals.",
  appleWebApp: { capable: true, title: "Kumite", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#150c0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (
    <html lang="en" className="antialiased">
      <body>
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))]">
          {children}
        </main>
        {data?.claims ? <IdeaButton /> : null}
      </body>
    </html>
  );
}
