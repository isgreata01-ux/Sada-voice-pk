import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();
type ElevenLabsOptions = Parameters<ReplitConnectors["proxy"]>[2];

export class ElevenLabsError extends Error {
  constructor(readonly status: number) {
    super(`ElevenLabs request failed with status ${status}`);
    this.name = "ElevenLabsError";
  }
}

export async function elevenLabsRequest(
  path: string,
  options: ElevenLabsOptions = {},
): Promise<Response> {
  const response = await connectors.proxy("elevenlabs", path, options);
  if (!response.ok) throw new ElevenLabsError(response.status);
  return response;
}

export async function getElevenLabsJson<T>(path: string): Promise<T> {
  const response = await elevenLabsRequest(path, { method: "GET" });
  return (await response.json()) as T;
}