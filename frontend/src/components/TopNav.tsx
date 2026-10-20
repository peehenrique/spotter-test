import type { MouseEvent } from "react";

const LINKS = [
  { label: "Routing", target: ".planner" },
  { label: "Forecast", target: ".analysis" },
  { label: "Timeline", target: ".timeline" },
];

export function TopNav() {
  return (
    <header className="topnav">
      <a className="brand" href="#routing" onClick={(event) => jump(event, ".planner")}>
        <img src="/spotter-logo.webp" alt="spotter.ai" />
      </a>
      <nav className="topnav-links" aria-label="Workspace">
        {LINKS.map((link, index) => (
          <a
            key={link.label}
            href={`#${link.label.toLowerCase()}`}
            className={index === 0 ? "current" : undefined}
            onClick={(event) => jump(event, link.target)}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function jump(event: MouseEvent<HTMLAnchorElement>, selector: string) {
  event.preventDefault();
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
