import {
  DrawLogic,
  PayoutStatus,
  Plan,
  SubscriptionStatus,
  type Prisma,
} from "@prisma/client";
import { addMonths, addYears } from "date-fns";
import { PLAN_PRICING } from "@/lib/constants";
import { getMatchCount, createWinningNumbers } from "@/lib/draw";
import { notifyUser } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function subscribeUser(userId: string, plan: Plan) {
  const now = new Date();
  const renewalDate = plan === Plan.MONTHLY ? addMonths(now, 1) : addYears(now, 1);
  const amount = PLAN_PRICING[plan];

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: { plan, amount, status: SubscriptionStatus.ACTIVE, renewalDate },
    create: { userId, plan, amount, status: SubscriptionStatus.ACTIVE, renewalDate },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await notifyUser(
      user.id,
      user.email,
      "Subscription updated",
      `Your ${plan.toLowerCase()} subscription is active until ${renewalDate.toDateString()}.`,
    );
  }

  return subscription;
}

export async function addOrUpdateScore(userId: string, scoreDate: Date, value: number) {
  const existing = await prisma.score.findUnique({
    where: { userId_scoreDate: { userId, scoreDate } },
  });

  if (existing) {
    return prisma.score.update({
      where: { id: existing.id },
      data: { value },
    });
  }

  const created = await prisma.score.create({
    data: { userId, scoreDate, value },
  });

  const scores = await prisma.score.findMany({
    where: { userId },
    orderBy: { scoreDate: "desc" },
  });

  if (scores.length > 5) {
    const overflow = scores.slice(5);
    await prisma.score.deleteMany({ where: { id: { in: overflow.map((s) => s.id) } } });
  }

  return created;
}

export async function deleteScore(scoreId: string, userId: string) {
  return prisma.score.deleteMany({ where: { id: scoreId, userId } });
}

export async function runDraw({
  logicType,
  publish,
}: {
  logicType: DrawLogic;
  publish: boolean;
}) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const allScores = await prisma.score.findMany();
  const winningNumbers = createWinningNumbers(logicType, allScores);

  const draw = await prisma.draw.upsert({
    where: { month_year: { month, year } },
    update: {
      logicType,
      winningNumbersCsv: winningNumbers.join(","),
      isPublished: publish,
    },
    create: {
      month,
      year,
      logicType,
      winningNumbersCsv: winningNumbers.join(","),
      isPublished: publish,
    },
  });

  if (!publish) return draw;

  await prisma.drawResult.deleteMany({ where: { drawId: draw.id } });
  const users = await prisma.user.findMany({ include: { subscription: true, scores: true } });
  const activeUsers = users.filter((u) => u.subscription?.status === SubscriptionStatus.ACTIVE);

  const totalPool = activeUsers.reduce((sum, user) => sum + (user.subscription?.amount ?? 0), 0);
  const allocation = {
    5: Math.round(totalPool * 0.4),
    4: Math.round(totalPool * 0.35),
    3: Math.round(totalPool * 0.25),
  };

  const candidates = activeUsers
    .map((u) => {
      const latestScores = [...u.scores]
        .sort((a, b) => b.scoreDate.getTime() - a.scoreDate.getTime())
        .slice(0, 5)
        .map((s) => s.value);
      const matchCount = getMatchCount(latestScores, winningNumbers);
      return { userId: u.id, matchCount };
    })
    .filter((c) => c.matchCount >= 3);

  const byTier = new Map<number, string[]>();
  for (const c of candidates) {
    const current = byTier.get(c.matchCount) ?? [];
    current.push(c.userId);
    byTier.set(c.matchCount, current);
  }

  const data: Prisma.DrawResultCreateManyInput[] = [];
  for (const tier of [5, 4, 3]) {
    const winners = byTier.get(tier) ?? [];
    if (!winners.length) continue;
    const perWinner = Math.floor(allocation[tier as 5 | 4 | 3] / winners.length);
    for (const userId of winners) {
      data.push({
        drawId: draw.id,
        userId,
        tier,
        matchCount: tier,
        payoutAmount: perWinner,
        status: PayoutStatus.PENDING,
      });
    }
  }

  if (data.length > 0) {
    await prisma.drawResult.createMany({ data });

    const winners = await prisma.drawResult.findMany({
      where: { drawId: draw.id },
      include: { user: true },
    });

    for (const winner of winners) {
      await notifyUser(
        winner.user.id,
        winner.user.email,
        "Draw result published",
        `You won in tier ${winner.tier}. Payout amount: ${winner.payoutAmount}. Submit proof for verification.`,
      );
    }
  }

  return draw;
}

export async function syncSubscriptionStatusForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) return null;

  if (subscription.status === SubscriptionStatus.ACTIVE && subscription.renewalDate < new Date()) {
    return prisma.subscription.update({
      where: { userId },
      data: { status: SubscriptionStatus.LAPSED },
    });
  }

  return subscription;
}

export async function setSubscriptionStatus(userId: string, status: SubscriptionStatus) {
  return prisma.subscription.updateMany({
    where: { userId },
    data: { status },
  });
}
