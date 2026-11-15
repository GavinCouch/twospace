import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { runtimeConfig } from "./config";
import { dataDirectory } from "./database";

const directory = join(dataDirectory, "media");
let s3: S3Client | undefined;
function s3Client() {
  return (s3 ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  }));
}
export function supabaseHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
  };
}
async function storageRequest(path: string, init: RequestInit = {}) {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(
    `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/${path}`,
    {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: {
        ...supabaseHeaders(key),
        ...(init.headers as Record<string, string> | undefined),
      },
    },
  );
}
function objectPath(key: string) {
  return `${encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET!)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
let readiness: Promise<void> | undefined;
export function objectStoreReady(): Promise<void> {
  return (readiness ??= (async () => {
    if (!runtimeConfig.cloud) return;
    if (runtimeConfig.objectStorage === "supabase") {
      const result = await storageRequest(
        `bucket/${encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET!)}`,
      );
      if (!result.ok)
        throw new Error(
          `The private storage bucket is unavailable (${result.status}).`,
        );
      const bucket = (await result.json()) as { public?: boolean };
      if (bucket.public !== false)
        throw new Error("The TwoSpace storage bucket must be private.");
    } else
      await s3Client().send(
        new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }),
      );
  })().catch((error) => {
    readiness = undefined;
    throw error;
  }));
}
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
) {
  await objectStoreReady();
  if (!runtimeConfig.cloud) {
    const path = join(directory, key);
    await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, body, { mode: 0o600, flag: "wx" });
    return;
  }
  if (runtimeConfig.objectStorage === "supabase") {
    const result = await storageRequest(`object/${objectPath(key)}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "false" },
      body: Uint8Array.from(body),
    });
    if (!result.ok)
      throw new Error(`The file could not be stored (${result.status}).`);
  } else
    await s3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }),
    );
}
export async function getObject(key: string): Promise<Buffer> {
  await objectStoreReady();
  if (!runtimeConfig.cloud) return readFile(join(directory, key));
  if (runtimeConfig.objectStorage === "supabase") {
    const result = await storageRequest(
      `object/authenticated/${objectPath(key)}`,
    );
    if (!result.ok)
      throw new Error(`The file could not be loaded (${result.status}).`);
    return Buffer.from(await result.arrayBuffer());
  }
  const result = await s3Client().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  if (!result.Body) throw new Error("The stored file is empty.");
  return Buffer.from(await result.Body.transformToByteArray());
}
export async function removeObject(key: string) {
  await objectStoreReady();
  if (!runtimeConfig.cloud) {
    try {
      await unlink(join(directory, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }
  if (runtimeConfig.objectStorage === "supabase") {
    const result = await storageRequest(
      `object/${encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET!)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [key] }),
      },
    );
    if (!result.ok)
      throw new Error(`The file could not be removed (${result.status}).`);
  } else
    await s3Client().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
}
