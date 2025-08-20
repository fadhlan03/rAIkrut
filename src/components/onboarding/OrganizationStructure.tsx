import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  Users, 
  User, 
  Building, 
  TrendingUp, 
  Headphones, 
  ArrowRight 
} from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  email?: string;
  bio?: string;
  initials?: string;
}

interface OrganizationStructureProps {
  onComplete: () => void;
  isCompleted: boolean;
  data?: {
    teamMembers?: TeamMember[];
  };
}

const OrganizationStructure: React.FC<OrganizationStructureProps> = ({ onComplete, isCompleted, data }) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [viewedTeams, setViewedTeams] = useState<Set<string>>(new Set());

  // Use dynamic data if available, otherwise fall back to hardcoded data
  const teamMembers = data?.teamMembers || [
    { name: 'Alex Rodriguez', role: 'Engineering Manager', initials: 'AR' },
    { name: 'Jordan Davis', role: 'Senior Software Engineer', initials: 'JD' },
    { name: 'Sam Miller', role: 'Senior Software Engineer', initials: 'SM' }
  ];

  const teams = [
    {
      id: 'engineering',
      name: 'Engineering',
      icon: Building,
      description: 'Your home team - responsible for developing and maintaining our core telecom infrastructure.',
      manager: 'Alex Rodriguez',
      size: '45 engineers',
      departments: ['Backend Systems', 'Frontend Development', 'DevOps', 'QA Engineering'],
      yourRole: 'You\'ll be part of the Backend Systems team, working on scalable microservices architecture.'
    },
    {
      id: 'product',
      name: 'Product',
      icon: TrendingUp,
      description: 'Defines product strategy and roadmap, works closely with engineering on feature development.',
      manager: 'Maya Patel',
      size: '12 members',
      departments: ['Product Strategy', 'UX/UI Design', 'Product Analytics', 'Customer Research'],
      yourRole: 'You\'ll collaborate with product managers on technical feasibility and implementation planning.'
    },
    {
      id: 'operations',
      name: 'Operations',
      icon: Headphones,
      description: 'Ensures our network infrastructure runs smoothly 24/7, manages customer support.',
      manager: 'David Kim',
      size: '35 members',
      departments: ['Network Operations', 'Customer Support', 'Technical Support', 'Infrastructure'],
      yourRole: 'You\'ll work with ops teams on monitoring, alerting, and system reliability improvements.'
    },
    {
      id: 'sales',
      name: 'Sales & Marketing',
      icon: TrendingUp,
      description: 'Drives business growth through customer acquisition and strategic partnerships.',
      manager: 'Lisa Thompson',
      size: '28 members',
      departments: ['Enterprise Sales', 'Digital Marketing', 'Business Development', 'Customer Success'],
      yourRole: 'You may occasionally support sales with technical demos and solution architecture discussions.'
    }
  ];

  const handleTeamClick = (teamId: string) => {
    setSelectedTeam(teamId);
    const newViewedTeams = new Set(viewedTeams);
    newViewedTeams.add(teamId);
    setViewedTeams(newViewedTeams);
  };

  const allTeamsViewed = viewedTeams.size === teams.length;

  // Helper function to get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Organization Structure</h1>
        <p className="text-muted-foreground">Get to know the teams you'll be working with</p>
        <div className="text-sm text-muted-foreground">
          Teams explored: {viewedTeams.size}/{teams.length}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Our Teams</h2>
          {teams.map((team) => {
            const Icon = team.icon;
            const isViewed = viewedTeams.has(team.id);
            const isSelected = selectedTeam === team.id;
            
            return (
              <Card 
                key={team.id}
                className={`cursor-pointer transition-all border ${
                  isSelected 
                    ? 'border-primary bg-primary/5' 
                    : isViewed
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border hover:border-primary/20 hover:bg-accent/30'
                }`}
                onClick={() => handleTeamClick(team.id)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-foreground flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      {team.name}
                    </div>
                    {isViewed && (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">{team.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {team.manager}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {team.size}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          {selectedTeam ? (
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">
                  {teams.find(t => t.id === selectedTeam)?.name} Team Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Team Manager</h4>
                  <p className="text-muted-foreground">{teams.find(t => t.id === selectedTeam)?.manager}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">Team Size</h4>
                  <p className="text-muted-foreground">{teams.find(t => t.id === selectedTeam)?.size}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">Departments</h4>
                  <div className="flex flex-wrap gap-2">
                    {teams.find(t => t.id === selectedTeam)?.departments.map((dept) => (
                      <span key={dept} className="bg-accent text-accent-foreground px-2 py-1 rounded text-sm">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-accent/30 border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">Your Collaboration</h4>
                  <p className="text-muted-foreground text-sm">
                    {teams.find(t => t.id === selectedTeam)?.yourRole}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border">
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground mb-4">
                  <Users className="w-16 h-16 mx-auto" />
                </div>
                <p className="text-muted-foreground">Click on a team to learn more about their structure and your collaboration with them.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="border border-border bg-accent/30">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Your Direct Team</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {teamMembers.map((member, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full mx-auto mb-2 flex items-center justify-center text-white font-semibold">
                  {member.initials || getInitials(member.name)}
                </div>
                <p className="font-medium text-foreground">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.role}</p>
                {member.email && (
                  <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              You'll be working closely with this team on our core projects.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-4">
        {!isCompleted && (
          <Button 
            onClick={onComplete}
            disabled={!allTeamsViewed}
            variant={allTeamsViewed ? "default" : "secondary"}
            className="px-8 py-3 text-lg"
          >
            {allTeamsViewed ? (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue to Onboarding Form
              </>
            ) : (
              'Explore all teams to continue'
            )}
          </Button>
        )}
        {isCompleted && (
          <div className="flex items-center justify-center gap-2 text-primary font-semibold">
            <CheckCircle className="h-4 w-4" />
            Organization structure section completed!
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationStructure; 