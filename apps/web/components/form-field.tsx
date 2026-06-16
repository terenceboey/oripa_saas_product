import { Input } from "@mantine/core";
import { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <Input.Wrapper className={className} label={label}>
      {children}
    </Input.Wrapper>
  );
}
