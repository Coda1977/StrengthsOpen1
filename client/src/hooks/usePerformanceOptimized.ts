import { useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

// Memoized strength domain mapping
export const STRENGTHS_DOMAIN_MAP = {
  'Achiever': 'Executing', 'Activator': 'Influencing', 'Adaptability': 'Relationship Building', 'Analytical': 'Strategic Thinking', 'Arranger': 'Executing',
  'Belief': 'Executing', 'Command': 'Influencing', 'Communication': 'Influencing', 'Competition': 'Influencing', 'Connectedness': 'Relationship Building',
  'Consistency': 'Executing', 'Context': 'Strategic Thinking', 'Deliberative': 'Executing', 'Developer': 'Relationship Building', 'Discipline': 'Executing',
  'Empathy': 'Relationship Building', 'Focus': 'Executing', 'Futuristic': 'Strategic Thinking', 'Harmony': 'Relationship Building', 'Ideation': 'Strategic Thinking',
  'Includer': 'Relationship Building', 'Individualization': 'Relationship Building', 'Input': 'Strategic Thinking', 'Intellection': 'Strategic Thinking', 'Learner': 'Strategic Thinking',
  'Maximizer': 'Influencing', 'Positivity': 'Relationship Building', 'Relator': 'Relationship Building', 'Responsibility': 'Executing', 'Restorative': 'Executing',
  'Self-Assurance': 'Influencing', 'Significance': 'Influencing', 'Strategic': 'Strategic Thinking', 'Woo': 'Influencing'
} as const;

export const ALL_STRENGTHS = [
  'Achiever', 'Activator', 'Adaptability', 'Analytical', 'Arranger',
  'Belief', 'Command', 'Communication', 'Competition', 'Connectedness',
  'Consistency', 'Context', 'Deliberative', 'Developer', 'Discipline',
  'Empathy', 'Focus', 'Futuristic', 'Harmony', 'Ideation',
  'Includer', 'Individualization', 'Input', 'Intellection', 'Learner',
  'Maximizer', 'Positivity', 'Relator', 'Responsibility', 'Restorative',
  'Self-Assurance', 'Significance', 'Strategic', 'Woo'
] as const;

interface TeamMember {
  id: string;
  name: string;
  strengths: string[];
}

// Memoized hook for processing team data
export function useTeamAnalytics(teamMembers: TeamMember[]) {
  return useMemo(() => {
    if (!teamMembers || teamMembers.length === 0) {
      return {
        domainDistribution: {},
        strengthCounts: {},
        totalMembers: 0,
        averageStrengthsPerMember: 0,
        topStrengths: [],
        domainCoverage: 0
      };
    }

    // Calculate strength counts
    const strengthCounts = teamMembers.reduce((acc, member) => {
      member.strengths.forEach(strength => {
        acc[strength] = (acc[strength] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    // Calculate domain distribution
    const domainDistribution = teamMembers.reduce((acc, member) => {
      member.strengths.forEach(strength => {
        const domain = STRENGTHS_DOMAIN_MAP[strength];
        if (domain) {
          acc[domain] = (acc[domain] || 0) + 1;
        }
      });
      return acc;
    }, {} as Record<string, number>);

    // Calculate top strengths
    const topStrengths = Object.entries(strengthCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([strength, count]) => ({ strength, count }));

    // Calculate domain coverage
    const uniqueDomains = Object.keys(domainDistribution).length;
    const domainCoverage = (uniqueDomains / 4) * 100; // 4 total domains

    // Calculate average strengths per member
    const totalStrengths = teamMembers.reduce((sum, member) => sum + member.strengths.length, 0);
    const averageStrengthsPerMember = teamMembers.length > 0 ? totalStrengths / teamMembers.length : 0;

    return {
      domainDistribution,
      strengthCounts,
      totalMembers: teamMembers.length,
      averageStrengthsPerMember: Math.round(averageStrengthsPerMember * 10) / 10,
      topStrengths,
      domainCoverage: Math.round(domainCoverage)
    };
  }, [teamMembers]);
}

// Optimized query hook with proper caching
export function useOptimizedQuery<T>(
  queryKey: string[],
  enabled: boolean = true,
  staleTime: number = 10 * 60 * 1000 // 10 minutes default
) {
  return useQuery<T>({
    queryKey,
    enabled,
    staleTime,
    gcTime: 15 * 60 * 1000, // 15 minutes cache time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });
}

// Memoized chart data processor
export function useChartData(teamMembers: TeamMember[]) {
  return useMemo(() => {
    const { domainDistribution, strengthCounts } = useTeamAnalytics(teamMembers);

    // Domain chart data
    const domainChartData = Object.entries(domainDistribution).map(([domain, count]) => ({
      domain: domain.replace(' ', '\n'), // Break long domain names
      count,
      percentage: teamMembers.length > 0 ? Math.round((count / teamMembers.reduce((sum, m) => sum + m.strengths.length, 0)) * 100) : 0
    }));

    // Top strengths chart data
    const strengthsChartData = Object.entries(strengthCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8) // Top 8 for better visualization
      .map(([strength, count]) => ({
        strength: strength.length > 12 ? strength.substring(0, 12) + '...' : strength,
        fullStrength: strength,
        count,
        percentage: teamMembers.length > 0 ? Math.round((count / teamMembers.length) * 100) : 0
      }));

    return {
      domainChartData,
      strengthsChartData,
      isEmpty: teamMembers.length === 0
    };
  }, [teamMembers]);
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();
  
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

// Memoized search filter
export function useFilteredData<T>(
  data: T[],
  searchTerm: string,
  filterFn: (item: T, search: string) => boolean
) {
  return useMemo(() => {
    if (!searchTerm.trim()) return data;
    return data.filter(item => filterFn(item, searchTerm.toLowerCase()));
  }, [data, searchTerm, filterFn]);
}