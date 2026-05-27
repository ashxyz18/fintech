import type { ReactNode } from 'react';

interface KpiProps {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  valueClass?: string;
}

export function KPI({ label, value, trend, valueClass }: KpiProps) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`value ${valueClass ?? ''}`}>{value}</div>
      {trend != null && <div className="trend text-dim">{trend}</div>}
    </div>
  );
}
