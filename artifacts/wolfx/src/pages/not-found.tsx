import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">404 — Not Found</h1>
        <p className="text-muted-foreground text-sm">This page doesn't exist.</p>
        <Link href="/"><Button size="sm">Back to Dashboard</Button></Link>
      </div>
    </div>
  );
}
