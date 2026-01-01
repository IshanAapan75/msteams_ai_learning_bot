import { ReactNode } from "react";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function MetricCard({
  label,
  value,
  helper,
  icon,
  loading,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-3xl text-gray-900">{value}</p>
            )}
            {helper && !loading && <p className="text-sm text-gray-500 mt-1">{helper}</p>}
          </div>
          {icon && <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
