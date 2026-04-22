import { useGetTask, useDecideReview, usePublishTask, usePushTaskToAds, getGetTaskQueryKey, getListTasksQueryKey, getListReviewsQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  XCircle,
  ChevronLeft,
  Download,
  Star,
  Globe,
  Send,
  ExternalLink,
  TrendingUp,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CMS_PUBLISHABLE_ROLES = ["content_specialist", "seo_specialist"];
const ADS_PUSHABLE_ROLES = ["paid_specialist"];
const SOCIAL_ROLES = ["social_media_specialist"];

interface SocialPlatformSection {
  platform: string;
  content: string;
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
  labelColor: string;
}

function parseSocialOutput(output: string): SocialPlatformSection[] {
  const sections: SocialPlatformSection[] = [];

  const platformDefs = [
    {
      key: "instagram",
      pattern: /===INSTAGRAM===([\s\S]*?)===END INSTAGRAM===/i,
      platform: "Instagram",
      icon: <Instagram className="w-4 h-4" />,
      borderColor: "border-pink-500/40",
      bgColor: "bg-pink-500/5",
      labelColor: "text-pink-600",
    },
    {
      key: "facebook",
      pattern: /===FACEBOOK===([\s\S]*?)===END FACEBOOK===/i,
      platform: "Facebook",
      icon: <Facebook className="w-4 h-4" />,
      borderColor: "border-blue-600/40",
      bgColor: "bg-blue-600/5",
      labelColor: "text-blue-700",
    },
    {
      key: "twitter",
      pattern: /===TWITTER\/X===([\s\S]*?)===END TWITTER===/i,
      platform: "Twitter / X",
      icon: <Twitter className="w-4 h-4" />,
      borderColor: "border-sky-500/40",
      bgColor: "bg-sky-500/5",
      labelColor: "text-sky-600",
    },
    {
      key: "linkedin",
      pattern: /===LINKEDIN===([\s\S]*?)===END LINKEDIN===/i,
      platform: "LinkedIn",
      icon: <Linkedin className="w-4 h-4" />,
      borderColor: "border-blue-800/40",
      bgColor: "bg-blue-800/5",
      labelColor: "text-blue-900 dark:text-blue-300",
    },
  ];

  for (const def of platformDefs) {
    const match = output.match(def.pattern);
    if (match) {
      sections.push({
        platform: def.platform,
        content: match[1].trim(),
        icon: def.icon,
        borderColor: def.borderColor,
        bgColor: def.bgColor,
        labelColor: def.labelColor,
      });
    }
  }

  return sections;
}

export default function TaskDetail() {
  const params = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [managerNotes, setManagerNotes] = useState("");
  const [publishPlatform, setPublishPlatform] = useState<"wordpress" | "squarespace">("wordpress");
  const [publishStatusChoice, setPublishStatusChoice] = useState<"draft" | "publish">("draft");
  const [adPlatform, setAdPlatform] = useState<"google_ads" | "meta_ads">("google_ads");
  const [showPushConfirm, setShowPushConfirm] = useState(false);

  const id = params.id ? parseInt(params.id) : 0;

  const { data: task, isLoading } = useGetTask(id, {
    query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) }
  });

  const decideReview = useDecideReview();
  const publishTask = usePublishTask();
  const pushToAds = usePushTaskToAds();

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

  const handlePublish = () => {
    publishTask.mutate({
      id,
      data: {
        platform: effectivePlatform,
        publishStatus: publishStatusChoice,
      }
    }, {
      onSuccess: (result) => {
        toast({
          title: `Published to ${effectivePlatform === "wordpress" ? "WordPress" : "Squarespace"}`,
          description: result.publishUrl ? `View at: ${result.publishUrl}` : undefined,
        });
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
      onError: (err: Error) => {
        toast({
          title: "Publish failed",
          description: err.message ?? "Could not publish to CMS.",
          variant: "destructive",
        });
      }
    });
  };

  const handlePushToAds = () => {
    pushToAds.mutate({
      id,
      data: { platform: effectiveAdPlatform }
    }, {
      onSuccess: (result) => {
        toast({
          title: `Campaign pushed to ${effectiveAdPlatform === "google_ads" ? "Google Ads" : "Meta Ads"}`,
          description: `Campaign ID: ${result.campaignId} — status: PAUSED (review before enabling)`,
        });
        queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
      onError: (err: Error) => {
        toast({
          title: "Ad push failed",
          description: err.message ?? "Could not push campaign to ad platform.",
          variant: "destructive",
        });
      }
    });
  };

  const isApproved = task.review?.decision === "approved";
  const hasCms = task.wordpressConfigured || task.squarespaceConfigured;
  const isCmsRole = CMS_PUBLISHABLE_ROLES.includes(task.agentRole);
  const showPublishPanel = isApproved && hasCms && isCmsRole && (!task.publishStatus || task.publishStatus === "failed");
  const isPublished = !!task.publishStatus && task.publishStatus !== "failed";

  const hasAdPlatform = task.googleAdsConfigured || task.metaAdsConfigured;
  const isAdsRole = ADS_PUSHABLE_ROLES.includes(task.agentRole);
  const showPushToAdsPanel = isApproved && hasAdPlatform && isAdsRole && (!task.adPushStatus || task.adPushStatus === "failed");
  const isAdPushed = !!task.adPushStatus && task.adPushStatus !== "failed";

  const isSocialRole = SOCIAL_ROLES.includes(task.agentRole);
  const socialSections = isSocialRole && task.output ? parseSocialOutput(task.output) : [];

  const availablePlatforms = [
    ...(task.wordpressConfigured ? [{ value: "wordpress" as const, label: "WordPress" }] : []),
    ...(task.squarespaceConfigured ? [{ value: "squarespace" as const, label: "Squarespace" }] : []),
  ];

  const effectivePlatform: "wordpress" | "squarespace" =
    availablePlatforms.find((p) => p.value === publishPlatform)?.value ??
    availablePlatforms[0]?.value ??
    "wordpress";

  const availableAdPlatforms = [
    ...(task.googleAdsConfigured ? [{ value: "google_ads" as const, label: "Google Ads" }] : []),
    ...(task.metaAdsConfigured ? [{ value: "meta_ads" as const, label: "Meta Ads" }] : []),
  ];

  const effectiveAdPlatform: "google_ads" | "meta_ads" =
    availableAdPlatforms.find((p) => p.value === adPlatform)?.value ??
    availableAdPlatforms[0]?.value ??
    "google_ads";

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

        <div className="flex flex-wrap items-center gap-2">
          {task.status === 'pending' && <Badge variant="secondary" className="text-sm py-1"><Clock className="w-4 h-4 mr-2" /> Pending Execution</Badge>}
          {task.status === 'running' && <Badge variant="default" className="text-sm py-1"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> In Progress</Badge>}
          {task.status === 'completed' && <Badge variant="outline" className="text-sm py-1 border-green-500 text-green-600 bg-green-500/10"><CheckCircle2 className="w-4 h-4 mr-2" /> Agent Completed</Badge>}
          {task.status === 'failed' && <Badge variant="destructive" className="text-sm py-1"><AlertCircle className="w-4 h-4 mr-2" /> Failed</Badge>}
          {isPublished && (
            <Badge variant="secondary" className="text-sm py-1 border-blue-500 text-blue-600 bg-blue-500/10 gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {task.publishStatus === "publish" || task.publishStatus === "live" ? "Published" : "Draft Sent"}
              {task.publishPlatform && ` · ${task.publishPlatform === "wordpress" ? "WordPress" : "Squarespace"}`}
            </Badge>
          )}
          {task.publishStatus === "failed" && (
            <Badge variant="destructive" className="text-sm py-1 gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Publish Failed
            </Badge>
          )}
          {isAdPushed && (
            <Badge variant="secondary" className="text-sm py-1 border-orange-500 text-orange-600 bg-orange-500/10 gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Ad Campaign Pushed
              {task.adPlatform && ` · ${task.adPlatform === "google_ads" ? "Google Ads" : "Meta Ads"}`}
            </Badge>
          )}
          {task.adPushStatus === "failed" && (
            <Badge variant="destructive" className="text-sm py-1 gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Ad Push Failed
            </Badge>
          )}
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

          {socialSections.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Platform Content</h2>
              {socialSections.map((section) => (
                <Card key={section.platform} className={`border ${section.borderColor}`}>
                  <CardHeader className={`${section.bgColor} border-b border-border pb-3 pt-4`}>
                    <div className={`flex items-center gap-2 font-semibold ${section.labelColor}`}>
                      {section.icon}
                      {section.platform}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {section.content}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(section.content);
                        toast({ title: `${section.platform} content copied` });
                      }}
                    >
                      Copy to clipboard
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

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

          {showPublishPanel && (
            <Card className="border-blue-500/30">
              <CardHeader className="bg-blue-500/5 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <CardTitle className="text-lg">Publish to CMS</CardTitle>
                </div>
                <CardDescription>
                  Push this approved content directly to {availablePlatforms.map(p => p.label).join(" or ")}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {availablePlatforms.length > 1 && (
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select
                      value={effectivePlatform}
                      onValueChange={(v) => setPublishPlatform(v as "wordpress" | "squarespace")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePlatforms.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Publish as</Label>
                  <Select
                    value={publishStatusChoice}
                    onValueChange={(v) => setPublishStatusChoice(v as "draft" | "publish")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Save as Draft</SelectItem>
                      <SelectItem value="publish">Publish Live</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handlePublish}
                  disabled={publishTask.isPending}
                >
                  {publishTask.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Publish to {availablePlatforms.find(p => p.value === effectivePlatform)?.label ?? "CMS"}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {isPublished && task.publishedAt && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-base">Published</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="font-medium capitalize">{task.publishPlatform}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary" className="capitalize">{task.publishStatus}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Published</span>
                  <span>{format(new Date(task.publishedAt), "MMM d, h:mm a")}</span>
                </div>
                {task.publishUrl && (
                  <a
                    href={task.publishUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline pt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View published post
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {showPushToAdsPanel && (
            <Card className="border-orange-500/30">
              <CardHeader className="bg-orange-500/5 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  <CardTitle className="text-lg">Push to Ad Platform</CardTitle>
                </div>
                <CardDescription>
                  Create a PAUSED campaign draft on {availableAdPlatforms.map(p => p.label).join(" or ")}. Review and enable in the platform dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {availableAdPlatforms.length > 1 && (
                  <div className="space-y-2">
                    <Label>Ad Platform</Label>
                    <Select
                      value={effectiveAdPlatform}
                      onValueChange={(v) => setAdPlatform(v as "google_ads" | "meta_ads")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAdPlatforms.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                  Campaign will be created as <strong>PAUSED</strong>. No spend occurs until you manually enable it in {availableAdPlatforms.find(p => p.value === effectiveAdPlatform)?.label ?? "the ad platform"}.
                </div>

                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => setShowPushConfirm(true)}
                  disabled={pushToAds.isPending}
                >
                  {pushToAds.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pushing Campaign...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Push to {availableAdPlatforms.find(p => p.value === effectiveAdPlatform)?.label ?? "Ad Platform"}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          <AlertDialog open={showPushConfirm} onOpenChange={setShowPushConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Push campaign to {availableAdPlatforms.find(p => p.value === effectiveAdPlatform)?.label ?? "ad platform"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will create a <strong>PAUSED</strong> campaign draft — including ad groups, keywords, and ad creatives — in your {availableAdPlatforms.find(p => p.value === effectiveAdPlatform)?.label ?? "ad platform"} account.
                  No budget will be spent until you manually enable the campaign in the platform dashboard.
                  This action cannot be undone from here.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => { setShowPushConfirm(false); handlePushToAds(); }}
                >
                  <Send className="w-4 h-4 mr-2" /> Confirm Push
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {isAdPushed && task.adPushedAt && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <CardTitle className="text-base">Ad Campaign Pushed</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="font-medium">
                    {task.adPlatform === "google_ads" ? "Google Ads" : task.adPlatform === "meta_ads" ? "Meta Ads" : task.adPlatform}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary" className="capitalize">{task.adPushStatus}</Badge>
                </div>
                {task.adCampaignId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Campaign ID</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{task.adCampaignId}</code>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pushed</span>
                  <span>{format(new Date(task.adPushedAt), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Campaign is <strong>PAUSED</strong>. Enable it in the platform dashboard when ready to run.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
