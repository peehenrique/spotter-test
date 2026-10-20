import {
  IconChart,
  IconClipboard,
  IconHome,
  IconPhoto,
  IconSettings,
  IconTruck,
  IconUser,
  LogoMark,
} from "./icons";

const ITEMS = [
  { label: "Home", icon: IconHome },
  { label: "Routes", icon: IconClipboard, current: true },
  { label: "Driver", icon: IconUser },
  { label: "Fleet", icon: IconTruck },
  { label: "Capture", icon: IconPhoto },
  { label: "Reports", icon: IconChart },
];

export function IconRail() {
  return (
    <nav className="rail" aria-label="Workspace">
      <LogoMark />
      <div className="rail-list">
        {ITEMS.map((item) => {
          const Glyph = item.icon;
          return (
            <span
              key={item.label}
              className={item.current ? "rail-btn active" : "rail-btn"}
              title={item.label}
              aria-current={item.current ? "page" : undefined}
            >
              <Glyph />
            </span>
          );
        })}
      </div>
      <span className="rail-btn rail-end" title="Settings">
        <IconSettings />
      </span>
    </nav>
  );
}
