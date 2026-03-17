import type { Severity } from '@/types/annotations';

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  major: 'bg-amber-100 text-amber-800',
  minor: 'bg-blue-100 text-blue-800',
  info: 'bg-gray-100 text-gray-800',
};

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[severity]}`}
      data-testid="severity-badge"
    >
      {severity}
    </span>
  );
}
