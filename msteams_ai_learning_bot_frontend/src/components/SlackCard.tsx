import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { ExternalLink } from "lucide-react";

export function SlackCard() {
  return (
    <Card className="max-w-md border-l-4 border-l-blue-500 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Badge Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-300 to-amber-400 rounded-lg flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
            🏆
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-400 text-white text-xs">
                  PS
                </AvatarFallback>
              </Avatar>
              <p className="text-sm">
                <span className="text-gray-900">Priyanka Sharma</span>
                <span className="text-gray-500"> earned a badge!</span>
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <p className="text-sm text-gray-900 mb-1">🎖️ Gold Skill Badge</p>
              <p className="text-xs text-gray-600">+100 XP • Quick Learner achievement unlocked</p>
            </div>

            <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors">
              <span>View dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
