import { useListAgents, useUpdateAgent, getListAgentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, X, Save, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Agent = {
  id: number;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  color: string;
  icon: string;
  createdAt: string;
};

export default function Agents() {
  const { data: agents, isLoading } = useListAgents();
  const updateAgent = useUpdateAgent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editSystemPrompt, setEditSystemPrompt] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [expandedSnippets, setExpandedSnippets] = useState<Set<number>>(new Set());

  function openEditDialog(agent: Agent) {
    setEditingAgent(agent);
    setEditSystemPrompt(agent.systemPrompt);
    setEditDescription(agent.description);
  }

  function closeEditDialog() {
    setEditingAgent(null);
    setEditSystemPrompt("");
    setEditDescription("");
  }

  function handleSave() {
    if (!editingAgent) return;
    updateAgent.mutate({
      id: editingAgent.id,
      data: {
        systemPrompt: editSystemPrompt,
        description: editDescription,
      }
    }, {
      onSuccess: () => {
        toast({ title: `${editingAgent.name}'s profile updated` });
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        closeEditDialog();
      },
      onError: () => {
        toast({ title: "Error saving changes", variant: "destructive" });
      }
    });
  }

  function toggleSnippetExpanded(agentId: number) {
    setExpandedSnippets(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  if (isLoading) {
    return <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48"></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-muted rounded-xl"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Employees</h1>
        <p className="text-muted-foreground mt-1">Your specialized digital marketing agents. Click "Edit" to view or modify any agent's system prompt.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => {
          const isExpanded = expandedSnippets.has(agent.id);
          return (
            <Card key={agent.id} className="overflow-hidden flex flex-col">
              <div className="h-2 w-full" style={{ backgroundColor: agent.color }} />
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl shadow-sm"
                    style={{ backgroundColor: agent.color }}
                  >
                    {agent.icon}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      ID: {agent.id.toString().padStart(3, '0')}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => openEditDialog(agent as Agent)}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-xl">{agent.name}</CardTitle>
                <CardDescription className="font-medium text-foreground">{agent.role}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <p className="text-sm text-muted-foreground mb-4">
                  {agent.description}
                </p>

                <div className="bg-muted/50 rounded-md p-3 mt-auto">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => toggleSnippetExpanded(agent.id)}
                  >
                    <p className="text-xs font-mono text-muted-foreground">System Prompt Snippet</p>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>
                  <p className={`text-xs italic mt-1 ${isExpanded ? "" : "line-clamp-3"}`}>
                    "{agent.systemPrompt}"
                  </p>
                  {!isExpanded && agent.systemPrompt.length > 200 && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline mt-1"
                      onClick={() => toggleSnippetExpanded(agent.id)}
                    >
                      Show more
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editingAgent} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {editingAgent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0"
                    style={{ backgroundColor: editingAgent.color }}
                  >
                    {editingAgent.icon}
                  </div>
                  <div>
                    <DialogTitle>{editingAgent.name} — System Prompt</DialogTitle>
                    <DialogDescription>{editingAgent.role}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Short Description</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Brief description of what this agent does..."
                  />
                </div>

                <div className="space-y-2 flex-1">
                  <Label>System Prompt</Label>
                  <p className="text-xs text-muted-foreground">
                    This is the full instruction set given to {editingAgent.name} before every task. Edit with care — changes take effect on the next dispatched task.
                  </p>
                  <Textarea
                    value={editSystemPrompt}
                    onChange={(e) => setEditSystemPrompt(e.target.value)}
                    className="min-h-[360px] font-mono text-xs resize-y"
                    placeholder="Enter system prompt..."
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {editSystemPrompt.length} characters
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={closeEditDialog} disabled={updateAgent.isPending}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateAgent.isPending || (editSystemPrompt === editingAgent.systemPrompt && editDescription === editingAgent.description)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateAgent.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
