import { redirect } from "next/navigation";
import App from "@/components/App";
import { currentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <App email={user.email} />;
}
