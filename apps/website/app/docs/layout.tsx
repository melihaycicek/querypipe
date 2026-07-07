import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { GITHUB_URL } from "@/lib/site";
import { Wordmark } from "@/components/wordmark";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      githubUrl={GITHUB_URL}
      nav={{
        title: <Wordmark className="text-[15px]" />,
        url: "/",
      }}
    >
      {children}
    </DocsLayout>
  );
}
