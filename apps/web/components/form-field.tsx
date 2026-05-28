import { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <label className={className ?? "muted tiny"}>
      {label}
      {children}
    </label>
  );
}

