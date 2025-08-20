import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Trophy, TrendingUp } from "lucide-react";
import { DashboardStats } from "@/app/actions";

interface ScoreCardsProps {
  stats: DashboardStats;
}

export function ScoreCards({ stats }: ScoreCardsProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* First Row - Main Stats */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Total Applicants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalApplicants}</div>
            <p className="text-xs text-muted-foreground">Across all job posts</p>
          </CardContent>
        </Card>

        {/* Job with Most Applicants */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular Job</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.jobWithMostApplicants.count}</div>
            <p className="text-xs text-muted-foreground truncate" title={stats.jobWithMostApplicants.jobTitle}>
              {stats.jobWithMostApplicants.jobTitle}
            </p>
          </CardContent>
        </Card>

        {/* Average Applicants per Job */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Applicants/Job</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.averageApplicantsPerJob)}</div>
            <p className="text-xs text-muted-foreground">Per job posting</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Second Row - Candidates by Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Candidates by Status</CardTitle>
            <span className="text-xs text-muted-foreground">
              Total: {Object.values(stats.candidatesByStatus).reduce((sum, count) => sum + count, 0)}
            </span>
          </div>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-evenly gap-4">
            {Object.entries(stats.candidatesByStatus)
              .filter(([status, count]) => count > 0)
              .map(([status, count]) => (
                <div key={status} className="text-center">
                  <div className="text-2xl font-bold">{count}</div>
                  <Badge variant="outline" className="text-xs mt-1">
                    {status}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}