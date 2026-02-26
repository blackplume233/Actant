import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Shell } from "@/components/layout/shell";
import { CommandCenter } from "@/pages/command-center";
import { LiveCanvas } from "@/pages/live-canvas";
import { AgentsPage } from "@/pages/agents";
import { AgentDetailPage } from "@/pages/agent-detail";
import { AgentChatPage } from "@/pages/agent-chat";
import { ActivityPage } from "@/pages/activity";
import { EventsPage } from "@/pages/events";
import { SettingsPage } from "@/pages/settings";
import { NotFound } from "@/pages/not-found";

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/canvas" element={<LiveCanvas />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/agents/:name" element={<AgentDetailPage />} />
          <Route path="/agents/:name/chat" element={<AgentChatPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
