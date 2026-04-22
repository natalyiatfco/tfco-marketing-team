import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Activity, CheckCircle2, Clock, Briefcase, CalendarClock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 5 });

  if (isLoadingSummary || isLoadingActivity) {
    return <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48"></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
      </div>
    </div>;
  }

  if (!summary) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground mt-1">Real-time overview of your digital marketing operations.</p>
        </div>
        <Link href="/tasks/new">
          <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer">
            Dispatch Task
          </div>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{summary.pendingApproval}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting manager review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks (Week)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.tasksThisWeek}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.totalTasks} total all time
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Output</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.approved}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready to publish
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalProperties}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Brands under management
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.upcomingSchedules && summary.upcomingSchedules.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                Upcoming Scheduled Tasks
              </CardTitle>
              <CardDescription>Next auto-dispatches from active schedules</CardDescription>
            </div>
            <Link href="/schedules">
              <span className="text-xs text-primary hover:underline cursor-pointer">Manage schedules →</span>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.upcomingSchedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: s.agentColor ?? "#6b7280" }}
                    >
                      {s.agentIcon}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.agentName} · {s.propertyName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs capitalize mb-1">{s.frequency}</Badge>
                    {s.nextRunAt && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.nextRunAt), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.tasksByProperty && summary.tasksByProperty.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cross-Property Performance Snapshot</CardTitle>
            <CardDescription>Task output and approval status across all managed properties</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.tasksByProperty.map((prop) => (
                <div key={prop.propertyId} className="flex items-center gap-4">
                  <div className="w-40 shrink-0 text-sm font-medium truncate" title={prop.propertyName}>
                    {prop.propertyName}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${summary.totalTasks > 0 ? Math.max(2, (prop.count / summary.totalTasks) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm text-muted-foreground w-8 text-right">{prop.count}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      ✓ {prop.approved}
                    </Badge>
                    {prop.pending > 0 && (
                      <Badge variant="outline" className="text-xs tabular-nums">
                        ⏳ {prop.pending}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Agent Workload</CardTitle>
            <CardDescription>Task distribution across your AI employees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.tasksByAgent.map((agent) => (
                <div key={agent.agentId} className="flex items-center">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center mr-4 text-white"
                    style={{ backgroundColor: agent.agentColor }}
                  >
                    <span className="text-xs">{agent.agentIcon}</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{agent.agentName}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${Math.max(5, (agent.count / summary.totalTasks) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 font-mono text-sm text-muted-foreground">
                    {agent.count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events across all properties</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentActivity?.map((activity) => (
                <div key={activity.taskId} className="flex items-start">
                  <div className="relative mr-4 mt-0.5">
                    <div 
                      className="w-3 h-3 rounded-full mt-1.5"
                      style={{ backgroundColor: activity.agentColor }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.agentName} <span className="text-muted-foreground font-normal">on</span> {activity.propertyName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.taskTitle}
                    </p>
                    <div className="flex items-center pt-1">
                      <Badge variant="outline" className="text-xs">
                        {activity.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity?.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}