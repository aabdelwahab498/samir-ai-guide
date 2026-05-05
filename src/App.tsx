import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/layout/AppShell";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import Home from "./pages/app/Home";
import Tutor from "./pages/app/Tutor";
import Detective from "./pages/app/Detective";
import Quiz from "./pages/app/Quiz";
import Tracker from "./pages/app/Tracker";
import MultiChats from "./pages/app/MultiChats";
import Schedule from "./pages/app/Schedule";
import Groups from "./pages/app/Groups";
import Community from "./pages/app/Community";
import About from "./pages/app/About";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<Home />} />
              <Route path="tutor" element={<Tutor />} />
              <Route path="detective" element={<Detective />} />
              <Route path="quiz" element={<Quiz />} />
              <Route path="tracker" element={<Tracker />} />
              <Route path="chats" element={<MultiChats />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="groups" element={<Groups />} />
              <Route path="community" element={<Community />} />
              <Route path="about" element={<About />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
