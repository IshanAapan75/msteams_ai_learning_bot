import { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { CheckCircle2, Sparkles, TrendingUp, Flame } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { authService } from "../services/auth";
import { useNavigate } from "react-router-dom";
import { usageService } from "../services/usage";
import { toast } from "sonner";

export function UsageLog() {
  const navigate = useNavigate();
  const session = authService.getSession();
  const [submitted, setSubmitted] = useState(false);
  const [taskType, setTaskType] = useState("");
  const [timeSaved, setTimeSaved] = useState("");
  const [confidence, setConfidence] = useState("");
  const [description, setDescription] = useState("");
  const [otherTaskDescription, setOtherTaskDescription] = useState("");

  useEffect(() => {
    if (!session) {
      navigate("/sign-in", { replace: true });
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }


  const taskTypes = [
    "Email drafting",
    "Meeting summaries",
    "Data analysis",
    "Code review",
    "Content creation",
    "Research",
    "Presentation prep",
    "Other",
  ];

  const timeBands = [
    { label: "1-5 min", value: "1-5", xp: 25 },
    { label: "6-15 min", value: "6-15", xp: 40 },
    { label: "16-30 min", value: "16-30", xp: 60 },
    { label: "31-60 min", value: "31-60", xp: 85 },
    { label: "60+ min", value: "60+", xp: 120 },
  ];

  const confidenceLevels = [
    { label: "Low", value: "low", color: "bg-orange-100 text-orange-700 border-orange-200" },
    { label: "Medium", value: "medium", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { label: "High", value: "high", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ];

  if (!session) {
    navigate("/sign-in");
    return null;
  }

  const recentLogs = [
    { task: "Summarized meeting notes", time: "12 min", xp: 40, date: "Today, 2:34 PM" },
    { task: "Generated email draft", time: "8 min", xp: 35, date: "Today, 11:20 AM" },
    { task: "Data analysis assistance", time: "25 min", xp: 75, date: "Yesterday" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskType || !timeSaved || !confidence || (taskType === "Other" && !otherTaskDescription.trim())) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await usageService.logUsage({
        taskType,
        otherTaskDescription: taskType === "Other" ? otherTaskDescription : undefined,
        timeSaved,
        confidence,
        description,
      });
      setSubmitted(true);
      toast.success("Usage logged successfully");
      setTimeout(() => {
        setTaskType("");
        setTimeSaved("");
        setConfidence("");
        setDescription("");
        setOtherTaskDescription("");
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log usage");
    }
  };

  const getXPForTime = () => {
    const band = timeBands.find((b) => b.value === timeSaved);
    return band ? band.xp : 0;
  };

  if (submitted) {
    const xpEarned = getXPForTime();
    
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-gray-200 shadow-lg">
          <CardContent className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full mb-6 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-gray-900 mb-2">Great work! 🎉</h2>
            <p className="text-gray-600 mb-6">Your AI usage has been logged</p>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl text-blue-700">+{xpEarned}</span>
                </div>
                <p className="text-xs text-blue-600">XP Earned</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-600" />
                  <span className="text-2xl text-orange-700">13</span>
                </div>
                <p className="text-xs text-orange-600">Day Streak</p>
              </div>
            </div>

            <div className="inline-block p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-amber-900">
                🏆 You're just 2 more logs away from the "Consistency Champion" badge!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">Log AI Usage</h2>
        <p className="text-gray-600 mt-1">Track your AI-powered productivity and earn XP</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Task Type */}
                <div>
                  <label className="block text-sm text-gray-700 mb-3">
                    What did you use AI for? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {taskTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setTaskType(type)}
                        className={`p-3 rounded-lg border-2 transition-all text-sm ${
                          taskType === type
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Other Task Description */}
                {taskType === "Other" && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-3">
                      Please describe the task <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={otherTaskDescription}
                      onChange={(e) => setOtherTaskDescription(e.target.value)}
                      placeholder="E.g., Training material development, competitive analysis, etc."
                      className="min-h-20 resize-none rounded-lg border-gray-200"
                    />
                  </div>
                )}

                {/* Time Saved */}
                <div>
                  <label className="block text-sm text-gray-700 mb-3">
                    How much time did you save? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {timeBands.map((band) => (
                      <button
                        key={band.value}
                        type="button"
                        onClick={() => setTimeSaved(band.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          timeSaved === band.value
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm text-gray-900">{band.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confidence */}
                <div>
                  <label className="block text-sm text-gray-700 mb-3">
                    Confidence in output quality <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {confidenceLevels.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setConfidence(level.value)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          confidence === level.value
                            ? level.color + " border-current"
                            : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-gray-700 mb-3">
                    Brief description (optional)
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="E.g., Used Claude to summarize 30-minute leadership meeting and extract action items..."
                    className="min-h-24 resize-none rounded-lg border-gray-200"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Sharing details helps your team learn from your AI wins!
                  </p>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={!taskType || !timeSaved || !confidence || (taskType === "Other" && !otherTaskDescription.trim())}
                  className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Log Usage & Earn XP
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Recent Logs Sidebar */}
        <div>
          <Card className="border-gray-200 shadow-sm sticky top-24">
            <CardContent className="p-6">
              <h3 className="text-gray-900 mb-4">Recent Logs</h3>
              <div className="space-y-3">
                {recentLogs.map((log, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-900 mb-1">{log.task}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{log.date}</span>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">
                        +{log.xp} XP
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-violet-50 rounded-lg border border-blue-100">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 mb-1">Keep it up!</p>
                    <p className="text-xs text-blue-700">
                      Log daily to maintain your streak and unlock exclusive badges
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}