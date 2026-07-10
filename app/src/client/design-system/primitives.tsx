import {
  createElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

interface SurfaceCardProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "div" | "section";
  children: ReactNode;
  elevated?: boolean;
}

export function SurfaceCard({
  as = "section",
  children,
  className,
  elevated = false,
  ...props
}: SurfaceCardProps) {
  return createElement(
    as,
    {
      ...props,
      className: classes(
        "pp-surface-card",
        elevated && "pp-surface-card--elevated",
        className,
      ),
    },
    children,
  );
}

export type StatusTone = "danger" | "info" | "neutral" | "success" | "warning";

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusBadge({
  children,
  className,
  tone = "neutral",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={classes("pp-status-badge", `pp-status-badge--${tone}`, className)}
      {...props}
    >
      {children}
    </span>
  );
}

interface MetricChipProps extends HTMLAttributes<HTMLDivElement> {
  icon?: IconName;
  label: string;
  tone?: StatusTone | "jade";
  value: ReactNode;
}

export function MetricChip({
  className,
  icon,
  label,
  tone = "neutral",
  value,
  ...props
}: MetricChipProps) {
  return (
    <div className={classes("pp-metric-chip", `pp-metric-chip--${tone}`, className)} {...props}>
      {icon && (
        <span className="pp-metric-chip__icon">
          <Icon name={icon} size={16} />
        </span>
      )}
      <span className="pp-metric-chip__value">{value}</span>
      <span className="pp-metric-chip__label">{label}</span>
    </div>
  );
}

interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}

export function SectionHeader({
  action,
  className,
  description,
  eyebrow,
  title,
  ...props
}: SectionHeaderProps) {
  return (
    <div className={classes("pp-section-header", className)} {...props}>
      <div>
        {eyebrow && <p className="pp-section-header__eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="pp-section-header__description">{description}</p>}
      </div>
      {action && <div className="pp-section-header__action">{action}</div>}
    </div>
  );
}

interface ActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  icon?: IconName;
  iconAfter?: boolean;
}

function Action({
  children,
  className,
  fullWidth = false,
  icon,
  iconAfter = false,
  variant,
  ...props
}: ActionProps & { variant: "primary" | "secondary" }) {
  const iconNode = icon ? <Icon name={icon} size={18} /> : null;

  return (
    <button
      className={classes(
        "pp-action",
        `pp-action--${variant}`,
        fullWidth && "pp-action--full",
        className,
      )}
      {...props}
      type={props.type ?? "button"}
    >
      {!iconAfter && iconNode}
      <span>{children}</span>
      {iconAfter && iconNode}
    </button>
  );
}

export function PrimaryAction(props: ActionProps) {
  return <Action {...props} variant="primary" />;
}

export function SecondaryAction(props: ActionProps) {
  return <Action {...props} variant="secondary" />;
}

interface SkeletonLoaderProps {
  cards?: number;
  label?: string;
}

export function SkeletonLoader({
  cards = 3,
  label = "Loading content",
}: SkeletonLoaderProps) {
  return (
    <div aria-label={label} className="pp-skeleton-list" role="status">
      {Array.from({ length: cards }, (_, index) => (
        <div className="pp-skeleton-card" key={index}>
          <span className="pp-skeleton pp-skeleton--short" />
          <span className="pp-skeleton pp-skeleton--title" />
          <span className="pp-skeleton" />
          <span className="pp-skeleton pp-skeleton--metric" />
        </div>
      ))}
      <span className="pp-visually-hidden">{label}...</span>
    </div>
  );
}

interface EmptyStateProps {
  action?: ReactNode;
  description: string;
  icon?: IconName;
  title: string;
}

export function EmptyState({
  action,
  description,
  icon = "mission",
  title,
}: EmptyStateProps) {
  return (
    <SurfaceCard className="pp-empty-state">
      <span className="pp-empty-state__icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="pp-empty-state__action">{action}</div>}
    </SurfaceCard>
  );
}
