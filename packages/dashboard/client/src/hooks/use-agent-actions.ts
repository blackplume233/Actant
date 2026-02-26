import { useState, useCallback } from "react";
import { agentApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type AgentAction = "start" | "stop" | "destroy";

const actionLabels: Record<AgentAction, { verb: string; past: string }> = {
  start: { verb: "Starting", past: "started" },
  stop: { verb: "Stopping", past: "stopped" },
  destroy: { verb: "Destroying", past: "destroyed" },
};

export function useAgentActions(agentName: string) {
  const [loading, setLoading] = useState<string | null>(null);
  const { addToast } = useToast();

  const execute = useCallback(
    async (action: AgentAction): Promise<boolean> => {
      const label = actionLabels[action];
      setLoading(action);
      try {
        if (action === "start") await agentApi.start(agentName);
        else if (action === "stop") await agentApi.stop(agentName);
        else if (action === "destroy") await agentApi.destroy(agentName);

        addToast({
          title: `Agent ${label.past}`,
          description: `"${agentName}" has been ${label.past} successfully.`,
          variant: "success",
          duration: 3000,
        });
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        addToast({
          title: `Failed to ${action} agent`,
          description: `${agentName}: ${message}`,
          variant: "error",
          duration: 6000,
          action:
            action !== "destroy"
              ? {
                  label: "Retry",
                  onClick: () => void execute(action),
                }
              : undefined,
        });
        return false;
      } finally {
        setLoading(null);
      }
    },
    [agentName, addToast],
  );

  return { loading, execute };
}
