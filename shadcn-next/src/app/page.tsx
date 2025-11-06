import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-16 px-6 py-16">
      <div className="space-y-6 text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Next.js 16 · React 19 · Tailwind CSS · shadcn/ui
        </p>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          프리미엄 UI 스타터로 더 빠르게 제품을 만드세요
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
          최신 Next.js 16과 React 19 스택에 맞춰 설정된 템플릿입니다. Tailwind
          CSS와 shadcn/ui 컴포넌트가 사전 구성되어 바로 기능 개발에 집중할 수
          있습니다.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Button asChild size="lg" className="px-8">
          <Link href="https://ui.shadcn.com" target="_blank" rel="noreferrer">
            컴포넌트 둘러보기
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="px-8">
          <Link
            href="https://github.com/shadcn/ui"
            target="_blank"
            rel="noreferrer"
          >
            <Github className="size-4" />
            GitHub
          </Link>
        </Button>
      </div>

      <div className="grid w-full max-w-4xl gap-6 rounded-xl border bg-card p-8 shadow-sm sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">모던 개발 경험</h2>
          <p className="text-sm text-muted-foreground">
            App Router, Server Actions, React 19의 새로운 기능 등을 활용할 수
            있도록 초기 설정을 손봤습니다.
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">디자인 일관성</h2>
          <p className="text-sm text-muted-foreground">
            shadcn/ui의 New York 스타일과 테마 토큰을 그대로 사용할 수 있어
            브랜딩에만 집중하면 됩니다.
          </p>
        </div>
      </div>
    </main>
  );
}
