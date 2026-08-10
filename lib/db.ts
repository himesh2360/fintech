import mongoose from "mongoose"
import dns from "dns"

try {
  dns.setDefaultResultOrder("ipv4first")
} catch {
  // ignore
}

const MONGODB_URI = process.env.MONGODB_URI || ""

function getDirectMongoUri(uri: string): string {
  if (!uri.startsWith("mongodb+srv://")) return uri

  const match = uri.match(/^mongodb\+srv:\/\/([^@]+)@([^/?]+)(\/[^?]*)?(\?.*)?$/)
  if (!match) return uri

  const [, auth, host, path = "/finsight"] = match
  const parts = host.split(".")
  const clusterPrefix = parts[0]
  const domain = parts.slice(1).join(".")

  if (!domain) return uri

  const shards = [
    `${clusterPrefix}-shard-00-00.${domain}:27017`,
    `${clusterPrefix}-shard-00-01.${domain}:27017`,
    `${clusterPrefix}-shard-00-02.${domain}:27017`,
  ].join(",")

  return `mongodb://${auth}@${shards}${path}?ssl=true&authSource=admin&retryWrites=true`
}

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var __mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global.__mongooseCache ?? { conn: null, promise: null }
global.__mongooseCache = cached

export async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error("Missing env var: MONGODB_URI")
  }
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"])
    } catch {
      // ignore
    }

    const primaryUri = MONGODB_URI
    const directFallbackUri = getDirectMongoUri(MONGODB_URI)

    cached.promise = mongoose
      .connect(primaryUri, {
        dbName: process.env.MONGODB_DB_NAME || "finsight",
        serverSelectionTimeoutMS: 4000,
      })
      .catch((err) => {
        if (
          err?.code === "ECONNREFUSED" ||
          err?.syscall === "querySrv" ||
          err?.message?.includes("querySrv") ||
          err?.message?.includes("ECONNREFUSED")
        ) {
          console.warn("[MongoDB] SRV DNS query blocked by network/ISP. Switching to direct shard connection...")
          return mongoose.connect(directFallbackUri, {
            dbName: process.env.MONGODB_DB_NAME || "finsight",
            serverSelectionTimeoutMS: 8000,
          })
        }
        throw err
      })
      .then((m) => m)
  }
  cached.conn = await cached.promise
  return cached.conn
}

export const connectToDatabase = dbConnect

