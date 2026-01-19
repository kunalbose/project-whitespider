import { Worker } from "bullmq";
import { redis } from "../lib/redis";

const BATCH_SIZE = 100

new Worker(
    'lead-update',
    async job => {
        console.log("Processing job", job.id)
    },
    {
        connection: redis,
        concurrency: 1,
        limiter: {
            max: 100,
            duration: 60_000,
        },
    }
)
