import { ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-4xl mx-auto text-center space-y-8 px-4">
        {/* Hero Heading */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl text-gray-900">
            Build real AI fluency{" "}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              one day at a time
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto">
            Daily micro-learning, real AI usage, and visible progress.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Button
            onClick={() => navigate("/assessment")}
            className="bg-blue-600 hover:bg-blue-700 rounded-lg px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
          >
            Individual
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <Button
            onClick={() => navigate("/team-dashboard")}
            variant="outline"
            className="rounded-lg px-8 py-6 text-lg border-2 border-gray-300 hover:border-gray-400 w-full sm:w-auto"
          >
            Team Champion
          </Button>
        </div>

        {/* Visual Indicator */}
        <div className="pt-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Start your AI fluency journey today
          </div>
        </div>
      </div>
    </div>
  );
}
