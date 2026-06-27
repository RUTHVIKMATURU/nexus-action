require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Mentor = require('../models/Mentor');
const InteractionLog = require('../models/InteractionLog');

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    console.log('Dropping existing collections...');
    try {
      await Student.collection.drop();
      console.log('Dropped students collection.');
    } catch (e) {
      console.log('Students collection does not exist, skipping drop.');
    }

    try {
      await Mentor.collection.drop();
      console.log('Dropped mentors collection.');
    } catch (e) {
      console.log('Mentors collection does not exist, skipping drop.');
    }

    try {
      await InteractionLog.collection.drop();
      console.log('Dropped interactionlogs collection.');
    } catch (e) {
      console.log('InteractionLogs collection does not exist, skipping drop.');
    }

    console.log('Seeding Junior Student profiles (35)...');
    const students = [];
    const skillsList = ['JavaScript', 'Python', 'React', 'Node.js', 'Machine Learning', 'Data Analysis', 'Java', 'C++'];
    const interestsList = ['Web Development', 'AI', 'Data Science', 'Cybersecurity', 'Mobile Apps', 'Cloud Computing'];

    for (let i = 1; i <= 35; i++) {
      students.push({
        name: `Junior Student ${i}`,
        email: `student${i}@example.com`,
        currentYear: 3, // Junior year
        skills: [skillsList[i % skillsList.length], skillsList[(i + 1) % skillsList.length]],
        interests: [interestsList[i % interestsList.length]]
      });
    }
    const insertedStudents = await Student.insertMany(students);
    console.log(`Inserted ${insertedStudents.length} students.`);

    console.log('Seeding Alumni Mentor profiles (15)...');
    const mentors = [];
    const roles = ['Software Engineer', 'Data Scientist', 'Product Manager', 'UX Designer', 'Engineering Manager'];
    const companies = ['TechCorp', 'InnovateLLC', 'DataSystems', 'WebWorks', 'CloudNet'];

    for (let i = 1; i <= 15; i++) {
      mentors.push({
        name: `Alumni Mentor ${i}`,
        email: `mentor${i}@example.com`,
        company: companies[i % companies.length],
        role: roles[i % roles.length],
        skills: [skillsList[(i + 2) % skillsList.length], skillsList[(i + 3) % skillsList.length]],
        availability: i % 3 !== 0 // 2/3rds are available
      });
    }
    const insertedMentors = await Mentor.insertMany(mentors);
    console.log(`Inserted ${insertedMentors.length} mentors.`);

    console.log('Seeding historical Interaction Logs (20)...');
    const interactionLogs = [];
    for (let i = 1; i <= 20; i++) {
      // Pick a random student for the log
      const studentIndex = i % insertedStudents.length;
      interactionLogs.push({
        studentId: insertedStudents[studentIndex]._id,
        summary: `Discussed career goals and reviewed resume with Mentor ${i % insertedMentors.length || 1}.`,
        status: i % 2 === 0 ? 'completed' : 'pending_review',
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // Past dates
      });
    }
    const insertedLogs = await InteractionLog.insertMany(interactionLogs);
    console.log(`Inserted ${insertedLogs.length} interaction logs.`);

    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    console.log('Closing database connection...');
    await mongoose.connection.close();
    console.log('Exiting process safely.');
    process.exit(0);
  }
}

seedDatabase();
