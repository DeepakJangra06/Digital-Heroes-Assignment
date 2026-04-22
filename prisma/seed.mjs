import { PrismaClient, Role, Plan, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const charities = [
    {
      name: "Tee for Tomorrow",
      slug: "tee-for-tomorrow",
      description: "Youth scholarships and community golf mentoring.",
      isFeatured: true,
      upcomingEvent: "April Charity Open",
    },
    {
      name: "GreenHope Health Fund",
      slug: "greenhope-health-fund",
      description: "Medical support for low-income families.",
      upcomingEvent: "Summer Wellness Cup",
    },
    {
      name: "Fairway Food Relief",
      slug: "fairway-food-relief",
      description: "Nutrition programs for underserved neighborhoods.",
      upcomingEvent: "Community Drive Day",
    },
  ];

  for (const charity of charities) {
    await prisma.charity.upsert({
      where: { slug: charity.slug },
      update: charity,
      create: charity,
    });
  }

  const featuredCharity = await prisma.charity.findFirst({ where: { isFeatured: true } });
  const adminPassword = await bcrypt.hash("Admin@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@digitalheroes.dev" },
    update: {},
    create: {
      name: "Platform Admin",
      email: "admin@digitalheroes.dev",
      passwordHash: adminPassword,
      role: Role.ADMIN,
      charityPercent: 10,
      charityId: featuredCharity?.id,
    },
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      plan: Plan.YEARLY,
      amount: 1200,
      status: SubscriptionStatus.ACTIVE,
      renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    },
  });

  console.log("Seed completed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
