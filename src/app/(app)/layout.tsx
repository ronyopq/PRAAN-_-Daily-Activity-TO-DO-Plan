import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Login is mandatory again: no session → back to the login screen.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <Shell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        color: user.color,
        notifyBeforeMins: user.notifyBeforeMins,
        browserNotifications: user.browserNotifications,
        autoGenerate: user.autoGenerate,
      }}
    >
      {children}
    </Shell>
  );
}
