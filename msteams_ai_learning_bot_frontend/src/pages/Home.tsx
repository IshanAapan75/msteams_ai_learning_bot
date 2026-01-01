import { ArrowRight, Clock, TrendingUp, Target, Users, CheckCircle2, Zap, BarChart3, Calendar, Building2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useNavigate } from "react-router-dom";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { authService } from "../services/auth"; // Import authService
import { useEffect } from "react"; // Import useEffect

export function Home() {
  const navigate = useNavigate();
  const session = authService.getSession(); // Get session status

  useEffect(() => {
    if (session) {
      // If user is logged in, redirect to dashboard
      navigate("/", { replace: true });
    }
  }, [session, navigate]);

  if (session) {
    // Don't render anything if already logged in and redirecting
    return null;
  }

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="max-w-5xl mx-auto text-center space-y-8 px-4">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
            Works in Microsoft Teams
          </div>

          {/* Hero Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl text-gray-900">
              Build real AI fluency —{" "}
              <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                one day at a time
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto">
              Practice AI for a few minutes each day and see your progress grow.
              <br />
              No long training programs. No surveys. Just practical skills that stick.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              onClick={() => navigate("/sign-in")}
              className="bg-blue-600 hover:bg-blue-700 rounded-lg px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
            >
              Start today's AI practice
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
              variant="outline"
              className="rounded-lg px-8 py-6 text-lg border-2 border-gray-300 hover:border-gray-400 w-full sm:w-auto"
            >
              See how it works
            </Button>
          </div>

          {/* Social Proof Stats Row */}
          <div className="pt-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-400 to-violet-500 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-3xl text-gray-900 mb-1">2–3 minutes</p>
                  <p className="text-sm text-gray-600">per day</p>
                </CardContent>
              </Card>
              
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-3xl text-gray-900 mb-1">12-day streak</p>
                  <p className="text-sm text-gray-600">average</p>
                </CardContent>
              </Card>
              
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-3xl text-gray-900 mb-1">78% fluency</p>
                  <p className="text-sm text-gray-600">score</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Core Value Proposition Section */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl text-gray-900 mb-4">Everything you need to build AI fluency</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Designed for busy professionals who want practical AI skills — not another training program.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Daily micro-learning */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-blue-400 to-violet-500 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">Daily micro-learning</h3>
              <p className="text-gray-600">
                Quick 2–3 minute exercises that fit between meetings. Build habits, not homework.
              </p>
            </CardContent>
          </Card>

          {/* Track real AI usage */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">Track real AI usage</h3>
              <p className="text-gray-600">
                Log actual AI tasks you complete at work. See what's working and where to improve.
              </p>
            </CardContent>
          </Card>

          {/* Build streaks & momentum */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">Build streaks & momentum</h3>
              <p className="text-gray-600">
                Show up consistently and watch your fluency grow over time.
              </p>
            </CardContent>
          </Card>

          {/* Team & individual progress */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">Team & individual progress</h3>
              <p className="text-gray-600">
                See your own growth clearly, and help your team build collective AI confidence.
              </p>
            </CardContent>
          </Card>

          {/* Works inside Teams */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">Works inside Teams</h3>
              <p className="text-gray-600">
                Practice where you already work. No new tools or complex onboarding.
              </p>
            </CardContent>
          </Card>

          {/* Visible growth */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-gray-900 mb-2">Visible growth</h3>
              <p className="text-gray-600">
                Track your fluency score, streaks, and confidence levels as they improve.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works Section */}
      <div id="how-it-works" className="max-w-6xl mx-auto px-4 scroll-mt-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl text-gray-900 mb-4">Simple daily practice that works</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get started quickly and build momentum through small, repeatable actions.
          </p>
        </div>

        <div className="space-y-12">
          {/* Step 01 - Daily Prompt Mockup */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm mb-4">
                Step 01
              </div>
              <h3 className="text-gray-900 mb-3">Get your daily prompt</h3>
              <p className="text-lg text-gray-600">
                Receive a short AI exercise grounded in real work scenarios. Takes just 2–3 minutes.
              </p>
            </div>
            <div className="order-1 md:order-2">
              <Card className="border-gray-200 shadow-lg">
                <CardContent className="p-6 bg-white">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <h3 className="text-gray-900">Today's AI Practice</h3>
                      <span className="text-xs text-gray-500">2 min</span>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-blue-50 to-violet-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>Prompt:</strong> Write an email to your team summarizing last week's project progress using AI to help structure your thoughts.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-600">Try using:</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">ChatGPT</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Claude</span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Copilot</span>
                        </div>
                      </div>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        Start Practice
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Step 02 - Usage Log Mockup */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Card className="border-gray-200 shadow-lg">
                <CardContent className="p-6 bg-white">
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-gray-200">
                      <h3 className="text-gray-900">Log AI Usage</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">What did you use AI for?</label>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-sm text-gray-600">Drafted team update email</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Time saved</label>
                          <div className="p-2 bg-emerald-50 rounded-lg text-center">
                            <p className="text-lg text-gray-900">8 min</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">Confidence</label>
                          <div className="p-2 bg-blue-50 rounded-lg text-center">
                            <p className="text-lg text-gray-900">High</p>
                          </div>
                        </div>
                      </div>
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                        Save Entry
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm mb-4">
                Step 02
              </div>
              <h3 className="text-gray-900 mb-3">Practice and log usage</h3>
              <p className="text-lg text-gray-600">
                Apply it in your work and log how you used AI, including time saved and confidence.
              </p>
            </div>
          </div>

          {/* Step 03 - Dashboard Mockup */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-sm mb-4">
                Step 03
              </div>
              <h3 className="text-gray-900 mb-3">See your growth</h3>
              <p className="text-lg text-gray-600">
                Watch your fluency score rise, maintain streaks, and see team momentum build.
              </p>
            </div>
            <div className="order-1 md:order-2">
              <Card className="border-gray-200 shadow-lg">
                <CardContent className="p-6 bg-white">
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-gray-200">
                      <h3 className="text-gray-900">Your Progress</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Fluency Score</p>
                        <p className="text-3xl text-gray-900">78/100</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Current Streak</p>
                        <p className="text-3xl text-gray-900">12 days</p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Time Saved</p>
                        <p className="text-3xl text-gray-900">347 min</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Confidence</p>
                        <p className="text-3xl text-gray-900">High</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between text-xs text-gray-600 mb-2">
                        <span>Level Progress</span>
                        <span>2,450 / 5,000 XP</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" style={{ width: '49%' }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Lightweight Reassurance Row */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-400 to-violet-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-gray-900 mb-2">Works with any AI tool</h3>
            <p className="text-gray-600">
              Skills transferable across all LLMs
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-gray-900 mb-2">Set up in under a minute</h3>
            <p className="text-gray-600">
              No complex configuration. Start practicing immediately.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-gray-900 mb-2">Designed for Teams users & managers</h3>
            <p className="text-gray-600">
              Works seamlessly in your existing Microsoft Teams environment.
            </p>
          </div>
        </div>
      </div>

      {/* Teams & Managers Section */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl text-gray-900 mb-4">See your team's AI fluency grow in real time</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Understand how your team is actually building AI capability — beyond course completion.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start mb-8">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 mt-0.5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1">Track team-wide fluency scores and trends</h3>
                <p className="text-gray-600">See average scores and momentum across your entire team.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 mt-0.5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1">See participation and engagement at a glance</h3>
                <p className="text-gray-600">Know who's actively building AI skills and who needs support.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 mt-0.5 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1">Celebrate progress and shared momentum</h3>
                <p className="text-gray-600">Recognize streaks, achievements, and team milestones.</p>
              </div>
            </div>
          </div>

          {/* Dashboard Preview */}
          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <h3 className="text-gray-900">Team Dashboard</h3>
                <span className="text-sm text-gray-500">Live preview</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Team Momentum Score</p>
                  <p className="text-3xl text-gray-900">68</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Participants</p>
                  <p className="text-3xl text-gray-900">47</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Average Fluency</p>
                  <p className="text-3xl text-gray-900">74/100</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Usage Logs</p>
                  <p className="text-3xl text-gray-900">134</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="bg-gradient-to-r from-blue-50 via-violet-50 to-purple-50 rounded-2xl p-12 shadow-sm">
          <h2 className="text-gray-900 mb-3">Ready to build AI fluency?</h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join teams developing real AI capability through daily practice.
            <br />
            Getting started takes just a few minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => navigate("/sign-in")}
              className="bg-blue-600 hover:bg-blue-700 rounded-lg px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
            >
              Start today's AI practice
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="rounded-lg px-8 py-6 text-lg border-2 border-gray-300 hover:border-gray-400 w-full sm:w-auto"
            >
              Book a demo for your team
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}