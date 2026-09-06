import { GoogleGenAI } from "@google/genai";

// Lazily constructed for the same reason as the Stripe/Resend clients
// (validating eagerly would throw while Next.js statically collects route
// data at build time, before runtime env vars are available).
let client: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!client) {
    // .trim() guards against a stray trailing newline/whitespace from
    // pasting the key into a dashboard env var field.
    client = new GoogleGenAI({
      apiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
    });
  }
  return client;
}

// "Nano Banana Pro" — Gemini's premium image model, per the product's own
// naming (see https://ai.google.dev/gemini-api/docs/nanobanana).
const IMAGE_MODEL = "gemini-3-pro-image";

const STYLE_PREFIX =
  "Editorial illustration in a warm, premium travel-magazine style. " +
  "Muted, sophisticated color palette with a hint of violet-purple. " +
  "No text, no words, no letters anywhere in the image.";

export interface GeneratedIllustration {
  data: Buffer;
  mimeType: string;
}

export async function generateIllustration(
  subject: string,
  aspectRatio: "4:3" | "3:2" = "4:3",
  stylePrefix: string = STYLE_PREFIX
): Promise<GeneratedIllustration> {
  const interaction = await getGemini().interactions.create({
    model: IMAGE_MODEL,
    input: `${stylePrefix} Scene: ${subject}`,
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: aspectRatio,
      image_size: "1K",
      // No `delivery` field: despite being in the SDK's types, the API
      // currently rejects any explicit value ("Image delivery mode is
      // not supported") — omitting it defaults to inline base64 data.
    },
  });

  const image = interaction.output_image;
  if (!image?.data) {
    throw new Error("Gemini did not return an image.");
  }

  return {
    data: Buffer.from(image.data, "base64"),
    mimeType: image.mime_type ?? "image/jpeg",
  };
}
