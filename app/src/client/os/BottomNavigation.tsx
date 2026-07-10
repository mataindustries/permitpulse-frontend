import { Icon } from "../design-system/icons";
import { osNavigationItems, type OsDestination } from "./navigation";

interface BottomNavigationProps {
  active: OsDestination;
  onNavigate: (destination: OsDestination) => void;
}

export function BottomNavigation({
  active,
  onNavigate,
}: BottomNavigationProps) {
  return (
    <nav aria-label="PermitPulse OS" className="os-bottom-nav">
      <div className="os-bottom-nav__inner">
        {osNavigationItems.map((item) => {
          const isActive = active === item.id;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={isActive ? "os-nav-item os-nav-item--active" : "os-nav-item"}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              type="button"
            >
              <span className="os-nav-item__indicator" aria-hidden="true" />
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
