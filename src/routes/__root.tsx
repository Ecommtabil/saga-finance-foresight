import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initSentry, Sentry } from "../lib/sentry";
import { SagaProvider } from "../lib/saga/context";
import { SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import { AppSidebar } from "../components/saga/AppSidebar";
import { ProjectActions } from "../components/saga/ProjectActions";
import { CHAVE_SELECAO, SelecaoProjeto } from "../components/saga/SelecaoProjeto";
import { Toaster } from "../components/ui/sonner";

initSentry();

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SAGA — Análise e Avaliação de Empresas" },
      { name: "description", content: "SAGA: sistema de análise e valuation de empresas com upload de planilha modelo." },
      { property: "og:title", content: "SAGA — Análise e Avaliação de Empresas" },
      { property: "og:description", content: "Análise financeira, indicadores e valuation DCF a partir de planilha Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      // Tinos: versão web do Times New Roman (métricamente compatível), usada nos números.
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isSimpl = pathname.startsWith("/modelagem-simplificada");
  const isOrcamento = pathname.startsWith("/orcamento");
  const isolado = isSimpl || isOrcamento;
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  // Tela de seleção de projeto: exibida antes do menu principal a cada sessão.
  if (montado && sessionStorage.getItem(CHAVE_SELECAO) !== "1") {
    return (
      <QueryClientProvider client={queryClient}>
        <SelecaoProjeto />
        <Toaster richColors />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SagaProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <div className={pathname === "/ncg" || pathname === "/volatilidade" || pathname === "/pvm" || pathname.startsWith("/viabilidade") || pathname.startsWith("/calculadoras") ? "flex min-w-0 flex-1 flex-col" : "flex flex-1 flex-col"}>
              <header className="flex h-12 items-center gap-2 border-b bg-card px-3">
                <SidebarTrigger />
                <span className="text-sm font-medium text-muted-foreground">
                  {isSimpl
                    ? "SAGA · Modelagem Simplificada (dados isolados)"
                    : isOrcamento
                      ? "SAGA · Orçamento (dados isolados)"
                      : "SAGA · Análise e Avaliação de Empresas"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <ProjectActions />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster richColors />
      </SagaProvider>
    </QueryClientProvider>
  );
}
