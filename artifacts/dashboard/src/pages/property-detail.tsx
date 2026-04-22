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
import { ChevronLeft, Trash2, CheckCircle2, Lock } from "lucide-react";
import { useEffect } from "react";
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

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: "",
      wordpressUrl: "",
      wordpressUsername: "",
      wordpressAppPassword: "",
      squarespaceApiKey: "",
      squarespaceCollectionId: "",
    },
  });

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

          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={updateProperty.isPending || !form.formState.isDirty}>
              {updateProperty.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
