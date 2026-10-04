import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();
type ElevenLabsOptions = Parameters<ReplitConnectors["proxy"]>[2];

export class ElevenLabsError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`ElevenLabs request failed with status ${status}`);
    this.name = "ElevenLabsError";
  }
}

function readProviderErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (detail && typeof detail === "object") {
    const status = (detail as Record<string, unknown>).status;
    if (typeof status === "string") return status;
  }
  if (typeof record.code === "string") return record.code;
  return undefined;
}

export async function elevenLabsRequest(
  path: string,
  options: ElevenLabsOptions = {},
): Promise<Response> {
  const response = await connectors.proxy("elevenlabs", path, options);
  if (!response.ok) {
    const body = await response
      .clone()
      .json()
      .catch((): unknown => undefined);
    throw new ElevenLabsError(
      response.status,
      readProviderErrorCode(body),
    );
  }
  return response;
}

export async function getElevenLabsJson<T>(path: string): Promise<T> {
  const response = await elevenLabsRequest(path, { method: "GET" });
  return (await response.json()) as T;
}