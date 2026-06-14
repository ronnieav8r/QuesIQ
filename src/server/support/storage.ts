import { createHash, randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_SUPPORT_ATTACHMENT_BYTES = 1_500_000;

export function isSupportStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL,
  );
}

function getSupportStorageClient() {
  return new S3Client({
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
  });
}

function extensionForMimeType(mimeType?: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

export function supportAttachmentFromDataUrl(dataUrl?: string) {
  if (!dataUrl) {
    return undefined;
  }

  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Support attachment must be a base64 data URL.");
  }

  const buffer = Buffer.from(match[2] ?? "", "base64");
  if (buffer.length === 0 || buffer.length > MAX_SUPPORT_ATTACHMENT_BYTES) {
    throw new Error("Support attachment is empty or too large.");
  }

  return {
    buffer,
    checksum: createHash("sha256").update(buffer).digest("hex"),
    mimeType: match[1] ?? "image/png",
    size: buffer.length,
  };
}

export async function uploadSupportAttachment(input: {
  buffer: Buffer;
  conversationId: string;
  fileName?: string;
  kind?: "file" | "screenshot";
  mimeType?: string;
}) {
  const extension = extensionForMimeType(input.mimeType);
  const key = `support/${input.conversationId}/${Date.now()}-${randomUUID()}.${extension}`;
  const client = getSupportStorageClient();

  await client.send(
    new PutObjectCommand({
      Body: input.buffer,
      Bucket: process.env.R2_BUCKET_NAME!,
      ContentType: input.mimeType ?? "image/png",
      Key: key,
      Metadata: {
        fileName: input.fileName?.slice(0, 180) ?? `${input.kind ?? "attachment"}.${extension}`,
        kind: input.kind ?? "screenshot",
      },
    }),
  );

  return {
    key,
    url: `${process.env.R2_PUBLIC_URL}/${key}`,
  };
}
