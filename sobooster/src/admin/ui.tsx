import { useId, type ReactNode } from 'react';

/** Small Polaris-style building blocks for the admin pages. */

export function Card({ title, description, actions, children }: { title?: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section className="sb-admin__card">
      {(title || actions) && (
        <header className="sb-admin__card-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="sb-admin__muted">{description}</p>}
          </div>
          {actions && <div className="sb-admin__row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Checkbox({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="sb-admin__check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {label}
        {help && <span className="sb-admin__help">{help}</span>}
      </label>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  help,
  placeholder,
  type = 'text',
  min,
  max,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  help?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'color';
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="sb-admin__field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} min={min} max={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {help && <span className="sb-admin__help">{help}</span>}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  help?: string;
}) {
  const id = useId();
  return (
    <div className="sb-admin__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(options.find((o) => o.value === e.target.value)?.value ?? value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <span className="sb-admin__help">{help}</span>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  href,
  target,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'plain' | 'critical';
  disabled?: boolean;
  href?: string;
  target?: string;
  label?: string;
}) {
  const className = `sb-admin__button sb-admin__button--${variant}`;
  if (href) {
    return (
      <a className={className} href={href} target={target} rel={target === '_blank' ? 'noreferrer' : undefined} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label}>
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'attention'; children: ReactNode }) {
  return <span className={`sb-admin__badge sb-admin__badge--${tone}`}>{children}</span>;
}

/** Shows an App Bridge toast in the admin; logs outside it. */
export function toast(message: string, isError = false): void {
  const bridge = (window as { shopify?: { toast?: { show: (m: string, o?: { isError?: boolean }) => void } } }).shopify;
  if (bridge?.toast) bridge.toast.show(message, { isError });
  else console.info(`[toast] ${message}`);
}
