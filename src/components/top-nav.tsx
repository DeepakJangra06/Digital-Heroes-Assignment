import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions";

export async function TopNav() {
  const session = await getSession();

  return (
    <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Digital Heroes
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/#charities" className="text-slate-600 hover:text-slate-900">
            Charities
          </Link>
          {session ? (
            <>
              <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
                Dashboard
              </Link>
              {session.role === "ADMIN" ? (
                <Link href="/admin" className="text-slate-600 hover:text-slate-900">
                  Admin
                </Link>
              ) : null}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
              >
                Subscribe
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
