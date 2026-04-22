import { useListAgents, useListProperties, useCreateTask, getListTasksQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  agentId: z.string().min(1, "Agent is required"),
  propertyId: z.string().min(1, "Property is required"),
  inputPrompt: z.string().min(10, "Please provide more details for the task"),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export default function NewTask() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: agents } = useListAgents();
  const { data: properties } = useListProperties();
  const createTask = useCreateTask();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      agentId: "",
      propertyId: "",
      inputPrompt: "",
    },
  });

  function onSubmit(values: TaskFormValues) {
    createTask.mutate({
      data: {
        title: values.title,
        agentId: parseInt(values.agentId),
        propertyId: parseInt(values.propertyId),
        inputPrompt: values.inputPrompt,
      }
    }, {
      onSuccess: (task) => {
        toast({
          title: "Task Dispatched",
          description: "Agent has been assigned the task.",
        });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setLocation(`/tasks/${task.id}`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to dispatch task. Please try again.",
          variant: "destructive"
        });
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Dispatch</h1>
        <p className="text-muted-foreground mt-1">Assign a new objective to an AI employee.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="agentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Agent</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents?.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id.toString()}>
                              <div className="flex items-center">
                                <div className="w-4 h-4 rounded mr-2 flex items-center justify-center text-[10px]" style={{ backgroundColor: agent.color, color: 'white' }}>
                                  {agent.icon}
                                </div>
                                {agent.name} - {agent.role}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Property</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a brand/property" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {properties?.map((property) => (
                            <SelectItem key={property.id} value={property.id.toString()}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Draft Instagram Posts for Summer Menu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inputPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide detailed instructions for the agent..." 
                        className="min-h-[200px] resize-y" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      The agent will receive these instructions along with the property's brand guidelines.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4 border-t border-border">
                <Button variant="outline" type="button" onClick={() => setLocation("/tasks")}>Cancel</Button>
                <Button type="submit" disabled={createTask.isPending}>
                  {createTask.isPending ? "Dispatching..." : "Dispatch Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}