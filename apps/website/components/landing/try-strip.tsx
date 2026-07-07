"use client";

import { SimpleTabs } from "@/components/simple-tabs";
import { CanonicalizeDemo } from "./canonicalize-demo";
import { ErrorAnatomyDemo } from "./error-anatomy-demo";
import { GuardsDemo } from "./guards-demo";
import { ProgressiveSortDemo } from "./progressive-sort-demo";

export function TryStrip() {
  return (
    <SimpleTabs
      tabs={[
        { id: "sort", label: "thenSort", panel: <ProgressiveSortDemo /> },
        { id: "errors", label: "parse → Result", panel: <ErrorAnatomyDemo /> },
        { id: "canonical", label: "canonicalize", panel: <CanonicalizeDemo /> },
        { id: "guards", label: "guards", panel: <GuardsDemo /> },
      ]}
    />
  );
}
