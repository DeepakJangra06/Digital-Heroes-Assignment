import { DrawLogic, PayoutStatus, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runDraw } from "@/lib/services";

const charitySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(5),
  upcomingEvent: z.string().optional(),
});

export default async function AdminPage() {
  await requireAdmin();

  const [users, charities, draws, results, scores] = await Promise.all([
    prisma.user.findMany({ include: { subscription: true, charity: true }, orderBy: { createdAt: "desc" } }),
    prisma.charity.findMany({ orderBy: { isFeatured: "desc" } }),
    prisma.draw.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], take: 6 }),
    prisma.drawResult.findMany({
      include: { user: true, draw: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.score.findMany({
      include: { user: true },
      orderBy: { scoreDate: "desc" },
      take: 20,
    }),
  ]);

  async function createCharityAction(formData: FormData) {
    "use server";
    const parsed = charitySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      upcomingEvent: formData.get("upcomingEvent") || undefined,
    });
    if (!parsed.success) return;

    await prisma.charity.create({
      data: {
        ...parsed.data,
      },
    });
    revalidatePath("/admin");
  }

  async function deleteCharityAction(formData: FormData) {
    "use server";
    const charityId = String(formData.get("charityId") ?? "");
    if (!charityId) return;
    await prisma.charity.delete({ where: { id: charityId } });
    revalidatePath("/admin");
  }

  async function runDrawAction(formData: FormData) {
    "use server";
    const logic = String(formData.get("logic")) === DrawLogic.ALGORITHMIC ? DrawLogic.ALGORITHMIC : DrawLogic.RANDOM;
    const publish = String(formData.get("publish")) === "on";
    await runDraw({ logicType: logic, publish });
    revalidatePath("/admin");
  }

  async function updateWinnerAction(formData: FormData) {
    "use server";
    const resultId = String(formData.get("resultId") ?? "");
    const statusRaw = String(formData.get("status") ?? "");
    if (!resultId || !(statusRaw in PayoutStatus)) return;

    await prisma.drawResult.update({
      where: { id: resultId },
      data: { status: statusRaw as PayoutStatus },
    });
    revalidatePath("/admin");
  }

  async function updateSubscriptionStatusAction(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!userId || !(status in SubscriptionStatus)) return;

    await prisma.subscription.updateMany({
      where: { userId },
      data: { status: status as SubscriptionStatus },
    });
    revalidatePath("/admin");
  }

  async function updateScoreAction(formData: FormData) {
    "use server";
    const scoreId = String(formData.get("scoreId") ?? "");
    const value = Number(formData.get("value"));
    if (!scoreId || Number.isNaN(value) || value < 1 || value > 45) return;

    await prisma.score.update({
      where: { id: scoreId },
      data: { value },
    });
    revalidatePath("/admin");
  }

  const totalPrizePool = users.reduce((sum, user) => sum + (user.subscription?.amount ?? 0), 0);
  const totalCharity = users.reduce(
    (sum, user) => sum + Math.round(((user.subscription?.amount ?? 0) * user.charityPercent) / 100),
    0,
  );

  return (
    <div className="grid w-full gap-6">
      <section className="grid gap-4 md:grid-cols-4">
        <AdminCard title="Total Users" value={String(users.length)} />
        <AdminCard title="Prize Pool" value={String(totalPrizePool)} />
        <AdminCard title="Charity Contributions" value={String(totalCharity)} />
        <AdminCard title="Draws Created" value={String(draws.length)} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Draw Management</h2>
          <form action={runDrawAction} className="mt-4 grid gap-2">
            <select name="logic" className="rounded-md border border-slate-300 px-3 py-2">
              <option value={DrawLogic.RANDOM}>Random</option>
              <option value={DrawLogic.ALGORITHMIC}>Algorithmic</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publish" />
              Publish result (unchecked = simulation mode)
            </label>
            <button className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white">Run draw</button>
          </form>
          <div className="mt-4 space-y-2 text-sm">
            {draws.map((draw) => (
              <div key={draw.id} className="rounded-md border p-2">
                {draw.month}/{draw.year} - {draw.logicType} - {draw.isPublished ? "Published" : "Simulation"} -
                Numbers: {draw.winningNumbersCsv}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Charity Management</h2>
          <form action={createCharityAction} className="mt-4 grid gap-2">
            <input name="name" placeholder="Charity name" className="rounded-md border border-slate-300 px-3 py-2" />
            <input name="slug" placeholder="slug" className="rounded-md border border-slate-300 px-3 py-2" />
            <input
              name="description"
              placeholder="Description"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <input
              name="upcomingEvent"
              placeholder="Upcoming event"
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <button className="rounded-md bg-slate-900 px-3 py-2 text-white">Add Charity</button>
          </form>
          <div className="mt-4 space-y-2 text-sm">
            {charities.map((charity) => (
              <div key={charity.id} className="flex items-center justify-between rounded-md border p-2">
                <span>{charity.name}</span>
                <form action={deleteCharityAction}>
                  <input type="hidden" name="charityId" value={charity.id} />
                  <button className="text-rose-600">Delete</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">User & Subscription Management</h2>
        <div className="mt-3 space-y-2 text-sm">
          {users.slice(0, 20).map((user) => (
            <div key={user.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-4 md:items-center">
              <span>{user.email}</span>
              <span>{user.subscription?.plan ?? "No Plan"}</span>
              <span>{user.subscription?.status ?? "NO_SUBSCRIPTION"}</span>
              <form action={updateSubscriptionStatusAction} className="flex gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <select
                  name="status"
                  defaultValue={user.subscription?.status ?? SubscriptionStatus.ACTIVE}
                  className="rounded-md border border-slate-300 px-2 py-1"
                >
                  <option value={SubscriptionStatus.ACTIVE}>Active</option>
                  <option value={SubscriptionStatus.LAPSED}>Lapsed</option>
                  <option value={SubscriptionStatus.CANCELLED}>Cancelled</option>
                </select>
                <button className="rounded-md border border-slate-300 px-2 py-1">Save</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Score Moderation</h2>
        <div className="mt-3 space-y-2 text-sm">
          {scores.map((score) => (
            <div key={score.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-4 md:items-center">
              <span>{score.user.email}</span>
              <span>{score.scoreDate.toLocaleDateString()}</span>
              <span>Current: {score.value}</span>
              <form action={updateScoreAction} className="flex gap-2">
                <input type="hidden" name="scoreId" value={score.id} />
                <input
                  type="number"
                  name="value"
                  min={1}
                  max={45}
                  defaultValue={score.value}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1"
                />
                <button className="rounded-md border border-slate-300 px-2 py-1">Update</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Winners Verification & Payout</h2>
        <div className="mt-3 space-y-2 text-sm">
          {results.map((result) => (
            <div key={result.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-4 md:items-center">
              <span>
                {result.user.email} | Tier {result.tier} | {result.payoutAmount}
              </span>
              <span>
                {result.proofUrl ? (
                  <a href={result.proofUrl} className="text-indigo-700">
                    Proof submitted
                  </a>
                ) : (
                  "Proof pending"
                )}
              </span>
              <span>{result.status}</span>
              <form action={updateWinnerAction} className="flex gap-2">
                <input type="hidden" name="resultId" value={result.id} />
                <select name="status" defaultValue={result.status} className="rounded-md border border-slate-300 px-2 py-1">
                  <option value={PayoutStatus.PENDING}>Pending</option>
                  <option value={PayoutStatus.PAID}>Paid</option>
                  <option value={PayoutStatus.REJECTED}>Rejected</option>
                </select>
                <button className="rounded-md border border-slate-300 px-2 py-1">Save</button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
