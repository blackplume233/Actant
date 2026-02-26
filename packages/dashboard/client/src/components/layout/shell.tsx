import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import { RealtimeProvider, useRealtimeContext } from "@/hooks/use-realtime";
import { ToastProvider } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { status } = useRealtimeContext();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar status={status} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar status={status} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <ToastContainer />
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <ToastProvider>
        <ShellInner>{children}</ShellInner>
      </ToastProvider>
    </RealtimeProvider>
  );
}
