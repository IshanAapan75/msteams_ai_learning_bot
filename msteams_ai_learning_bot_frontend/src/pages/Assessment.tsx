import { useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react"; // Import XCircle for failed quizzes
import { authService } from "../services/auth";
import { useNavigate } from "react-router-dom";
import { useAnalyticsData } from "../hooks/useAnalyticsData"; // To fetch quiz data
import { analyticsService } from "../services/analytics"; // To fetch quiz data
import { SectionSkeleton } from "../components/analytics/LoadingBlocks"; // For loading state
import { ErrorState } from "../components/analytics/DataState"; // For error state

// Re-using the QuizAttempt and QuizResponse types
import type { QuizAttempt, QuizResponse } from "../types/analytics";

export function Assessment() {
  const navigate = useNavigate();
  const session = authService.getSession();

  useEffect(() => {
    if (!session) {
      navigate("/sign-in", { replace: true });
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }

  // Fetch quiz attempts using the analytics service
  const quizState = useAnalyticsData<QuizResponse>(() => analyticsService.getQuiz());

  // Helper to format date
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Helper to get result display
  const getResultDisplay = (result?: string) => {
    if (result === "passed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Passed
        </span>
      );
    } else if (result === "failed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3" /> Failed
        </span>
      );
    }
    return <span className="text-gray-500 text-xs">Unknown</span>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">Quiz Attempt History</h2>
        <p className="text-gray-600 mt-1">Review your past quiz performances and learning progress.</p>
      </div>

      {quizState.loading && <SectionSkeleton rows={5} />}
      {quizState.error && <ErrorState message={quizState.error} />}

      {!quizState.loading && quizState.data && quizState.data.latestAttempts.length > 0 ? (
        <div className="space-y-4">
          {/* Note: The API currently returns quizId only.
              To display "AI Learning Name" and "Topic", the backend API needs to be extended
              to include this information with each quiz attempt, or a separate API call
              to fetch learning module details needs to be implemented and data joined here.
              For now, using placeholder based on quizId.
          */}
          {quizState.data.latestAttempts.map((attempt: QuizAttempt, index: number) => (
            <Card key={index} className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {/* AI Learning Name (Placeholder) */}
                  <h3 className="text-lg font-semibold text-gray-900">
                    AI Learning: {attempt.quizId?.split('-')[0].replace(/\b\w/g, (l) => l.toUpperCase()) || "Module"} {/* Placeholder */}
                  </h3>
                  {/* Topic (Placeholder) */}
                  <p className="text-sm text-gray-600">
                    Topic: {attempt.quizId?.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || "General AI"} {/* Placeholder */}
                  </p>

                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-700 font-medium mb-1">Quiz Attempt:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <strong>Date:</strong> {formatDate(attempt.submittedAt)}
                      </div>
                      <div>
                        <strong>Result:</strong> {getResultDisplay(attempt.result)}
                      </div>
                      <div>
                        <strong>Score:</strong> {attempt.score?.correct ?? 0} / {attempt.score?.total ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        !quizState.loading && !quizState.error && (
          <div className="text-center py-12 text-gray-500">
            <p>No quiz attempts found yet.</p>
            <p className="mt-2">Start your learning journey to see your progress here!</p>
          </div>
        )
      )}
    </div>
  );
}