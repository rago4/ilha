import ilha from "ilha";
import { z } from "zod";

const LocationSchema = z.custom<Location>(
  (val) => typeof val === "object" && val !== null && "href" in val,
);

export const RouteParamsSchema = z.object({
  location: LocationSchema,
});

export type RouteParams = z.infer<typeof RouteParamsSchema>;
