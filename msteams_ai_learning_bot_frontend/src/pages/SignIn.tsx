import { ArrowRight, Mail, Lock, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { buildApiUrl, getSession, saveSession } from "../config/api";

async function postJson(path: string, payload: Record<string, unknown>) {
  const url = buildApiUrl(path);
  const session = getSession();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json",
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), 
  },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Request failed");
  }
  return response.json();
}

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stage, setStage] = useState<"email" | "password" | "claim">("email");
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast.error("Enter your work email");
      return;
    }

    try {
      setLoading(true);
      const result = await postJson("/api/auth/precheck", { email });
      if (!result.exists) {
        toast.error("We couldn't find this account. Ask your admin to add you via Teams bot.");
        return;
      }
      setStage(result.hasPassword ? "password" : "claim");
      toast.success(result.hasPassword ? "Welcome back" : "Let's set your password");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check account");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error("Enter your password");
      return;
    }
    try {
      setLoading(true);
      const result = await postJson("/api/auth/login", { email, password });
      saveSession(result);
      toast.success("Signed in");
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password || !confirmPassword) {
      toast.error("Fill both password fields");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setLoading(true);
      const result = await postJson("/api/auth/claim", { email, password });
      saveSession(result);
      toast.success("Password saved. You're in!");
      navigate("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  const renderEmailForm = () => (
    <form onSubmit={handleEmailSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-gray-700 mb-2">
          Work email
        </label>
        <div className="relative">
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@company.com"
            required
          />
          <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg py-3 shadow-lg hover:shadow-xl transition-all"
        disabled={loading}
      >
        Continue <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </form>
  );

  const renderPasswordForm = () => (
    <form onSubmit={handlePasswordSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-700 mb-2">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
            required
          />
          <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
        Sign in
      </Button>
      <button
        type="button"
        className="w-full text-sm text-blue-600 hover:text-blue-700"
        onClick={() => setStage("email")}
        disabled={loading}
      >
        Use a different email
      </button>
    </form>
  );

  const renderClaimForm = () => (
    <form onSubmit={handleClaimSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-700 mb-2">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-gray-700 mb-2">
          Create password
        </label>
        <div className="relative">
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
            required
          />
          <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm text-gray-700 mb-2">
          Confirm password
        </label>
        <div className="relative">
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
            required
          />
          <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>
      <Button type="submit" className="w-full bg-blue-600" disabled={loading}>
        Save and continue
      </Button>
      <button
        type="button"
        className="w-full text-sm text-blue-600 hover:text-blue-700"
        onClick={() => setStage("email")}
        disabled={loading}
      >
        Use a different email
      </button>
    </form>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-4xl w-full mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
                Works in Microsoft Teams
              </div>
              <h1 className="text-4xl sm:text-5xl text-gray-900">
                Build real AI fluency{" "}
                <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                  one day at a time
                </span>
              </h1>
              <p className="text-lg text-gray-600">
                Track your progress, build confidence, and see your team's AI capability grow through your system of record.
              </p>
            </div>
            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-blue-400 to-violet-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-gray-900 mb-1">Practice where you work</p>
                  <p className="text-sm text-gray-600">Daily exercises fit right into your Microsoft Teams workflow</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 flex-shrink-0 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-gray-900 mb-1">Watch your growth</p>
                  <p className="text-sm text-gray-600">Individual progress tracking and team-wide insights in one place</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-8 space-y-6">
              <div className="text-center">
                <h2 className="text-gray-900 mb-2">
                  {stage === "email" && "Welcome"}
                  {stage === "password" && "Enter your password"}
                  {stage === "claim" && "Set your password"}
                </h2>
                <p className="text-gray-600">
                  {stage === "email"
                    ? "We’ll match your Teams account"
                    : stage === "password"
                    ? "You already set a password—enter it to continue"
                    : "Finish activating your account to continue"}
                </p>
              </div>

              {stage === "email" && renderEmailForm()}
              {stage === "password" && renderPasswordForm()}
              {stage === "claim" && renderClaimForm()}

              <div className="my-4 flex items-center">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-4 text-sm text-gray-500">or</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-2 border-gray-300 hover:border-gray-400 rounded-lg py-3"
                onClick={() => navigate("/")}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="11" width="12" height="12" fill="#F25022"/>
                  <rect y="11" width="12" height="12" fill="#00A4EF"/>
                  <rect x="11" y="11" width="12" height="12" fill="#FFB900"/>
                  <rect width="12" height="12" fill="#7FBA00"/>
                </svg>
                Continue with Microsoft Teams
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <button onClick={() => navigate("/home")} className="text-gray-600 hover:text-gray-900 text-sm">
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
