// frontend/src/components/theme-provider.tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Props берём из реального компонента next-themes,
 * чтобы не зависеть от внутренних путей/экспортов.
 */
type NextThemesProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: NextThemesProps & { children: React.ReactNode }) {
  return <NextThemesProvider {...(props as NextThemesProps)}>{children}</NextThemesProvider>;
}
