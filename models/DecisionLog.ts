import mongoose, { Document, Schema, Model } from "mongoose"

export interface IDecisionLog extends Document {
  userId: mongoose.Types.ObjectId
  decisionType: "purchase" | "emi" | "sip_increase" | "relocation" | "debt_payoff"
  title: string
  amount: number
  predictedScoreDelta: number
  predictedCashBuffer: number
  predictedEmergencyMonths: number
  actualCashBuffer?: number
  accuracyPct?: number
  status: "active" | "verified" | "dismissed"
  verifiedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const DecisionLogSchema = new Schema<IDecisionLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    decisionType: {
      type: String,
      enum: ["purchase", "emi", "sip_increase", "relocation", "debt_payoff"],
      required: true,
    },
    title: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
    predictedScoreDelta: { type: Number, default: 0 },
    predictedCashBuffer: { type: Number, default: 0 },
    predictedEmergencyMonths: { type: Number, default: 0 },
    actualCashBuffer: { type: Number },
    accuracyPct: { type: Number },
    status: {
      type: String,
      enum: ["active", "verified", "dismissed"],
      default: "active",
      index: true,
    },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
)

export const DecisionLog: Model<IDecisionLog> =
  mongoose.models.DecisionLog || mongoose.model<IDecisionLog>("DecisionLog", DecisionLogSchema)
