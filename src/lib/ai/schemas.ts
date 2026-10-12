// Zod schemas for everything Gemini returns (treated as untrusted input) plus the matching
// Gemini responseSchema objects so the model is steered to the same shape.
import { Type } from "@google/genai";
import { z } from "zod";

export const PLACEMENTS = ["host_read", "pre_roll", "mid_roll", "post_roll", "description_link", "on_screen", "unknown"] as const;

const clampWords = (max: number) => (s: string) => s.trim().split(/\s+/).slice(0, max).join(" ");
const str = (max: number) => z.string().transform((s) => s.trim().slice(0, max));
const nullableStr = (max: number) => z.string().nullable().optional().transform((s) => (s ? s.trim().slice(0, max) || null : null));

export const ExtractionResult = z.object({
  guests: z
    .array(
      z.object({
        name: str(120).refine((s) => s.length > 0, "empty name"),
        title_or_company: nullableStr(160),
        role: z.enum(["guest", "host"]).default("guest"),
        confidence: z.coerce.number().min(0).max(1).catch(0.5),
      }),
    )
    .max(12)
    .default([]),
  topics: z
    .array(
      z.object({
        label: str(60).refine((s) => s.length > 0, "empty label"),
        weight: z.coerce.number().min(0).max(1).catch(0.2),
      }),
    )
    .max(8)
    .default([]),
  sponsors: z
    .array(
      z.object({
        name: str(80).refine((s) => s.length > 0, "empty name"),
        product: nullableStr(100),
        placement: z.enum(PLACEMENTS).catch("unknown"),
        evidence: z.string().transform(clampWords(25)),
        timestamp_seconds: z.coerce.number().int().min(0).max(86_400).nullable().optional().catch(null).transform((n) => n ?? null),
        source: z.enum(["video", "description"]).catch("description"),
      }),
    )
    .max(12)
    .default([]),
  summary: z.string().default("").transform(clampWords(60)),
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;

export const extractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    guests: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          title_or_company: { type: Type.STRING, nullable: true },
          role: { type: Type.STRING, enum: ["guest", "host"] },
          confidence: { type: Type.NUMBER },
        },
        required: ["name", "role", "confidence"],
      },
    },
    topics: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, weight: { type: Type.NUMBER } }, required: ["label", "weight"] },
    },
    sponsors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          product: { type: Type.STRING, nullable: true },
          placement: { type: Type.STRING, enum: [...PLACEMENTS] },
          evidence: { type: Type.STRING },
          timestamp_seconds: { type: Type.NUMBER, nullable: true },
          source: { type: Type.STRING, enum: ["video", "description"] },
        },
        required: ["name", "placement", "evidence", "source"],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ["guests", "topics", "sponsors", "summary"],
};

/* ------------------------------ weekly consolidation ------------------------------ */

/** "Which of these refer to the same entity?" Groups of ids; the first id in a group is kept. */
export const MergeGroups = z.object({
  groups: z
    .array(z.object({ keep: z.string(), merge: z.array(z.string()).min(1), confident: z.boolean().default(false) }))
    .default([]),
});
export type MergeGroups = z.infer<typeof MergeGroups>;

export const mergeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    groups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { keep: { type: Type.STRING }, merge: { type: Type.ARRAY, items: { type: Type.STRING } }, confident: { type: Type.BOOLEAN } },
        required: ["keep", "merge", "confident"],
      },
    },
  },
  required: ["groups"],
};

/** Map each new topic label to an existing canonical topic id, or null if it is genuinely new. */
export const TopicMapping = z.object({
  mappings: z.array(z.object({ id: z.string(), maps_to: z.string().nullable().optional().transform((v) => v ?? null) })).default([]),
});
export type TopicMapping = z.infer<typeof TopicMapping>;

export const topicMappingResponseSchema = {
  type: Type.OBJECT,
  properties: {
    mappings: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, maps_to: { type: Type.STRING, nullable: true } }, required: ["id"] },
    },
  },
  required: ["mappings"],
};

/* ------------------------------ narrative ------------------------------ */

export const Narrative = z.object({
  bullets: z.array(z.string().min(5).max(400)).max(6).default([]),
  angles: z.array(z.object({ topic_id: z.string(), angle: z.string().min(5).max(300) })).default([]),
});
export type Narrative = z.infer<typeof Narrative>;

export const narrativeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
    angles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { topic_id: { type: Type.STRING }, angle: { type: Type.STRING } }, required: ["topic_id", "angle"] } },
  },
  required: ["bullets", "angles"],
};
