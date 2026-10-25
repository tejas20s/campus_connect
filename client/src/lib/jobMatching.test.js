import { describe, expect, it } from 'vitest';
import { getJobMatch } from './jobMatching';

describe('getJobMatch', () => {
  it('matches student profile values without case or whitespace differences', () => {
    const result = getJobMatch({
      eligibility: {
        branches: ['Computer Science'],
        graduationYears: [2027],
        minCgpa: 8,
        skills: ['JavaScript', ' React ']
      }
    }, {
      branch: ' computer science ',
      graduationYear: 2027,
      cgpa: 8.4,
      skills: ['javascript', 'React']
    });

    expect(result).toMatchObject({
      eligible: true,
      missingRequirements: [],
      matchedSkills: ['JavaScript', ' React '],
      missingSkills: [],
      skillMatchPercent: 100
    });
  });

  it('reports every unmet requirement and recommends missing skills', () => {
    const result = getJobMatch({
      eligibility: {
        branches: ['Computer Science'],
        graduationYears: [2027, 2028],
        minCgpa: 8,
        skills: ['JavaScript', 'SQL']
      }
    }, {
      branch: 'Physics',
      graduationYear: 2026,
      cgpa: 7.2,
      skills: ['JavaScript']
    });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toHaveLength(4);
    expect(result.missingRequirements.join(' ')).toContain('branch');
    expect(result.missingRequirements.join(' ')).toContain('graduation year');
    expect(result.missingRequirements.join(' ')).toContain('CGPA');
    expect(result.missingSkills).toEqual(['SQL']);
    expect(result.skillMatchPercent).toBe(50);
  });

  it('identifies missing academic profile fields rather than treating them as eligible', () => {
    const result = getJobMatch({
      eligibility: {
        branches: ['Computer Science'],
        graduationYears: [2027],
        minCgpa: 8
      }
    }, {});

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements).toHaveLength(3);
  });

  it('reports no skill score when the job does not specify required skills', () => {
    expect(getJobMatch({ eligibility: null }, {}).skillMatchPercent).toBeNull();
  });
});
