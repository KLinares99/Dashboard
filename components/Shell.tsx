"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Icon, Mark } from "./Icon";

export type NavItem = { href: string; label: string; icon: string; badge?: { text: string; tone?: "red" } };

export function Shell({
  nav, children, footLabel, who,
}: { nav: NavItem[]; children: React.ReactNode; footLabel: string; who: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    try {
      const t = localStorage.getItem("ecc-theme");
      if (t) document.documentElement.dataset.theme = t;
    } catch {}
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("ecc-theme", root.dataset.theme); } catch {}
  };

  const isActive = (href: string) =>
    href === nav[0].href ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className={`shell${open ? " open" : ""}`}>
      <aside className="side" aria-label="Main navigation">
        <div className="brand">
          <Mark />
          <div>
            <div className="brand-name">Elevate</div>
            <div className="brand-sub">BUSINESS<br />SOLUTIONS</div>
          </div>
          <button className="side-close" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon name="x" />
          </button>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.badge && <span className={`badge ${n.badge.tone ?? ""}`}>{n.badge.text}</span>}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <b>{footLabel}</b>
          <span className="who">{who}</span>
          <div className="side-btns">
            <button className="side-btn" type="button" onClick={toggleTheme}>Switch theme</button>
            <form action="/auth/signout" method="post"><button className="side-btn" type="submit">Sign out</button></form>
          </div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <MenuContext.Provider value={() => setOpen(true)}>{children}</MenuContext.Provider>
      </div>
    </div>
  );
}

const MenuContext = createContext<() => void>(() => {});

export function TopBar({ eyebrow, title, actions, children }: {
  eyebrow: string; title: string; actions?: React.ReactNode; children?: React.ReactNode;
}) {
  const openMenu = useContext(MenuContext);
  return (
    <header className="top">
      <div className="top-row">
        <button className="menu-btn" type="button" aria-label="Open menu" onClick={openMenu}><Icon name="menu" /></button>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        {actions && <div className="top-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
