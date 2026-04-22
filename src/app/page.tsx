import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const charities = await prisma.charity.findMany({ orderBy: { isFeatured: "desc" } });
  const featured = charities.find((charity) => charity.isFeatured);

  return (
    <div className="flex w-full flex-col gap-10">
      <section className="grid gap-6 rounded-2xl bg-gradient-to-r from-indigo-700 to-violet-700 p-8 text-white md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm uppercase tracking-wide text-indigo-100">
            Build your game. Change lives.
          </p>
          <h1 className="text-3xl font-bold md:text-4xl">
            Golf scores, monthly draws, and measurable charity impact.
          </h1>
          <p className="mt-4 text-indigo-100">
            Subscribe, enter your latest 5 Stableford scores, and compete for monthly rewards while supporting a charity you care about.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/signup" className="rounded-md bg-white px-4 py-2 font-medium text-indigo-700">
              Start Subscription
            </Link>
            <Link href="/login" className="rounded-md border border-white px-4 py-2 font-medium">
              Existing Subscriber
            </Link>
          </div>
        </div>
        <div className="rounded-xl bg-white/10 p-5">
          <h2 className="text-lg font-semibold">How winners are picked</h2>
          <ul className="mt-3 space-y-2 text-sm text-indigo-50">
            <li>5-match tier receives 40% and rolls over when unclaimed.</li>
            <li>4-match tier receives 35% of the monthly pool.</li>
            <li>3-match tier receives 25% of the monthly pool.</li>
            <li>Draw logic can run in random or algorithmic mode.</li>
          </ul>
        </div>
      </section>

      <section id="charities" className="grid gap-4 md:grid-cols-3">
        {charities.map((charity) => (
          <article key={charity.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {charity.isFeatured ? (
              <span className="mb-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                Featured
              </span>
            ) : null}
            <h3 className="text-lg font-semibold">{charity.name}</h3>
            <p className="mt-2 text-sm text-slate-600">{charity.description}</p>
            {charity.upcomingEvent ? (
              <p className="mt-3 text-xs font-medium text-indigo-700">Upcoming: {charity.upcomingEvent}</p>
            ) : null}
          </article>
        ))}
      </section>

      {featured ? (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-900">
          Spotlight charity this month: <strong>{featured.name}</strong> - {featured.description}
        </section>
      ) : null}
    </div>
  );
}
