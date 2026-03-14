import { Card } from "../ui/Card";

interface PlaceholderTabProps {
  name: string;
  description?: string;
}

export function PlaceholderTab({ name, description }: PlaceholderTabProps) {
  return (
    <div className="p-4">
      <Card className="flex flex-col items-center justify-center h-64">
        <div className="text-lg font-medium text-gray-400">{name}</div>
        <div className="text-sm text-gray-600 mt-2">
          {description || "Coming in Phase 2-4"}
        </div>
      </Card>
    </div>
  );
}
