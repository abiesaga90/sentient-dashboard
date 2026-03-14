import { Card, CardHeader, CardTitle } from "../ui/Card";
import { ResponsiveContainer } from "recharts";

interface ChartContainerProps {
  title: string;
  height?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function ChartContainer({
  title,
  height = 300,
  children,
  action,
}: ChartContainerProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {action}
        </div>
      </CardHeader>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </Card>
  );
}
