export const runtime = "nodejs";

import crypto from "crypto";

function hmac(key: Buffer | string, data: string) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function sha256(data: Buffer | string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function GET() {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  const bucket = process.env.R2_BUCKET_NAME!;

  const body = Buffer.from("hello signed r2");
  const key = "signed-test.txt";

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucket}/${key}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256(body);

  const canonicalRequest = [
    "PUT",
    `/${bucket}/${key}`,
    "",
    `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    "host;x-amz-content-sha256;x-amz-date",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateStamp}/auto/s3/aws4_request`,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/auto/s3/aws4_request, ` +
    `SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;

  const res = await fetch(url, {
    method: "PUT",
    body,
    headers: {
      Host: host,
      "Content-Type": "text/plain",
      "Content-Length": body.length.toString(),
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
  });

  return new Response(
    JSON.stringify({ ok: res.ok, status: res.status }),
    { status: 200 }
  );
}
