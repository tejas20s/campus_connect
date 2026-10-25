function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getJobMatch(job, student) {
  const criteria = job.eligibility || {};
  const studentSkills = new Set((student?.skills || []).map(normalize).filter(Boolean));
  const requiredSkills = (criteria.skills || []).filter((skill) => normalize(skill));
  const matchedSkills = requiredSkills.filter((skill) => studentSkills.has(normalize(skill)));
  const missingSkills = requiredSkills.filter((skill) => !studentSkills.has(normalize(skill)));
  const missingRequirements = [];

  if (criteria.branches?.length) {
    if (!student?.branch) {
      missingRequirements.push(`Add your branch. Eligible branches: ${criteria.branches.join(', ')}.`);
    } else if (!criteria.branches.some((branch) => normalize(branch) === normalize(student.branch))) {
      missingRequirements.push(`Your branch must be one of: ${criteria.branches.join(', ')}.`);
    }
  }

  if (criteria.graduationYears?.length) {
    if (student?.graduationYear == null) {
      missingRequirements.push(`Add your graduation year. Eligible years: ${criteria.graduationYears.join(', ')}.`);
    } else if (!criteria.graduationYears.includes(Number(student.graduationYear))) {
      missingRequirements.push(`Your graduation year must be one of: ${criteria.graduationYears.join(', ')}.`);
    }
  }

  if (criteria.minCgpa != null) {
    if (student?.cgpa == null) {
      missingRequirements.push(`Add your CGPA. The minimum is ${criteria.minCgpa}.`);
    } else if (Number(student.cgpa) < criteria.minCgpa) {
      missingRequirements.push(`Your CGPA is below the minimum of ${criteria.minCgpa}.`);
    }
  }

  if (missingSkills.length) {
    missingRequirements.push(`Build these required skills: ${missingSkills.join(', ')}.`);
  }

  return {
    eligible: missingRequirements.length === 0,
    missingRequirements,
    requiredSkills,
    matchedSkills,
    missingSkills,
    skillMatchPercent: requiredSkills.length
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : null
  };
}
