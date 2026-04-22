import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSession, getSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  async function loginAction(formData: FormData) {
    "use server";

    const parsed = schema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) redirect("/login?error=invalid");

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) redirect("/login?error=creds");

    const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isValid) redirect("/login?error=creds");

    await setSession({ userId: user.id, role: user.role });
    redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="mt-1 text-sm text-slate-600">Use your subscriber or admin account.</p>
      <form action={loginAction} className="mt-4 space-y-4">
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        <button className="w-full rounded-md bg-indigo-600 px-3 py-2 font-medium text-white">
          Login
        </button>
      </form>
      <p className="mt-4 text-sm">
        New subscriber?{" "}
        <Link href="/signup" className="text-indigo-700">
          Create account
        </Link>
      </p>
    </div>
  );
}
