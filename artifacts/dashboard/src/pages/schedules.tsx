import { useState, useEffect } from "react";
import {
  useListSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useListProperties,
  useListAgents,
  useListTasks,
  getListSchedulesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Pencil, Trash2, Plus, Pause, Play, History, ExternalLink, CheckCircle2, XCircle, Clock, Loader2, Radio } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const scheduleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  propertyId: z.coerce.number().min(1, "Property is required"),
  agentId: z.coerce.number().min(1, "Agent is required"),
  taskType: z.string().min(1, "Task type is required"),
  inputPrompt: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfWeek: z.coerce.number().min(0).max(6).optional(),
  dayOfMonth: z.coerce.number().min(1).max(31).optional(),
  hour: z.coerce.number().min(0).max(23),
  timezone: z.string(),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

type ScheduleItem = {
  id: number;
  name: string;
  agentId: number;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  propertyId: number;
  propertyName: string;
  taskType: string;
  inputPrompt?: string | null;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  hour: number;
  timezone: string;
  status: "active" | "paused";
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastTaskId?: number | null;
};

function ScheduleDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ScheduleItem;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: properties = [] } = useListProperties();
  const { data: agents = [] } = useListAgents();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: "",
      propertyId: 0,
      agentId: 0,
      taskType: "",
      inputPrompt: "",
      frequency: "daily",
      dayOfWeek: 1,
      dayOfMonth: 1,
      hour: 9,
      timezone: "America/New_York",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initial?.name ?? "",
        propertyId: initial?.propertyId ?? 0,
        agentId: initial?.agentId ?? 0,
        taskType: initial?.taskType ?? "",
        inputPrompt: initial?.inputPrompt ?? "",
        frequency: initial?.frequency ?? "daily",
        dayOfWeek: initial?.dayOfWeek ?? 1,
        dayOfMonth: initial?.dayOfMonth ?? 1,
        hour: initial?.hour ?? 9,
        timezone: initial?.timezone ?? "America/New_York",
      });
    }
  }, [open, initial, form]);

  const frequency = form.watch("frequency");

  function onSubmit(values: ScheduleFormValues) {
    const data = {
      ...values,
      dayOfWeek: values.frequency === "weekly" ? values.dayOfWeek : undefined,
      dayOfMonth: values.frequency === "monthly" ? values.dayOfMonth : undefined,
    };

    if (initial) {
      updateSchedule.mutate({ id: initial.id, data }, {
        onSuccess: () => {
          toast({ title: "Schedule updated" });
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          onClose();
        },
        onError: () => toast({ title: "Failed to update schedule", variant: "destructive" }),
      });
    } else {
      createSchedule.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "Schedule created" });
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          onClose();
        },
        onError: () => toast({ title: "Failed to create schedule", variant: "destructive" }),
      });
    }
  }

  const isPending = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Schedule" : "New Schedule"}</DialogTitle>
          <DialogDescription>
            Automatically dispatch AI tasks on a recurring schedule.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Schedule Name</FormLabel>
                <FormControl><Input placeholder="Weekly Performance Report" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="propertyId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ? String(field.value) : undefined}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((p: { id: number; name: string }) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="agentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ? String(field.value) : undefined}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(agents as { id: number; name: string; icon: string; role: string }[]).map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.icon} {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="taskType" render={({ field }) => (
              <FormItem>
                <FormLabel>Task Type</FormLabel>
                <FormControl><Input placeholder="e.g. blog_post, social_content, analytics_report" {...field} /></FormControl>
                <FormDescription className="text-xs">A short identifier for the type of task being scheduled.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="inputPrompt" render={({ field }) => (
              <FormItem>
                <FormLabel>Prompt / Instructions</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Generate a weekly performance report covering the last 7 days..."
                    className="min-h-[80px]"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormDescription className="text-xs">Optional instructions sent to the agent when this schedule runs.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="frequency" render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {frequency === "weekly" && (
              <FormField control={form.control} name="dayOfWeek" render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of Week</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value !== undefined ? String(field.value) : "1"}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DAY_NAMES.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {frequency === "monthly" && (
              <FormField control={form.control} name="dayOfMonth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of Month</FormLabel>
                  <FormControl><Input type="number" min={1} max={31} {...field} /></FormControl>
                  <FormDescription className="text-xs">1–31. If the month has fewer days, runs on the last day.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="hour" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hour of Day</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="timezone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : initial ? "Save Changes" : "Create Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, className: "text-muted-foreground" },
  running: { label: "Running", icon: <Loader2 className="h-3 w-3 animate-spin" />, className: "text-blue-500" },
  reviewing: { label: "Reviewing", icon: <Clock className="h-3 w-3" />, className: "text-yellow-500" },
  completed: { label: "Completed", icon: <CheckCircle2 className="h-3 w-3" />, className: "text-green-500" },
  approved: { label: "Approved", icon: <CheckCircle2 className="h-3 w-3" />, className: "text-green-600" },
  rejected: { label: "Rejected", icon: <XCircle className="h-3 w-3" />, className: "text-destructive" },
  revision_requested: { label: "Revision Needed", icon: <Clock className="h-3 w-3" />, className: "text-orange-500" },
  failed: { label: "Failed", icon: <XCircle className="h-3 w-3" />, className: "text-destructive" },
};

const ACTIVE_STATUSES = new Set(["pending", "running", "reviewing", "revision_requested"]);
const POLL_INTERVAL_MS = 3000;

function ScheduleHistoryDrawer({
  schedule,
  open,
  onClose,
}: {
  schedule: ScheduleItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: tasks = [], isLoading } = useListTasks(
    schedule ? { scheduleId: schedule.id } : {},
    {
      query: {
        enabled: !!schedule && open,
        refetchInterval: (query) => {
          const data = query.state.data as { status: string }[] | undefined;
          if (!data) return false;
          return data.slice(0, 20).some((t) => ACTIVE_STATUSES.has(t.status)) ? POLL_INTERVAL_MS : false;
        },
      },
    }
  );

  const recentTasks = (tasks as { id: number; title: string; status: string; createdAt: string; updatedAt: string }[]).slice(0, 20);
  const isLive = recentTasks.some((t) => ACTIVE_STATUSES.has(t.status));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Task History
            {isLive && (
              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-500">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            )}
          </SheetTitle>
          {schedule && (
            <SheetDescription className="flex items-center justify-between gap-2">
              <span>Recent tasks spawned by <span className="font-medium text-foreground">{schedule.name}</span></span>
              <Link href={`/tasks?scheduleId=${schedule.id}`} onClick={onClose}>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 shrink-0">
                  <ExternalLink className="h-3 w-3" />
                  View all
                </Button>
              </Link>
            </SheetDescription>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <History className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No tasks yet</p>
            <p className="text-xs mt-1">Tasks will appear here once this schedule runs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((task) => {
              const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className={`flex items-center gap-1 mt-0.5 shrink-0 ${cfg.className}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight line-clamp-2">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs px-1.5 py-0 ${cfg.className}`}>
                        {cfg.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                  <Link href={`/tasks/${task.id}`} onClick={onClose}>
                    <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function frequencyLabel(s: ScheduleItem): string {
  if (s.frequency === "daily") return `Daily at ${formatHour(s.hour)}`;
  if (s.frequency === "weekly") return `Every ${DAY_NAMES[s.dayOfWeek ?? 1]} at ${formatHour(s.hour)}`;
  if (s.frequency === "monthly") return `Monthly on day ${s.dayOfMonth ?? 1} at ${formatHour(s.hour)}`;
  return s.frequency;
}

function formatHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

export default function Schedules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | undefined>(undefined);
  const [filterPropertyId, setFilterPropertyId] = useState<string>("all");
  const [historySchedule, setHistorySchedule] = useState<ScheduleItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: properties = [] } = useListProperties();
  const { data: schedules = [], isLoading } = useListSchedules(
    filterPropertyId !== "all" ? { propertyId: parseInt(filterPropertyId) } : {}
  );

  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();

  function handleDelete(id: number) {
    deleteSchedule.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Schedule deleted" });
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete schedule", variant: "destructive" }),
    });
  }

  function handleToggleStatus(s: ScheduleItem) {
    const newStatus = s.status === "active" ? "paused" : "active";
    updateSchedule.mutate({ id: s.id, data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: `Schedule ${newStatus === "active" ? "resumed" : "paused"}` });
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
      },
      onError: () => toast({ title: "Failed to update schedule", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground mt-1">Automate recurring AI tasks across your properties.</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {(properties as { id: number; name: string }[]).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No schedules yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a recurring schedule to automatically dispatch AI tasks.
            </p>
            <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(schedules as ScheduleItem[]).map((s) => (
            <Card key={s.id} className={s.status === "paused" ? "opacity-60" : ""}>
              <CardContent className="flex items-center gap-4 py-4">
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: s.agentColor }}
                >
                  <span className="text-base">{s.agentIcon}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <Badge variant={s.status === "active" ? "secondary" : "outline"} className="text-xs">
                      {s.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.agentName} · {s.propertyName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {frequencyLabel(s)} · {s.timezone}
                  </p>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  {s.nextRunAt ? (
                    <>
                      <p className="text-xs text-muted-foreground">Next run</p>
                      <p className="text-xs font-medium">{format(new Date(s.nextRunAt), "MMM d, h:mm a")}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No run scheduled</p>
                  )}
                  {s.lastRunAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last: {format(new Date(s.lastRunAt), "MMM d")}
                    </p>
                  )}
                  {s.lastTaskId && (
                    <Link href={`/tasks/${s.lastTaskId}`}>
                      <p className="text-xs text-primary hover:underline mt-0.5 cursor-pointer">
                        View last task →
                      </p>
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="View task history"
                    onClick={() => { setHistorySchedule(s); setHistoryOpen(true); }}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={s.status === "active" ? "Pause" : "Resume"}
                    onClick={() => handleToggleStatus(s)}
                  >
                    {s.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditing(s); setDialogOpen(true); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete &quot;{s.name}&quot;? This cannot be undone. No tasks in progress will be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ScheduleDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(undefined); }}
        initial={editing}
      />

      <ScheduleHistoryDrawer
        schedule={historySchedule}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
