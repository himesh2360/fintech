import { Schema, model, models, type InferSchemaType } from "mongoose"

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },

    currency: { type: String, default: "INR" },
    cashBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 0 },
    creditBalance: { type: Number, default: 0 },

    // Financial snapshot / persona values (used by demo seed + financial context)
    monthlyIncome: { type: Number, default: 0 },
    monthlyExpenses: { type: Number, default: 0 },
    totalBudget: { type: Number, default: 0 },
    investments: { type: Number, default: 0 },
    highInterestDebt: { type: Number, default: 0 },

    // Financial decision preferences
    savingsYieldPct: { type: Number, default: 6.5 },
    debtInterestPct: { type: Number, default: 9.0 },
    emergencyMonthsTarget: { type: Number, default: 6 },
  },
  { timestamps: true }
)

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string }

export const User = models.User || model("User", UserSchema)

