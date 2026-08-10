#!/usr/bin/env node

/**
 * Database initialization and management script
 * Usage: node scripts/db-init.js [command] [options]
 *
 * Commands:
 *   seed            - Seed demo data
 *   reset           - Clear all collections
 *   create-user     - Create a new user interactively
 *   list-users      - List all users
 *   delete-user     - Delete a user by email
 */

const mongoose = require('mongoose')
require('dotenv').config({ path: '.env.local' })

// Models
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: 'INR' },
    cashBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    creditBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    type: { type: String, required: true, enum: ['income', 'expense'] },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, default: 'Other' },
    merchant: { type: String, default: '' },
    note: { type: String, default: '' },
    occurredAt: { type: Date, required: true, index: true },
    tags: [{ type: String }],
  },
  { timestamps: true }
)

const budgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    month: { type: String, required: true, index: true },
    totalBudget: { type: Number, required: true, default: 0, min: 0 },
    categoryBudgets: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
)

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    title: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, required: true, min: 0, default: 0 },
    deadline: { type: Date },
    status: { type: String, required: true, enum: ['active', 'completed', 'paused'], default: 'active' },
  },
  { timestamps: true }
)

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    severity: { type: String, required: true, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    kind: { type: String, required: true, default: 'system' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const User = mongoose.model('User', userSchema)
const Transaction = mongoose.model('Transaction', transactionSchema)
const Budget = mongoose.model('Budget', budgetSchema)
const Goal = mongoose.model('Goal', goalSchema)
const Notification = mongoose.model('Notification', notificationSchema)

// Utilities
async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/finsight'
  const dbName = process.env.MONGODB_DB_NAME || 'finsight'

  try {
    await mongoose.connect(uri, { dbName })
    console.log('✓ Connected to MongoDB')
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error.message)
    process.exit(1)
  }
}

async function disconnect() {
  await mongoose.disconnect()
  console.log('✓ Disconnected from MongoDB')
}

async function hashPassword(password) {
  const bcrypt = require('bcryptjs')
  return await bcrypt.hash(password, 12)
}

// Commands
async function seedDemo() {
  console.log('\n📊 Seeding DEMO ACCOUNT ONLY (demo@finsight.app persona)...')

  const email = (process.env.DEMO_EMAIL || 'demo@finsight.app').toLowerCase()
  const password = process.env.DEMO_PASSWORD || 'demo12345'
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Matches lib/demo-seed.ts — never used for real signups
  const DEMO_PERSONA = {
    name: 'Rahul Sharma',
    monthlyIncome: 75000,
    monthlyExpenses: 48000,
    totalBudget: 50000,
    cashBalance: 420000,
    investments: 358500,
    creditLimit: 300000,
    creditBalance: 105000,
    highInterestDebt: 105000,
    savingsYieldPct: 6.5,
    debtInterestPct: 14,
    emergencyMonthsTarget: 6,
  }

  try {
    let user = await User.findOne({ email })
    const passwordHash = await hashPassword(password)
    if (!user) {
      user = await User.create({
        email,
        passwordHash,
        currency: 'INR',
        ...DEMO_PERSONA,
      })
      console.log(`✓ Created demo user: ${email}`)
    } else {
      await User.findByIdAndUpdate(user._id, {
        $set: { passwordHash, currency: 'INR', ...DEMO_PERSONA },
      })
      console.log(`✓ Refreshed demo user persona: ${email}`)
    }

    // Replace demo-only ledger (do not touch other users)
    await Promise.all([
      Transaction.deleteMany({ userId: user._id }),
      Budget.deleteMany({ userId: user._id }),
      Goal.deleteMany({ userId: user._id }),
      Notification.deleteMany({ userId: user._id }),
    ])

    await Budget.create({
      userId: user._id,
      month,
      totalBudget: DEMO_PERSONA.totalBudget,
      categoryBudgets: {
        'Utilities & Rent': 20000,
        'Food & Dining': 8000,
        EMI: 10000,
        Shopping: 7000,
        Transport: 5000,
      },
    })

    await Goal.insertMany([
      {
        userId: user._id,
        title: 'Emergency Fund',
        targetAmount: 288000,
        currentAmount: 288000,
        status: 'active',
      },
      {
        userId: user._id,
        title: 'Goa Vacation',
        targetAmount: 60000,
        currentAmount: 18000,
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
        status: 'active',
      },
    ])

    await Transaction.insertMany([
      {
        userId: user._id,
        type: 'expense',
        amount: 18500,
        category: 'Utilities & Rent',
        merchant: 'Brigade Residency Rent',
        note: 'Monthly apartment rent',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0),
      },
      {
        userId: user._id,
        type: 'expense',
        amount: 4200,
        category: 'Food & Dining',
        merchant: 'Swiggy & Zomato',
        note: 'Food delivery & weekend dining',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 20, 0, 0),
      },
      {
        userId: user._id,
        type: 'expense',
        amount: 8500,
        category: 'EMI',
        merchant: 'HDFC Credit Card EMI',
        note: 'Electronics purchase EMI',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 10, 0, 0),
      },
      {
        userId: user._id,
        type: 'expense',
        amount: 6800,
        category: 'Shopping',
        merchant: 'Amazon India',
        note: 'Office accessories',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8, 15, 0, 0),
      },
      {
        userId: user._id,
        type: 'income',
        amount: 75000,
        category: 'Income',
        merchant: 'Tech Corp Salary',
        note: 'Monthly salary payout',
        occurredAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 9, 0, 0),
      },
    ])

    console.log('\n✅ Demo account seeded (Rahul Bangalore persona). Real users stay empty.\n')
    console.log(`Login credentials:`)
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}\n`)
  } catch (error) {
    console.error('✗ Error seeding demo data:', error.message)
    throw error
  }
}

async function resetDatabase() {
  console.log('\n🗑️  Resetting database...')
  try {
    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      Budget.deleteMany({}),
      Goal.deleteMany({}),
      Notification.deleteMany({}),
    ])
    console.log('✅ Database cleared successfully!\n')
  } catch (error) {
    console.error('✗ Error resetting database:', error.message)
    throw error
  }
}

async function listUsers() {
  console.log('\n👥 Users in database:\n')
  try {
    const users = await User.find({}, 'name email currency createdAt').sort({ createdAt: -1 })
    if (users.length === 0) {
      console.log('No users found\n')
      return
    }
    console.table(
      users.map((u) => ({
        Name: u.name,
        Email: u.email,
        Currency: u.currency,
        'Created At': new Date(u.createdAt).toLocaleDateString(),
      }))
    )
    console.log(`\nTotal: ${users.length} user(s)\n`)
  } catch (error) {
    console.error('✗ Error listing users:', error.message)
    throw error
  }
}

async function createUser(email, password, name) {
  console.log('\n➕ Creating new user...')
  try {
    // Check if email exists
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing) {
      console.error(`✗ User with email "${email}" already exists\n`)
      return
    }

    const passwordHash = await hashPassword(password)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      currency: 'INR',
      cashBalance: 0,
      creditLimit: 0,
      creditBalance: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      totalBudget: 0,
      investments: 0,
      highInterestDebt: 0,
    })

    console.log(`✅ User created successfully!\n`)
    console.log(`  ID: ${user._id}`)
    console.log(`  Name: ${user.name}`)
    console.log(`  Email: ${user.email}\n`)
  } catch (error) {
    console.error('✗ Error creating user:', error.message)
    throw error
  }
}

async function deleteUser(email) {
  console.log(`\n🗑️  Deleting user: ${email}`)
  try {
    const result = await User.deleteOne({ email: email.toLowerCase() })
    if (result.deletedCount === 0) {
      console.error(`✗ User "${email}" not found\n`)
      return
    }

    // Also delete related data
    const user = await User.findOne({ email: email.toLowerCase() })
    if (user) {
      await Promise.all([
        Transaction.deleteMany({ userId: user._id }),
        Budget.deleteMany({ userId: user._id }),
        Goal.deleteMany({ userId: user._id }),
        Notification.deleteMany({ userId: user._id }),
      ])
    }

    console.log(`✅ User and related data deleted successfully!\n`)
  } catch (error) {
    console.error('✗ Error deleting user:', error.message)
    throw error
  }
}

// Main
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  await connect()

  try {
    switch (command) {
      case 'seed':
        await seedDemo()
        break
      case 'reset':
        await resetDatabase()
        break
      case 'list-users':
        await listUsers()
        break
      case 'create-user':
        if (args.length < 4) {
          console.error('\nUsage: node scripts/db-init.js create-user <email> <password> <name>')
          console.error('Example: node scripts/db-init.js create-user john@example.com password123 "John Doe"\n')
          process.exit(1)
        }
        await createUser(args[1], args[2], args[3])
        break
      case 'delete-user':
        if (args.length < 2) {
          console.error('\nUsage: node scripts/db-init.js delete-user <email>\n')
          process.exit(1)
        }
        await deleteUser(args[1])
        break
      default:
        console.log(`
📚 Database Management Script

Usage: node scripts/db-init.js [command] [options]

Commands:
  seed                          Seed demo data
  reset                         Clear all collections
  list-users                    List all users
  create-user <email> <pwd> <name>   Create new user
  delete-user <email>          Delete user by email

Examples:
  node scripts/db-init.js seed
  node scripts/db-init.js create-user john@example.com mypassword "John Doe"
  node scripts/db-init.js list-users
  node scripts/db-init.js delete-user john@example.com
        `)
    }
  } finally {
    await disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message)
  process.exit(1)
})
