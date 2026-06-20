"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Grid2X2, Radio, UserRound } from "lucide-react";
import type { ReactNode } from "react";

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const navItems = [
  { href: "/dashboard", icon: <Grid2X2 size={16} />, label: "Dashboard" },
  {
    href: "/dashboard/assessments",
    icon: <ClipboardCheck size={16} />,
    label: "Assessments",
  },
  { href: "/dashboard/candidates", icon: <UserRound size={16} />, label: "Candidates" },
  { href: "/dashboard/sessions", icon: <Radio size={16} />, label: "Interviews" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-white">
      <section className="grid min-h-screen w-full grid-cols-1 bg-white lg:grid-cols-[200px_1fr]">
        <aside className="flex flex-col border-b border-[#ece9e5] bg-white px-3 py-4 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <Link className="text-lg font-mono font-semibold text-[#202322]" href="/dashboard">
            chayote
          </Link>

          <nav className="mt-5 grid gap-1 sm:grid-cols-3 lg:block lg:space-y-1">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  className={classNames(
                    "flex h-7 items-center gap-2 rounded-[3px] px-2 text-left text-[13px] font-medium transition duration-150",
                    active
                      ? "bg-[#ebe9e6] text-[#202322]"
                      : "text-[#4f544b] hover:bg-[#efedea] hover:text-[#202322]",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            className="mt-5 flex h-7 items-center gap-2 rounded-[3px] px-2 text-[13px] font-medium text-[#51554c] transition duration-150 hover:bg-[#efedea] hover:text-[#202322] lg:mt-auto"
            href="/auth"
          >
            <UserRound size={16} />
            <span>Account</span>
          </Link>
        </aside>

        <div className="min-w-0 bg-white px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
          {children}
        </div>
      </section>
    </main>
  );
}
