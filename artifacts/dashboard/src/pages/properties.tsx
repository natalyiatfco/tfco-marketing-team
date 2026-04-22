import { useListProperties } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Building2, Globe, Instagram, Facebook, Twitter, Linkedin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Properties() {
  const { data: properties, isLoading } = useListProperties();

  if (isLoading) {
    return <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48"></div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-64 bg-muted rounded-xl"></div>)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands & Properties</h1>
          <p className="text-muted-foreground mt-1">Manage profiles and guidelines for your brands.</p>
        </div>
        <Link href="/properties/new">
          <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer">
            Add Property
          </div>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties?.map((property) => (
          <Card key={property.id} className="flex flex-col">
            <CardHeader>
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">{property.name}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {property.description || "No description provided."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Voice & Tone</p>
                <div className="flex flex-wrap gap-2">
                  {property.brandVoice && <Badge variant="secondary">{property.brandVoice}</Badge>}
                  {property.tone && <Badge variant="outline">{property.tone}</Badge>}
                </div>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex gap-2">
                  {property.websiteUrl && <a href={property.websiteUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Globe className="w-4 h-4" /></a>}
                  {property.instagramHandle && <a href={`https://instagram.com/${property.instagramHandle}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Instagram className="w-4 h-4" /></a>}
                  {property.facebookHandle && <a href={`https://facebook.com/${property.facebookHandle}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Facebook className="w-4 h-4" /></a>}
                  {property.twitterHandle && <a href={`https://twitter.com/${property.twitterHandle}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Twitter className="w-4 h-4" /></a>}
                  {property.linkedinHandle && <a href={`https://linkedin.com/company/${property.linkedinHandle}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="w-4 h-4" /></a>}
                </div>
                
                <Link href={`/properties/${property.id}`} className="block w-full">
                  <Button variant="outline" className="w-full">
                    View Details & Edit
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}