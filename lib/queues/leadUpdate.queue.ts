import { Queue } from "bullmq";
import { redis } from "../redis";

export const leadUpdateQueue = new Queue('lead-update', {
    connection: redis,
})