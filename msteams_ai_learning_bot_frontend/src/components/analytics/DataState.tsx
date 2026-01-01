import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "../ui/button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 border border-red-100 bg-red-50 rounded-xl">
      <AlertCircle className="w-6 h-6 text-red-600" />
      <p className="text-sm text-red-700 text-center">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
          <RefreshCcw className="w-4 h-4" /> Try again
        </Button>
      )}
    </div>
  );
}
