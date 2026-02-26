import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import { SSEProvider, useSSEContext } from "@/hooks/use-sse";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { status } = useSSEContext();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar status={status} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar status={status} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SSEProvider>
      <ShellInner>{children}</ShellInner>
    </SSEProvider>
  );
}
