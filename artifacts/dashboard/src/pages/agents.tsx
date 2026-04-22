import { useListAgents } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Agents() {
  const { data: agents, isLoading } = useListAgents();

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
        <p className="text-muted-foreground mt-1">Your specialized digital marketing agents.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => (
          <Card key={agent.id} className="overflow-hidden">
            <div className="h-2 w-full" style={{ backgroundColor: agent.color }} />
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl shadow-sm"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.icon}
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  ID: {agent.id.toString().padStart(3, '0')}
                </Badge>
              </div>
              <CardTitle className="text-xl">{agent.name}</CardTitle>
              <CardDescription className="font-medium text-foreground">{agent.role}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {agent.description}
              </p>
              
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-xs font-mono text-muted-foreground mb-1">System Prompt Snippet:</p>
                <p className="text-xs italic line-clamp-3">
                  "{agent.systemPrompt}"
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}