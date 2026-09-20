import { z } from "zod";
import { TOPICS } from "./envelope.js";

export const userCreatedSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type UserCreated = z.infer<typeof userCreatedSchema>;

export const userUpdatedSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  displayName: z.string().min(1).optional(),
  updatedAt: z.string().datetime(),
});
export type UserUpdated = z.infer<typeof userUpdatedSchema>;

export const userEventType = z.enum(["user.created", "user.updated"]);

export const userEventPayload = {
  "user.created": userCreatedSchema,
  "user.updated": userUpdatedSchema,
} as const;

export const userTopic = TOPICS.userEvents;
