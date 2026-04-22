import { useCreateProperty, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Upload, X } from "lucide-react";
import { useRef } from "react";
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
  description: z.string().optional(),
  brandVoice: z.string().optional(),
  tone: z.string().optional(),
  targetAudience: z.string().optional(),
  primaryKeywords: z.string().optional(),
  websiteUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagramHandle: z.string().optional(),
  facebookHandle: z.string().optional(),
  twitterHandle: z.string().optional(),
  linkedinHandle: z.string().optional(),
  wordpressUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  wordpressUsername: z.string().optional(),
  wordpressAppPassword: z.string().optional(),
  squarespaceApiKey: z.string().optional(),
  squarespaceCollectionId: z.string().optional(),
  googleAdsCustomerId: z.string().optional(),
  googleAdsRefreshToken: z.string().optional(),
  metaAdsAccountId: z.string().optional(),
  metaAdsAccessToken: z.string().optional(),
  metaAdPageId: z.string().optional(),
  openedAt: z.string().optional(),
  propertyType: z.string().optional(),
  logoUrl: z.string().optional(),
  resyUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function NewProperty() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProperty = useCreateProperty();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: "",
      description: "",
      brandVoice: "",
      tone: "",
      targetAudience: "",
      primaryKeywords: "",
      websiteUrl: "",
      instagramHandle: "",
      facebookHandle: "",
      twitterHandle: "",
      linkedinHandle: "",
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
      openedAt: "",
      propertyType: "",
      logoUrl: "",
      resyUrl: "",
    },
  });

  const logoUrl = form.watch("logoUrl");
  const logoInputRef = useRef<HTMLInputElement>(null);

  function onSubmit(values: PropertyFormValues) {
    createProperty.mutate({
      data: values
    }, {
      onSuccess: (property) => {
        toast({ title: "Property Created", description: `${property.name} has been added.` });
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
        setLocation("/properties");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create property.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" className="mb-2 -ml-4" onClick={() => window.history.back()}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add New Property</h1>
        <p className="text-muted-foreground mt-1">Create a new brand profile for agents to use.</p>
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
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Textarea {...field} /></FormControl>
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
                      <FormControl><Input type="date" {...field} /></FormControl>
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
                      <FormControl><Input type="url" placeholder="https://resy.com/cities/.../venues/..." {...field} /></FormControl>
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
                  <FormItem>
                    <FormLabel>Brand Voice</FormLabel>
                    <FormControl><Input placeholder="e.g. Professional, Playful" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tone</FormLabel>
                    <FormControl><Input placeholder="e.g. Enthusiastic, Educational" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="targetAudience" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Target Audience</FormLabel>
                    <FormControl><Input placeholder="e.g. Millennials, Fine dining enthusiasts" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="primaryKeywords" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Primary Keywords</FormLabel>
                    <FormControl><Input placeholder="e.g. luxury, organic, sustainable" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
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
                <FormItem className="md:col-span-2">
                  <FormLabel>Website URL</FormLabel>
                  <FormControl><Input type="url" placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="instagramHandle" render={({ field }) => (
                <FormItem><FormLabel>Instagram Handle</FormLabel><FormControl><Input placeholder="@..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="facebookHandle" render={({ field }) => (
                <FormItem><FormLabel>Facebook Handle</FormLabel><FormControl><Input placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="twitterHandle" render={({ field }) => (
                <FormItem><FormLabel>Twitter Handle</FormLabel><FormControl><Input placeholder="@..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="linkedinHandle" render={({ field }) => (
                <FormItem><FormLabel>LinkedIn Handle</FormLabel><FormControl><Input placeholder="..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CMS Publishing</CardTitle>
              <CardDescription>
                Optional: connect WordPress or Squarespace to enable one-click publishing from the approval queue.
                You can also add these credentials later from the property's edit page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">WordPress</h4>
                <p className="text-xs text-muted-foreground">
                  Use an <a href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" target="_blank" rel="noreferrer" className="underline">Application Password</a> from WordPress Users → Profile → Application Passwords.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="wordpressUrl" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>WordPress Site URL</FormLabel>
                      <FormControl><Input type="url" placeholder="https://yoursite.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wordpressUsername" render={({ field }) => (
                    <FormItem>
                      <FormLabel>WordPress Username</FormLabel>
                      <FormControl><Input placeholder="admin" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="wordpressAppPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Password</FormLabel>
                      <FormControl><Input type="password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" {...field} /></FormControl>
                      <FormDescription className="text-xs">Generated in WordPress profile settings.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-3">
                <h4 className="text-sm font-semibold">Squarespace</h4>
                <p className="text-xs text-muted-foreground">
                  Generate an API key from Squarespace Settings → Developer API Keys. The Collection ID is found in your blog's API endpoint.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="squarespaceApiKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Squarespace API Key</FormLabel>
                      <FormControl><Input type="password" placeholder="API key" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="squarespaceCollectionId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog Collection ID</FormLabel>
                      <FormControl><Input placeholder="5f2abc..." {...field} /></FormControl>
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
              <CardTitle>Ad Platforms</CardTitle>
              <CardDescription>
                Optional: connect Google Ads and Meta Ads to push approved paid campaigns directly from the approval queue.
                You can also add these credentials later from the property's edit page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Google Ads</h4>
                <p className="text-xs text-muted-foreground">
                  Requires a Google Ads Customer ID and an OAuth2 refresh token. Also set <code className="bg-muted px-1 rounded">GOOGLE_ADS_DEVELOPER_TOKEN</code>, <code className="bg-muted px-1 rounded">GOOGLE_ADS_CLIENT_ID</code>, and <code className="bg-muted px-1 rounded">GOOGLE_ADS_CLIENT_SECRET</code> environment variables.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="googleAdsCustomerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer ID</FormLabel>
                      <FormControl><Input placeholder="1234567890" {...field} /></FormControl>
                      <FormDescription className="text-xs">10-digit Google Ads account ID</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="googleAdsRefreshToken" render={({ field }) => (
                    <FormItem>
                      <FormLabel>OAuth2 Refresh Token</FormLabel>
                      <FormControl><Input type="password" placeholder="1//0..." {...field} /></FormControl>
                      <FormDescription className="text-xs">From Google OAuth2 authorization flow</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-3">
                <h4 className="text-sm font-semibold">Meta Ads</h4>
                <p className="text-xs text-muted-foreground">
                  Requires a Meta Ad Account ID and a System User access token from Meta Business Manager.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="metaAdsAccountId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ad Account ID</FormLabel>
                      <FormControl><Input placeholder="123456789" {...field} /></FormControl>
                      <FormDescription className="text-xs">Numeric ID from Meta Business Manager (without "act_")</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="metaAdsAccessToken" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token</FormLabel>
                      <FormControl><Input type="password" placeholder="EAABs..." {...field} /></FormControl>
                      <FormDescription className="text-xs">System user or page access token</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="metaAdPageId" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Facebook Page ID</FormLabel>
                      <FormControl><Input placeholder="123456789012345" {...field} /></FormControl>
                      <FormDescription className="text-xs">Required for ad creative creation. Find it under your Page's "About" section or Business Manager.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" onClick={() => setLocation("/properties")}>Cancel</Button>
            <Button type="submit" disabled={createProperty.isPending}>
              {createProperty.isPending ? "Creating..." : "Create Property"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
