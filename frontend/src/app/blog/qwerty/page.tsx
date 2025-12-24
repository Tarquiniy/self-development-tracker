// frontend/src/app/blog/qwerty/page.tsx
import React from "react";

export default function StaticQwertyTest() {
  return (
    <main style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ color: "#111" }}>STATIC OVERRIDE — /blog/qwerty</h1>
      <p>This file is a static test placed at <code>app/blog/qwerty/page.tsx</code>.</p>
      <p>If you see this — your deployed app DOES use the files you just pushed.</p>
      <p>If you still see 404 — your pushed changes are not being used by the deployed site (wrong branch/root).</p>
    </main>
  );
}
