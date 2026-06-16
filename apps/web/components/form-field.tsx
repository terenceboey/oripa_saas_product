import { Input, Stack, Text } from "@mantine/core";
import { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  children: ReactNode;
};

export function FormField({ label, children }: FormFieldProps) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        {label}
      </Text>
      <Input.Wrapper label={null}>{children}</Input.Wrapper>
    </Stack>
  );
}
