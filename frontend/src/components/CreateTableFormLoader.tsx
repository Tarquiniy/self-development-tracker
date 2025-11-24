// frontend/src/components/CreateTableFormLoader.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

const CreateTableForm = dynamic(
  () => import("@/components/CreateTableForm"),
  { ssr: false }
);

export default function CreateTableFormLoader() {
  return <CreateTableForm />;
}
