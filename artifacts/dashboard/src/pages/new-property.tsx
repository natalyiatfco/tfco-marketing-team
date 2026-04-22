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
import { ChevronLeft } from "lucide-react";

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
    },
  });

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
              <CardTitle>Brand Guidelines</CardTitle>
              <CardDescription>Agents use these to align with the brand identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brandVoice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Voice</FormLabel>
                      <FormControl><Input placeholder="e.g. Professional, Playful" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone</FormLabel>
                      <FormControl><Input placeholder="e.g. Enthusiastic, Educational" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Target Audience</FormLabel>
                      <FormControl><Input placeholder="e.g. Millennials, Fine dining enthusiasts" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primaryKeywords"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Primary Keywords</FormLabel>
                      <FormControl><Input placeholder="e.g. luxury, organic, sustainable" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Digital Presence</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Website URL</FormLabel>
                    <FormControl><Input type="url" placeholder="https://..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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