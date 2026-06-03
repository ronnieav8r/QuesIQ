import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function isInterviewStorageConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL,
  );
}

function getInterviewStorageClient() {
  return new S3Client({
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
  });
}

export async function uploadInterviewAudio(key: string, buffer: Buffer) {
  const client = getInterviewStorageClient();
  await client.send(
    new PutObjectCommand({
      Body: buffer,
      Bucket: process.env.R2_BUCKET_NAME!,
      ContentType: "audio/mpeg",
      Key: key,
    }),
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
