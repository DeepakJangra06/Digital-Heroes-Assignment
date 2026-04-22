import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addOrUpdateScore, deleteScore, subscribeUser } from "@/lib/services";
import { prisma } from "@/lib/prisma";
import { Plan, SubscriptionStatus } from "@prisma/client";

const scoreSchema = z.object({
  scoreDate: z.string().min(1),
  value: z.coerce.number().min(1).max(45),
});

const donationSchema = z.object({
  amount: z.coerce.number().int().min(1),
});

export default async function DashboardPage() {
  const user = await requireUser();

  async function addScoreAction(formData: FormData) {
    "use server";
    if (user.subscription?.status !== SubscriptionStatus.ACTIVE) return;

    const payload = scoreSchema.safeParse({
      scoreDate: formData.get("scoreDate"),
      value: formData.get("value"),
    });
    if (!payload.success) return;

    await addOrUpdateScore(user.id, new Date(payload.data.scoreDate), payload.data.value);
    revalidatePath("/dashboard");
  }

  async function deleteScoreAction(formData: FormData) {
    "use server";
    const id = String(formData.get("scoreId") ?? "");
    if (!id) return;
    await deleteScore(id, user.id);
    revalidatePath("/dashboard");
  }

  async function updatePlanAction(formData: FormData) {
    "use server";
    const plan = String(formData.get("plan")) === Plan.YEARLY ? Plan.YEARLY : Plan.MONTHLY;
    await subscribeUser(user.id, plan);
    revalidatePath("/dashboard");
  }

  async function uploadProofAction(formData: FormData) {
    "use server";
    const resultId = String(formData.get("resultId") ?? "");
    const file = formData.get("proofFile");
    if (!resultId || !(file instanceof File) || file.size === 0) return;

    const bytes = Buffer.from(await file.arrayBuffer());
    const extension = path.extname(file.name || "").toLowerCase() || ".png";
    const fileName = `${resultId}-${file.lastModified || 0}${extension}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "proofs");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), bytes);
    const proofUrl = `/uploads/proofs/${fileName}`;

    await prisma.drawResult.updateMany({
      where: { id: resultId, userId: user.id },
      data: { proofUrl },
    });
    revalidatePath("/dashboard");
  }

  async function addDonationAction(formData: FormData) {
    "use server";
    const payload = donationSchema.safeParse({
      amount: formData.get("amount"),
    });
    if (!payload.success) return;

    await prisma.donation.create({
      data: {
        userId: user.id,
        amount: payload.data.amount,
      },
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        subject: "Donation recorded",
        message: `Your independent donation of ${payload.data.amount} has been recorded.`,
      },
    });
    revalidatePath("/dashboard");
  }

  async function cancelSubscriptionAction() {
    "use server";
    await prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { status: SubscriptionStatus.CANCELLED },
    });
    await prisma.notification.create({
      data: {
        userId: user.id,
        subject: "Subscription cancelled",
        message: "Your subscription has been cancelled. You can reactivate anytime.",
      },
    });
    revalidatePath("/dashboard");
  }

  if (user.role === "ADMIN") {
    redirect("/admin");
  }

  const canUseSubscriberFeatures = user.subscription?.status === SubscriptionStatus.ACTIVE;
  const totalWon = user.drawResults.reduce((sum, result) => sum + result.payoutAmount, 0);
  const totalDonations = user.donations.reduce((sum, donation) => sum + donation.amount, 0);
  const publishedDraws = await prisma.draw.count({ where: { isPublished: true } });

  return (
    <div className="grid w-full gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card title="Subscription">
          {user.subscription?.status ?? "INACTIVE"} ({user.subscription?.plan ?? "NONE"})
        </Card>
        <Card title="Renewal">
          {user.subscription?.renewalDate ? format(user.subscription.renewalDate, "dd MMM yyyy") : "-"}
        </Card>
        <Card title="Charity">
          {user.charity?.name ?? "Not selected"} ({user.charityPercent}%)
        </Card>
        <Card title="Total Won">{totalWon}</Card>
      </section>

      {!canUseSubscriberFeatures ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your subscription is not active. Score entry and draw participation are restricted until reactivation.
        </section>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Score Entry (Stableford)</h2>
          <p className="text-sm text-slate-600">Keep your latest five scores. Score range is 1-45.</p>
          <form action={addScoreAction} className="mt-4 grid gap-2">
            <input type="date" name="scoreDate" required className="rounded-md border border-slate-300 px-3 py-2" />
            <input
              type="number"
              name="value"
              min={1}
              max={45}
              required
              disabled={!canUseSubscriberFeatures}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <button
              disabled={!canUseSubscriberFeatures}
              className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Save score
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {user.scores.map((score) => (
              <div key={score.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  {format(score.scoreDate, "dd MMM yyyy")} - {score.value}
                </span>
                <form action={deleteScoreAction}>
                  <input type="hidden" name="scoreId" value={score.id} />
                  <button className="text-rose-600">Delete</button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Participation & Winnings</h2>
          <p className="text-sm text-slate-600">Published draws: {publishedDraws}</p>
          <form action={updatePlanAction} className="mt-3 flex gap-2">
            <select name="plan" className="rounded-md border border-slate-300 px-3 py-2">
              <option value={Plan.MONTHLY}>Monthly</option>
              <option value={Plan.YEARLY}>Yearly</option>
            </select>
            <button className="rounded-md border border-slate-300 px-3 py-2">Update plan</button>
          </form>
          <form action={cancelSubscriptionAction} className="mt-2">
            <button className="rounded-md border border-rose-300 px-3 py-1 text-rose-700">Cancel subscription</button>
          </form>
          <div className="mt-4 space-y-2">
            {user.drawResults.length === 0 ? (
              <p className="text-sm text-slate-600">No winnings yet.</p>
            ) : (
              user.drawResults.map((result) => (
                <div key={result.id} className="rounded-md border p-3 text-sm">
                  <p>
                    Tier {result.tier} - Amount {result.payoutAmount} - {result.status}
                  </p>
                  <form action={uploadProofAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="resultId" value={result.id} />
                    <input
                      type="file"
                      name="proofFile"
                      accept="image/*"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1"
                    />
                    <button className="rounded-md bg-slate-900 px-3 py-1 text-white">Upload proof</button>
                  </form>
                  {result.proofUrl ? (
                    <a href={result.proofUrl} className="mt-1 inline-block text-xs text-indigo-700">
                      View uploaded proof
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Independent Donation</h2>
          <p className="text-sm text-slate-600">Optional one-off donation not tied to gameplay.</p>
          <form action={addDonationAction} className="mt-3 flex gap-2">
            <input
              type="number"
              name="amount"
              min={1}
              required
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Amount"
            />
            <button className="rounded-md bg-emerald-600 px-3 py-2 font-medium text-white">Donate</button>
          </form>
          <p className="mt-3 text-sm font-medium">Total independent donations: {totalDonations}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">System Notifications</h2>
          <div className="mt-3 space-y-2 text-sm">
            {user.notifications.length === 0 ? (
              <p className="text-slate-600">No notifications yet.</p>
            ) : (
              user.notifications.map((notification) => (
                <div key={notification.id} className="rounded-md border p-2">
                  <p className="font-medium">{notification.subject}</p>
                  <p className="text-slate-600">{notification.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold">{children}</p>
    </div>
  );
}
