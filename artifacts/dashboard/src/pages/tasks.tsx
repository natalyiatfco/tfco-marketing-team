import { useListTasks, useListAgents, useListProperties, useListSchedules } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { format } from "date-fns";
import { CheckCircle2, Clock, Loader2, AlertCircle, CalendarClock, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function parseScheduleId(search: string): string {
  const raw = new URLSearchParams(search).get("scheduleId");
  if (!raw) return "all";
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? "all" : String(n);
}

export default function Tasks() {
  const search = useSearch();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [scheduleFilter, setScheduleFilter] = useState<string>(() => parseScheduleId(search));

  useEffect(() => {
    setScheduleFilter(parseScheduleId(search));
  }, [search]);

  const { data: tasks, isLoading: isLoadingTasks } = useListTasks({
    status: statusFilter !== "all" ? statusFilter : undefined,
    agentId: agentFilter !== "all" ? Number(agentFilter) : undefined,
    propertyId: propertyFilter !== "all" ? Number(propertyFilter) : undefined,
    scheduleId: scheduleFilter !== "all" ? Number(scheduleFilter) : undefined,
  });

  const { data: agents } = useListAgents();
  const { data: properties } = useListProperties();
  const { data: schedules } = useListSchedules();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Queue</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor agent assignments.</p>
        </div>
        <Link href="/tasks/new">
          <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer">
            Create Task
          </div>
        </Link>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList>
          <TabsTrigger value="manual">Manual Tasks</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="mt-6">
          <div className="text-center py-20 border border-dashed rounded-xl bg-muted/20">
            <CalendarClock className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-semibold">Scheduled Tasks — Coming Soon</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Set recurring tasks for your AI agents — weekly blog posts, monthly SEO audits, daily social content — and they'll run automatically on schedule.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-6">

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Agent</label>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map(a => (
                <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Property</label>
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Scheduled by</label>
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Schedules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schedules</SelectItem>
              {(schedules as { id: number; name: string }[] | undefined)?.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoadingTasks ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-muted rounded-xl"></div>)}
        </div>
      ) : (
        <div className="space-y-4">
          {tasks?.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center text-white"
                    style={{ backgroundColor: task.agentColor }}
                  >
                    {task.agentIcon}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">{task.propertyName}</span>
                      <span className="text-muted-foreground/50 text-xs">&bull;</span>
                      <span className="text-sm text-muted-foreground">{format(new Date(task.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <h3 className="font-semibold text-lg truncate">{task.title}</h3>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      Agent: {task.agentName}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:ml-auto">
                    {task.status === 'pending' && <Badge variant="secondary" className="gap-1.5"><Clock className="w-3 h-3" /> Pending</Badge>}
                    {task.status === 'running' && <Badge variant="default" className="gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Running</Badge>}
                    {task.status === 'reviewing' && <Badge className="gap-1.5 bg-blue-600"><Loader2 className="w-3 h-3 animate-spin" /> Manager Reviewing</Badge>}
                    {task.status === 'completed' && <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-600/30 bg-amber-600/10"><Clock className="w-3 h-3" /> Awaiting Approval</Badge>}
                    {task.status === 'approved' && <Badge className="gap-1.5 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>}
                    {task.status === 'revision_requested' && <Badge variant="outline" className="gap-1.5 border-primary text-primary"><RefreshCw className="w-3 h-3" /> Revision Needed</Badge>}
                    {task.status === 'rejected' && <Badge variant="destructive" className="gap-1.5"><AlertCircle className="w-3 h-3" /> Rejected</Badge>}
                    {task.status === 'failed' && <Badge variant="destructive" className="gap-1.5"><AlertCircle className="w-3 h-3" /> Failed</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {tasks?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
              No tasks found matching your filters.
            </div>
          )}
        </div>
      )}

        </TabsContent>
      </Tabs>
    </div>
  );
}
