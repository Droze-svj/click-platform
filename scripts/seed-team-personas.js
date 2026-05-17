#!/usr/bin/env node
// Seed five personas as members of one shared Team — for testing the
// team-collaboration UI (roles, permissions, approval flow).
// Sibling: scripts/seed-test-users.js seeds five INDIVIDUAL niche personas
// for solo-flow testing.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const mongoose = require('mongoose');
const User = require('../server/models/User');
const Team = require('../server/models/Team');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/click';

async function seedUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const testUsers = [
      {
        email: 'ceo@click.app',
        password: 'ClickTeam2026!',
        name: 'Alex Mercer (CEO)',
        role: 'admin',
        niche: 'business',
        subscription: { status: 'active', plan: 'agency', startDate: new Date() },
        emailVerified: true
      },
      {
        email: 'marketing@click.app',
        password: 'ClickTeam2026!',
        name: 'Sarah Chen (Marketing)',
        role: 'user',
        niche: 'technology',
        subscription: { status: 'active', plan: 'pro', startDate: new Date() },
        emailVerified: true
      },
      {
        email: 'editor@click.app',
        password: 'ClickTeam2026!',
        name: 'Jordan Lee (Editor)',
        role: 'user',
        niche: 'entertainment',
        subscription: { status: 'active', plan: 'creator', startDate: new Date() },
        emailVerified: true
      },
      {
        email: 'creator@click.app',
        password: 'ClickTeam2026!',
        name: 'Emma Watson (Creator)',
        role: 'user',
        niche: 'lifestyle',
        subscription: { status: 'active', plan: 'creator', startDate: new Date() },
        emailVerified: true
      },
      {
        email: 'client@click.app',
        password: 'ClickTeam2026!',
        name: 'Michael Scott (Client)',
        role: 'user',
        niche: 'finance',
        subscription: { status: 'active', plan: 'free', startDate: new Date() },
        emailVerified: true
      }
    ];

    const savedUsers = [];

    for (let u of testUsers) {
      let existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists. Updating...`);
        existing.name = u.name;
        existing.role = u.role;
        existing.niche = u.niche;
        existing.subscription = u.subscription;
        existing.password = u.password; // pre-save will rehash
        await existing.save();
        savedUsers.push(existing);
      } else {
        console.log(`Creating user ${u.email}...`);
        const newUser = new User(u);
        await newUser.save();
        savedUsers.push(newUser);
      }
    }

    // Now let's create a Team
    const owner = savedUsers[0]; // CEO
    let team = await Team.findOne({ name: 'Click Alpha Team' });
    if (!team) {
      console.log('Creating team...');
      team = new Team({
        name: 'Click Alpha Team',
        description: 'Test environment team for Click marketing and editing',
        ownerId: owner._id.toString(),
        members: [
          { userId: owner._id.toString(), role: 'owner', permissions: { canCreate: true, canEdit: true, canDelete: true, canShare: true, canApprove: true } },
          { userId: savedUsers[1]._id.toString(), role: 'admin', permissions: { canCreate: true, canEdit: true, canDelete: false, canShare: true, canApprove: true } },
          { userId: savedUsers[2]._id.toString(), role: 'editor', permissions: { canCreate: true, canEdit: true, canDelete: false, canShare: false, canApprove: false } },
          { userId: savedUsers[4]._id.toString(), role: 'viewer', permissions: { canCreate: false, canEdit: false, canDelete: false, canShare: false, canApprove: true } },
        ]
      });
      await team.save();
    } else {
      console.log('Team already exists.');
    }

    console.log('\\n✅ Successfully seeded 5 test accounts and 1 team!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seedUsers();
