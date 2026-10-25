import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(serverRoot, '..');
dotenv.config({ path: resolve(projectRoot, '.env') });

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Demo seed data can only be created when NODE_ENV=development.');
}

const prisma = new PrismaClient();
const demoPassword = 'CampusConnectDemo2026!';

async function upsertUser({ email, role, isApproved = true, passwordHash }) {
  return prisma.user.upsert({
    where: { email },
    create: { email, role, isApproved, passwordHash },
    update: { role, isApproved, passwordHash }
  });
}

async function upsertJob(companyId, data) {
  const existing = await prisma.job.findFirst({
    where: { companyId, title: data.title }
  });
  if (existing) {
    return prisma.job.update({ where: { id: existing.id }, data });
  }
  return prisma.job.create({ data: { ...data, companyId } });
}

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const currentYear = new Date().getFullYear();
  const graduationYear = currentYear + 1;

  const studentUser = await upsertUser({
    email: 'student@campusconnect.example',
    role: 'STUDENT',
    passwordHash
  });
  const alumniUser = await upsertUser({
    email: 'alumni@campusconnect.example',
    role: 'ALUMNI',
    passwordHash
  });
  const recruiterUser = await upsertUser({
    email: 'recruiter@campusconnect.example',
    role: 'RECRUITER',
    passwordHash
  });
  await upsertUser({
    email: 'officer@campusconnect.example',
    role: 'PLACEMENT_OFFICER',
    passwordHash
  });

  const student = await prisma.studentProfile.upsert({
    where: { userId: studentUser.id },
    create: {
      userId: studentUser.id,
      fullName: 'Demo Student',
      branch: 'Computer Science',
      graduationYear,
      cgpa: 8.4,
      skills: ['JavaScript', 'React', 'SQL']
    },
    update: {
      fullName: 'Demo Student',
      branch: 'Computer Science',
      graduationYear,
      cgpa: 8.4,
      skills: ['JavaScript', 'React', 'SQL']
    }
  });

  await prisma.alumniProfile.upsert({
    where: { userId: alumniUser.id },
    create: {
      userId: alumniUser.id,
      fullName: 'Demo Alumni',
      graduationYear: currentYear - 3,
      department: 'Computer Science',
      currentCompany: 'Northstar Labs (Demo)',
      jobTitle: 'Software Engineer',
      skills: ['JavaScript', 'Cloud Computing'],
      bio: 'A fictional alumni profile for local development.',
      isPublic: true
    },
    update: {
      fullName: 'Demo Alumni',
      graduationYear: currentYear - 3,
      department: 'Computer Science',
      currentCompany: 'Northstar Labs (Demo)',
      jobTitle: 'Software Engineer',
      skills: ['JavaScript', 'Cloud Computing'],
      bio: 'A fictional alumni profile for local development.',
      isPublic: true
    }
  });

  const company = await prisma.company.upsert({
    where: { name: 'Northstar Labs (Demo)' },
    create: {
      name: 'Northstar Labs (Demo)',
      industry: 'Software',
      website: 'https://example.com',
      location: 'Remote',
      description: 'A fictional company used for local development.',
      isVerified: true
    },
    update: { isVerified: true }
  });

  await prisma.recruiterProfile.upsert({
    where: { userId: recruiterUser.id },
    create: {
      userId: recruiterUser.id,
      companyId: company.id,
      designation: 'Campus Recruiter',
      approvalStatus: 'APPROVED'
    },
    update: {
      companyId: company.id,
      designation: 'Campus Recruiter',
      approvalStatus: 'APPROVED'
    }
  });

  const internship = await upsertJob(company.id, {
    title: 'Frontend Developer Intern (Demo)',
    description: 'Work with a small product team to build accessible interfaces, improve existing React components, and learn through code reviews.',
    location: 'Remote',
    type: 'INTERNSHIP',
    salaryMin: 20000,
    salaryMax: 30000,
    deadline: new Date(`${currentYear + 1}-06-30T23:59:00.000Z`),
    eligibility: {
      branches: ['Computer Science', 'Information Technology'],
      graduationYears: [graduationYear],
      minCgpa: 7,
      skills: ['JavaScript']
    },
    isPublished: true,
    isArchived: false
  });

  await upsertJob(company.id, {
    title: 'Graduate Software Engineer (Demo)',
    description: 'Join the engineering team to build and maintain web services, collaborate with designers, and grow your software engineering skills.',
    location: 'Bengaluru / Hybrid',
    type: 'FULL_TIME',
    salaryMin: 600000,
    salaryMax: 900000,
    deadline: new Date(`${currentYear + 1}-08-31T23:59:00.000Z`),
    eligibility: {
      branches: ['Computer Science', 'Information Technology'],
      graduationYears: [graduationYear],
      minCgpa: 7.5,
      skills: ['JavaScript', 'SQL']
    },
    isPublished: true,
    isArchived: false
  });

  await prisma.application.upsert({
    where: { jobId_studentId: { jobId: internship.id, studentId: student.id } },
    create: {
      jobId: internship.id,
      studentId: student.id,
      status: 'APPLIED'
    },
    update: {}
  });

  console.log('Development demo data is ready.');
  console.log(`Demo accounts use the same local-only password: ${demoPassword}`);
  console.log('Student: student@campusconnect.example');
  console.log('Recruiter: recruiter@campusconnect.example');
  console.log('Placement Officer: officer@campusconnect.example');
  console.log('Alumni: alumni@campusconnect.example');
}

main()
  .catch((error) => {
    console.error('Unable to seed the development database.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
