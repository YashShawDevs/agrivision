import { FileText } from "lucide-react";
export function MissionSummary({ summary }: { summary: string }) {
  if (!summary) return null;
  return (
    <div className="card-base p-4 space-y-2 animate-fade-up border-l-4 border-l-primary">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Mission Summary</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
    </div>
  );
}
