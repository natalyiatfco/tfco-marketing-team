import { useGetTask, useDecideReview, getGetTaskQueryKey, getListTasksQueryKey, getListReviewsQueryKey } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock, Loader2, AlertCircle, RefreshCw, XCircle, ChevronLeft, Download, Star } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function TaskDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [managerNotes, setManagerNotes] = useState("");
  
  const id = params.id ? parseInt(params.id) : 0;
  
  const { data: task, isLoading } = useGetTask(id, {
    query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) }
  });

  const decideReview = useDecideReview();

  if (isLoading) {
    return <div className="space-y-6 animate-pulse p-4">
      <div className="h-10 bg-muted rounded w-1/3"></div>
      <div className="h-64 bg-muted rounded-xl"></div>
    </div>;
  }

  if (!task) return <div>Task not found</div>;

  const handleDecision = (decision: "approved" | "rejected" | "revision_requested") => {
    if (!task.review?.id) return;
    
    decideReview.mutate({
      id: task.review.id,
      data: {
        decision,
        humanNotes: managerNotes || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Review submitted" });
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error submitting review", variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" className="mb-2 -ml-4" onClick={() => window.history.back()}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="font-mono">{task.propertyName}</Badge>
            <span className="text-sm text-muted-foreground">{format(new Date(task.createdAt), "MMM d, yyyy h:mm a")}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {task.status === 'pending' && <Badge variant="secondary" className="text-sm py-1"><Clock className="w-4 h-4 mr-2" /> Pending Execution</Badge>}
          {task.status === 'running' && <Badge variant="default" className="text-sm py-1"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> In Progress</Badge>}
          {task.status === 'completed' && <Badge variant="outline" className="text-sm py-1 border-green-500 text-green-600 bg-green-500/10"><CheckCircle2 className="w-4 h-4 mr-2" /> Agent Completed</Badge>}
          {task.status === 'failed' && <Badge variant="destructive" className="text-sm py-1"><AlertCircle className="w-4 h-4 mr-2" /> Failed</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Agent Output</CardTitle>
              {task.output && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([task.output ?? ""], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${task.title.replace(/\s+/g, "-").toLowerCase()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {task.output ? (
                <div className="p-6 prose dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {task.output}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  {task.status === 'running' ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                      <p>Agent is currently generating output...</p>
                    </>
                  ) : task.status === 'failed' ? (
                    <>
                      <AlertCircle className="w-8 h-8 text-destructive mb-4" />
                      <p>Agent failed to generate output.</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-8 h-8 text-muted-foreground mb-4" />
                      <p>Output will appear here once generated.</p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Original Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono">
                {task.inputPrompt}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assigned Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded flex items-center justify-center text-white text-xl"
                  style={{ backgroundColor: task.agentColor }}
                >
                  {task.agentIcon}
                </div>
                <div>
                  <p className="font-semibold">{task.agentName}</p>
                  <p className="text-sm text-muted-foreground">{task.agentRole}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {task.review?.managerFeedback && (
            <Card>
              <CardHeader className="bg-blue-500/5 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded flex items-center justify-center text-white text-base bg-blue-700">🎯</div>
                  <div>
                    <CardTitle className="text-lg">Casey's Review</CardTitle>
                    <CardDescription>AI Manager assessment</CardDescription>
                  </div>
                  {task.review.managerScore != null && (
                    <div className="ml-auto flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-1">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-bold text-amber-600">{task.review.managerScore}/10</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {task.review.managerFeedback}
                </div>
              </CardContent>
            </Card>
          )}

          {task.status === 'completed' && task.review && !task.review.decision && (
            <Card className="border-primary">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-lg">Your Decision</CardTitle>
                <CardDescription>Approve, request changes, or reject this output</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Feedback / Notes (Optional)</Label>
                  <Textarea 
                    placeholder="E.g., Tone needs to be more formal..." 
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    className="resize-y"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white" 
                    onClick={() => handleDecision('approved')}
                    disabled={decideReview.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Output
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full text-primary border-primary hover:bg-primary/10"
                    onClick={() => handleDecision('revision_requested')}
                    disabled={decideReview.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Request Revision
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-destructive hover:bg-destructive/10"
                    onClick={() => handleDecision('rejected')}
                    disabled={decideReview.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Reject Task
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {task.review?.decision && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {task.review.decision === 'approved' && <Badge className="bg-green-600">Approved</Badge>}
                  {task.review.decision === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                  {task.review.decision === 'revision_requested' && <Badge variant="outline" className="border-primary text-primary">Revision Requested</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(task.review.updatedAt), "MMM d, h:mm a")}
                  </span>
                </div>
                {task.review.humanNotes && (
                  <div className="text-sm bg-muted/50 p-3 rounded">
                    <strong>Notes:</strong> {task.review.humanNotes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}