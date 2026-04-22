import Link from "next/link";
import { Plan } from "@prisma/client";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setSession, getSession } from "@/lib/auth";
import { subscribeUser } from "@/lib/services";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  charityId: z.string().min(1),
  charityPercent: z.coerce.number().min(10).max(100),
  plan: z.enum([Plan.MONTHLY, Plan.YEARLY]),
});

export default async function SignupPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const charities = await prisma.charity.findMany({ orderBy: { name: "asc" } });

  async function signupAction(formData: FormData) {
    "use server";

    const parsed = schema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      charityId: formData.get("charityId"),
      charityPercent: formData.get("charityPercent"),
      plan: formData.get("plan"),
    });

    if (!parsed.success) redirect("/signup?error=invalid");

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) redirect("/signup?error=exists");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        charityId: parsed.data.charityId,
        charityPercent: parsed.data.charityPercent,
      },
    });

    await subscribeUser(user.id, parsed.data.plan);
    await setSession({ userId: user.id, role: "USER" });
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">Create Subscriber Account</h1>
      <p className="mt-1 text-sm text-slate-600">Choose your plan and charity impact percentage.</p>
      <form action={signupAction} className="mt-4 grid gap-3">
        <input name="name" placeholder="Full name" required className="rounded-md border border-slate-300 px-3 py-2" />
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <select name="plan" className="rounded-md border border-slate-300 px-3 py-2">
          <option value={Plan.MONTHLY}>Monthly - 100</option>
          <option value={Plan.YEARLY}>Yearly - 1000</option>
        </select>
        <select name="charityId" className="rounded-md border border-slate-300 px-3 py-2">
          {charities.map((charity) => (
            <option value={charity.id} key={charity.id}>
              {charity.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="charityPercent"
          min={10}
          max={100}
          defaultValue={10}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <button className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white">Subscribe & Continue</button>
      </form>
      <p className="mt-4 text-sm">
        Already have account?{" "}
        <Link href="/login" className="text-indigo-700">
          Login
        </Link>
      </p>
    </div>
  );
}
