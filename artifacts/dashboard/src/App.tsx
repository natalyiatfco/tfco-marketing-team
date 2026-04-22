import { Layout } from "./components/layout";
import Dashboard from "./pages/dashboard";
import Agents from "./pages/agents";
import Tasks from "./pages/tasks";
import NewTask from "./pages/new-task";
import TaskDetail from "./pages/task-detail";
import Reviews from "./pages/reviews";
import Properties from "./pages/properties";
import NewProperty from "./pages/new-property";
import PropertyDetail from "./pages/property-detail";
import Schedules from "./pages/schedules";
import Reports from "./pages/reports";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/agents" component={Agents} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/tasks/new" component={NewTask} />
        <Route path="/tasks/:id" component={TaskDetail} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/properties" component={Properties} />
        <Route path="/properties/new" component={NewProperty} />
        <Route path="/properties/:id" component={PropertyDetail} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/reports" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;