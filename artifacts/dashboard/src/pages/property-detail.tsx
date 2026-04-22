import { useGetProperty, useUpdateProperty, useDeleteProperty, getGetPropertyQueryKey, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Trash2, CheckCircle2, Lock, Upload, X, Download } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROPERTY_TYPES = [
  "Restaurant",
  "Bar",
  "Wine Bar",
  "Wine Shop",
  "Café",
  "Bakery",
  "Hotel",
  "Event Venue",
  "Food Hall",
  "Pop-Up",
  "Other",
];

const propertySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  brandVoice: z.string().optional().nullable(),
  tone: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  primaryKeywords: z.string().optional().nullable(),
  websiteUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  instagramHandle: z.string().optional().nullable(),
  facebookHandle: z.string().optional().nullable(),
  twitterHandle: z.string().optional().nullable(),
  linkedinHandle: z.string().optional().nullable(),
  wordpressUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  wordpressUsername: z.string().optional().nullable(),
  wordpressAppPassword: z.string().optional().nullable(),
  squarespaceApiKey: z.string().optional().nullable(),
  squarespaceCollectionId: z.string().optional().nullable(),
  googleAdsCustomerId: z.string().optional().nullable(),
  googleAdsRefreshToken: z.string().optional().nullable(),
  metaAdsAccountId: z.string().optional().nullable(),
  metaAdsAccessToken: z.string().optional().nullable(),
  metaAdPageId: z.string().optional().nullable(),
  hubspotPortalId: z.string().optional().nullable(),
  hubspotApiKey: z.string().optional().nullable(),
  openedAt: z.string().optional().nullable(),
  propertyType: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  resyUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function PropertyDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useGetProperty(id, {
    query: { enabled: !!id, queryKey: getGetPropertyQueryKey(id) }
  });

  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: "",
      wordpressUrl: "",
      wordpressUsername: "",
      wordpressAppPassword: "",
      squarespaceApiKey: "",
      squarespaceCollectionId: "",
      googleAdsCustomerId: "",
      googleAdsRefreshToken: "",
      metaAdsAccountId: "",
      metaAdsAccessToken: "",
      metaAdPageId: "",
      hubspotPortalId: "",
      hubspotApiKey: "",
      openedAt: "",
      propertyType: "",
      logoUrl: "",
      resyUrl: "",
    },
  });

  const logoUrl = form.watch("logoUrl");

  useEffect(() => {
    if (property) {
      form.reset({
        name: property.name,
        description: property.description || "",
        brandVoice: property.brandVoice || "",
        tone: property.tone || "",
        targetAudience: property.targetAudience || "",
        primaryKeywords: property.primaryKeywords || "",
        websiteUrl: property.websiteUrl || "",
        instagramHandle: property.instagramHandle || "",
        facebookHandle: property.facebookHandle || "",
        twitterHandle: property.twitterHandle || "",
        linkedinHandle: property.linkedinHandle || "",
        wordpressUrl: "",
        wordpressUsername: "",
        wordpressAppPassword: "",
        squarespaceApiKey: "",
        squarespaceCollectionId: "",
        googleAdsCustomerId: property.googleAdsCustomerId || "",
        googleAdsRefreshToken: "",
        metaAdsAccountId: property.metaAdsAccountId || "",
        metaAdsAccessToken: "",
        metaAdPageId: property.metaAdPageId || "",
        hubspotPortalId: property.hubspotPortalId || "",
        hubspotApiKey: "",
        openedAt: property.openedAt ? new Date(property.openedAt).toISOString().split("T")[0] : "",
        propertyType: property.propertyType || "",
        logoUrl: property.logoUrl || "",
        resyUrl: property.resyUrl || "",
      });
    }
  }, [property, form]);

  function onSubmit(values: PropertyFormValues) {
    const cleanedValues = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === null ? "" : v])
    );

    updateProperty.mutate({
      id,
      data: cleanedValues
    }, {
      onSuccess: () => {
        toast({ title: "Property Updated" });
        queryClient.invalidateQueries({ queryKey: getGetPropertyQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
      },
      onError: () => {
        toast({ title: "Error updating property", variant: "destructive" });
      }
    });
  }

  function handleDelete() {
    deleteProperty.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Property Deleted" });
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        setLocation("/properties");
      },
      onError: () => {
        toast({ title: "Error deleting property", variant: "destructive" });
      }
    });
  }

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!property) return <div className="p-8">Property not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="-ml-4" onClick={() => window.history.back()}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the property.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit {property.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          {property.wordpressConfigured && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <CheckCircle2 className="w-3 h-3 text-green-500" /> WordPress Connected
            </Badge>
          )}
          {property.squarespaceConfigured && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <CheckCircle2 className="w-3 h-3 text-green-500" /> Squarespace Connected
            </Badge>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property/Brand Name *</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
              <CardDescription>Logo, type, opening date, and reservations link.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <FormLabel>Logo</FormLabel>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          form.setValue("logoUrl", ev.target?.result as string, { shouldDirty: true });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" /> Upload Logo
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => form.setValue("logoUrl", "", { shouldDirty: true })}
                      >
                        <X className="w-4 h-4 mr-2" /> Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG — recommended 400×400px</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROPERTY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="openedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Opened</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="resyUrl"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Resy Page URL</FormLabel>
                      <FormControl><Input type="url" placeholder="https://resy.com/cities/.../venues/..." {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">Link to this property's Resy reservation page</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Guidelines</CardTitle>
              <CardDescription>Agents use these to align with the brand identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="brandVoice" render={({ field }) => (
                  <FormItem><FormLabel>Brand Voice</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="tone" render={({ field }) => (
                  <FormItem><FormLabel>Tone</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="targetAudience" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Target Audience</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="primaryKeywords" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Primary Keywords</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Digital Presence</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="websiteUrl" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Website URL</FormLabel><FormControl><Input type="url" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="instagramHandle" render={({ field }) => (
                <FormItem><FormLabel>Instagram Handle</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="facebookHandle" render={({ field }) => (
                <FormItem><FormLabel>Facebook Handle</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="twitterHandle" render={({ field }) => (
                <FormItem><FormLabel>Twitter Handle</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="linkedinHandle" render={({ field }) => (
                <FormItem><FormLabel>LinkedIn Handle</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CMS Publishing</CardTitle>
              <CardDescription>
                Connect WordPress and Squarespace so approved content can be published directly from the platform.
                Credentials are write-only and never returned by the API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">WordPress</h4>
                  {property.wordpressConfigured ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Connected
                    </Badge>
                  ) : null}
                </div>
                {property.wordpressConfigured && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <Lock className="w-3 h-3" />
                    Credentials are stored — enter new values below to update them.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Use an <a href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" target="_blank" rel="noreferrer" className="underline">Application Password</a> from WordPress Users → Profile → Application Passwords.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="wordpressUrl" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>WordPress Site URL</FormLabel>
                      <FormControl><Input type="url" placeholder="https://yoursite.com" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wordpressUsername" render={({ field }) => (
                    <FormItem>
                      <FormLabel>WordPress Username</FormLabel>
                      <FormControl><Input placeholder="admin" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wordpressAppPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Password</FormLabel>
                      <FormControl><Input type="password" placeholder={property.wordpressConfigured ? "Enter to update" : "xxxx xxxx xxxx xxxx xxxx xxxx"} {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">Generated in WordPress profile settings.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Squarespace</h4>
                  {property.squarespaceConfigured ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Connected
                    </Badge>
                  ) : null}
                </div>
                {property.squarespaceConfigured && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <Lock className="w-3 h-3" />
                    Credentials are stored — enter new values below to update them.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Generate an API key from Squarespace Settings → Developer API Keys. The Collection ID is found in your blog URL structure.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="squarespaceApiKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Squarespace API Key</FormLabel>
                      <FormControl><Input type="password" placeholder={property.squarespaceConfigured ? "Enter to update" : "API key"} {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="squarespaceCollectionId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog Collection ID</FormLabel>
                      <FormControl><Input placeholder="5f2abc..." {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">From the Squarespace API collections endpoint.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CRM Integration</CardTitle>
              <CardDescription>
                Connect HubSpot to pull lead and pipeline analytics into Riley&apos;s performance reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">HubSpot</h4>
                {property.hubspotConfigured ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-500" /> Connected
                  </Badge>
                ) : null}
              </div>
              {property.hubspotConfigured && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                  <Lock className="w-3 h-3" />
                  API key is stored — enter a new one below to update it.
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Create a private app in HubSpot Settings → Integrations → Private Apps. Grant read access to contacts and deals.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="hubspotPortalId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portal ID</FormLabel>
                    <FormControl><Input placeholder="12345678" {...field} value={field.value || ""} /></FormControl>
                    <FormDescription className="text-xs">Found in HubSpot → Account & Billing or the URL bar.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="hubspotApiKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Private App Token</FormLabel>
                    <FormControl><Input type="password" placeholder={property.hubspotConfigured ? "Enter to update" : "pat-na1-..."} {...field} value={field.value || ""} /></FormControl>
                    <FormDescription className="text-xs">Private app access token from HubSpot</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ad Platforms</CardTitle>
              <CardDescription>
                Connect Google Ads and Meta Ads to push approved paid campaigns directly from the approval queue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Google Ads</h4>
                  {property.googleAdsConfigured ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Connected
                    </Badge>
                  ) : null}
                </div>
                {property.googleAdsConfigured && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <Lock className="w-3 h-3" />
                    Refresh token is stored — enter a new one below to update it.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Requires a Google Ads Customer ID and OAuth2 refresh token. Also set <code className="bg-muted px-1 rounded">GOOGLE_ADS_DEVELOPER_TOKEN</code>, <code className="bg-muted px-1 rounded">GOOGLE_ADS_CLIENT_ID</code>, and <code className="bg-muted px-1 rounded">GOOGLE_ADS_CLIENT_SECRET</code> environment variables.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="googleAdsCustomerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer ID</FormLabel>
                      <FormControl><Input placeholder="1234567890" {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">10-digit Google Ads account ID</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="googleAdsRefreshToken" render={({ field }) => (
                    <FormItem>
                      <FormLabel>OAuth2 Refresh Token</FormLabel>
                      <FormControl><Input type="password" placeholder={property.googleAdsConfigured ? "Enter to update" : "1//0..."} {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">From Google OAuth2 authorization flow</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Meta Ads</h4>
                  {property.metaAdsConfigured ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Connected
                    </Badge>
                  ) : null}
                </div>
                {property.metaAdsConfigured && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <Lock className="w-3 h-3" />
                    Access token is stored — enter a new one below to update it.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Requires a Meta Ad Account ID and a System User access token from Meta Business Manager.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="metaAdsAccountId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ad Account ID</FormLabel>
                      <FormControl><Input placeholder="123456789" {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">Numeric ID from Meta Business Manager (without "act_")</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="metaAdsAccessToken" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token</FormLabel>
                      <FormControl><Input type="password" placeholder={property.metaAdsConfigured ? "Enter to update" : "EAABs..."} {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">System user or page access token</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="metaAdPageId" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Facebook Page ID</FormLabel>
                      <FormControl><Input placeholder="123456789012345" {...field} value={field.value || ""} /></FormControl>
                      <FormDescription className="text-xs">Required for ad creative creation. Find it under your Page's "About" section or Business Manager.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={updateProperty.isPending || !form.formState.isDirty}>
              {updateProperty.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>

      {property && (property.googleAdsConfigured || property.metaAdsConfigured || property.hubspotConfigured) && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics Export</CardTitle>
            <CardDescription>
              Download raw performance data from your connected ad platforms and CRM as a spreadsheet-ready CSV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(["7days", "30days", "90days"] as const).map((range) => (
                <a
                  key={range}
                  href={`/api/properties/${property.id}/analytics-data.csv?dateRange=${range}`}
                  download
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Download className="w-3.5 h-3.5" />
                  Last {range === "7days" ? "7 Days" : range === "30days" ? "30 Days" : "90 Days"}
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Includes Google Ads, Meta Ads, HubSpot CRM, and email campaign data for all connected platforms.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
