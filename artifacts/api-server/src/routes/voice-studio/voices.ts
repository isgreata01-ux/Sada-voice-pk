import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  CloneVoiceBody,
  CloneVoiceResponse,
  DeleteVoiceParams,
  GenerateSpeechBody,
  GenerateSpeechResponse,
  ListVoiceModelsResponse,
  ListVoicesResponse,
} from "@workspace/api-zod";
import {
  db,
  voiceStudioEventsTable,
  voiceStudioUsersTable,
  voiceStudioVoicesTable,
} from "@workspace/db";
import { getSignedInAccount } from "./auth";
import { elevenLabsRequest, getElevenLabsJson, ElevenLabsError } from "../../lib/elevenLabs";
import {
  calculateSpeechTokens,
  measureMp3DurationSeconds,
} from "../../lib/speechBilling";

const router: IRouter = Router();

type ProviderVoice = {
  voice_id: string;
  name: string;
  description?: string | null;
  category?: string;
  preview_url?: string | null;
};

type ProviderModel = {
  model_id: string;
  name: string;
  description?: string;
  can_do_text_to_speech?: boolean;
};

function normalizeProviderModels(payload: unknown): ProviderModel[] | null {
  if (Array.isArray(payload)) return payload as ProviderModel[];
  if (!payload || typeof payload !== "object") return null;
  const models = (payload as { models?: unknown }).models;
  return Array.isArray(models) ? (models as ProviderModel[]) : null;
}

function respondProviderError(
  req: Request,
  res: Response,
  error: unknown,
  action: string,
): void {
  if (error instanceof ElevenLabsError) {
    req.log.warn(
      { status: error.status, code: error.code },
      `ElevenLabs ${action} failed`,
    );
    res.status(502).json({
      error:
        error.code === "missing_permissions"
          ? `The connected ElevenLabs API key is missing permission for ${action}. Update its endpoint access in ElevenLabs, then update the existing Replit connection.`
          : "The voice service could not complete that request. Please try again.",
    });
    return;
  }
  throw error;
}

router.get("/voice-studio/voices", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account) return;

  try {
    const data = await getElevenLabsJson<{ voices?: ProviderVoice[] }>(
      "/v1/voices",
    );
    const appClones = await db
      .select({
        voiceId: voiceStudioVoicesTable.voiceId,
        ownerId: voiceStudioVoicesTable.ownerId,
      })
      .from(voiceStudioVoicesTable);
    const clonesById = new Map(
      appClones.map((voice) => [voice.voiceId, voice.ownerId]),
    );
    const voices = (data.voices ?? [])
      .filter((voice) => {
        const isAppClone = clonesById.has(voice.voice_id);
        const ownerId = clonesById.get(voice.voice_id);
        return (
          !isAppClone ||
          account.role === "admin" ||
          ownerId === account.id
        );
      })
      .map((voice) => {
        const isAppClone = clonesById.has(voice.voice_id);
        return {
          voiceId: voice.voice_id,
          name: voice.name,
          description: voice.description ?? null,
          category: isAppClone
            ? "Cloned voice"
            : voice.category ?? "voice",
          previewUrl: voice.preview_url ?? null,
          isAppClone,
        };
      });
    res.json(ListVoicesResponse.parse(voices));
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      respondProviderError(req, res, error, "voice listing");
      return;
    }
    throw error;
  }
});

router.get("/voice-studio/models", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account) return;

  try {
    const payload = await getElevenLabsJson<unknown>("/v1/models");
    const models = normalizeProviderModels(payload);
    if (!models) {
      req.log.warn(
        { responseShape: Array.isArray(payload) ? "array" : typeof payload },
        "ElevenLabs returned an unsupported model list response",
      );
      res.status(502).json({
        error: "The voice service returned an unsupported model list.",
      });
      return;
    }
    const response = models
      .filter((model) => model.can_do_text_to_speech)
      .map((model) => ({
        modelId: model.model_id,
        name: model.name,
        description: model.description ?? "Text-to-speech model",
      }));
    res.json(ListVoiceModelsResponse.parse(response));
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      respondProviderError(req, res, error, "model listing");
      return;
    }
    throw error;
  }
});

router.delete(
  "/voice-studio/voices/:voiceId",
  async (req, res): Promise<void> => {
    const account = await getSignedInAccount(req, res);
    if (!account) return;

    const params = DeleteVoiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [voice] = await db
      .select()
      .from(voiceStudioVoicesTable)
      .where(eq(voiceStudioVoicesTable.voiceId, params.data.voiceId))
      .limit(1);
    if (!voice) {
      res.status(404).json({ error: "Cloned voice not found." });
      return;
    }
    if (account.role !== "admin" && voice.ownerId !== account.id) {
      res.status(403).json({
        error: "You can only remove cloned voices you own.",
      });
      return;
    }

    try {
      await elevenLabsRequest(
        `/v1/voices/${encodeURIComponent(voice.voiceId)}`,
        { method: "DELETE" },
      );
    } catch (error) {
      if (!(error instanceof ElevenLabsError && error.status === 404)) {
        if (error instanceof ElevenLabsError) {
          respondProviderError(req, res, error, "voice deletion");
          return;
        }
        throw error;
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(voiceStudioVoicesTable)
        .where(eq(voiceStudioVoicesTable.voiceId, voice.voiceId));
      await tx.insert(voiceStudioEventsTable).values({
        accountId: voice.ownerId ?? account.id,
        actorClerkUserId: getAuth(req).userId ?? null,
        eventType: "voice_deleted",
        description: `Deleted the cloned voice “${voice.name}”`,
      });
    });
    res.sendStatus(204);
  },
);

router.post("/voice-studio/voices/clone", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account) return;

  const parsed = CloneVoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.consentAcknowledged !== true) {
    res.status(400).json({
      error: "Confirm that you have permission to clone this voice.",
    });
    return;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(parsed.data.audioBase64)) {
    res.status(400).json({ error: "The uploaded audio file is invalid." });
    return;
  }

  const audio = Buffer.from(parsed.data.audioBase64, "base64");
  if (audio.length < 750 || audio.length > 11 * 1024 * 1024) {
    res.status(400).json({
      error: "Use an audio file between 750 bytes and 11 MB.",
    });
    return;
  }

  try {
    const formData = new FormData();
    formData.set("name", parsed.data.name);
    if (parsed.data.description) {
      formData.set("description", parsed.data.description);
    }
    const fileBytes = Uint8Array.from(audio);
    formData.append(
      "files",
      new Blob([fileBytes], { type: parsed.data.mimeType }),
      parsed.data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_"),
    );

    const response = await elevenLabsRequest("/v1/voices/add", {
      method: "POST",
      body: formData,
    });
    const created = (await response.json()) as { voice_id?: string };
    if (!created.voice_id) {
      req.log.error("ElevenLabs returned a clone response without a voice ID");
      res.status(502).json({ error: "The cloned voice could not be saved." });
      return;
    }

    const [voice] = await db
      .insert(voiceStudioVoicesTable)
      .values({
        voiceId: created.voice_id,
        ownerId: account.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        category: "cloned",
      })
      .onConflictDoUpdate({
        target: voiceStudioVoicesTable.voiceId,
        set: {
          ownerId: account.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
        },
      })
      .returning();

    await db.insert(voiceStudioEventsTable).values({
      accountId: account.id,
      actorClerkUserId: getAuth(req).userId ?? null,
      eventType: "voice_cloned",
      description: `Created the cloned voice “${voice.name}”`,
    });

    res.status(201).json(
      CloneVoiceResponse.parse({
        voiceId: voice.voiceId,
        name: voice.name,
        description: voice.description,
        category: voice.category,
        previewUrl: voice.previewUrl,
        isAppClone: true,
      }),
    );
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      respondProviderError(req, res, error, "voice cloning");
      return;
    }
    throw error;
  }
});

router.post("/voice-studio/speech", async (req, res): Promise<void> => {
  const account = await getSignedInAccount(req, res);
  if (!account) return;

  const parsed = GenerateSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const charactersUsed = Array.from(parsed.data.text).length;
  if (account.role !== "admin" && account.tokenBalance < 1) {
    res.status(402).json({
      error: "There are no tokens available. Ask an administrator to add tokens.",
    });
    return;
  }

  try {
    const [voices, modelPayload] = await Promise.all([
      getElevenLabsJson<{ voices?: ProviderVoice[] }>("/v1/voices"),
      getElevenLabsJson<unknown>("/v1/models"),
    ]);
    const models = normalizeProviderModels(modelPayload);
    if (!models) {
      req.log.warn("ElevenLabs returned an unsupported model list response");
      res.status(502).json({
        error: "The voice service returned an unsupported model list.",
      });
      return;
    }
    const voice = (voices.voices ?? []).find(
      (item) => item.voice_id === parsed.data.voiceId,
    );
    const [appClone] = await db
      .select({ ownerId: voiceStudioVoicesTable.ownerId })
      .from(voiceStudioVoicesTable)
      .where(eq(voiceStudioVoicesTable.voiceId, parsed.data.voiceId))
      .limit(1);
    const model = models.find(
      (item) =>
        item.model_id === parsed.data.modelId &&
        item.can_do_text_to_speech === true,
    );
    const canUseVoice =
      !appClone ||
      account.role === "admin" ||
      appClone.ownerId === account.id;
    if (!voice || !model || !canUseVoice) {
      res.status(400).json({
        error: "Choose a voice and speech model available to this account.",
      });
      return;
    }

    const audioResponse = await elevenLabsRequest(
      `/v1/text-to-speech/${encodeURIComponent(parsed.data.voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: parsed.data.modelId,
          voice_settings: {
            stability: parsed.data.stability,
            similarity_boost: parsed.data.similarityBoost,
            style: parsed.data.style,
            use_speaker_boost: parsed.data.useSpeakerBoost,
          },
        }),
      },
    );

    const audioBytes = Buffer.from(await audioResponse.arrayBuffer());
    if (audioBytes.length === 0 || audioBytes.length > 20 * 1024 * 1024) {
      throw new Error("Generated audio exceeded the supported file size.");
    }

    let durationSeconds: number;
    try {
      durationSeconds = await measureMp3DurationSeconds(audioBytes);
    } catch (error) {
      req.log.error({ err: error }, "Could not measure generated audio duration");
      res.status(502).json({
        error:
          "The generated audio duration could not be verified, so no tokens were charged. Please try again.",
      });
      return;
    }
    const calculatedTokens = calculateSpeechTokens(durationSeconds);
    const tokensUsed = account.role === "admin" ? 0 : calculatedTokens;
    const billing = await db.transaction(async (tx) => {
      if (account.role === "admin") {
        await tx.insert(voiceStudioEventsTable).values({
          accountId: account.id,
          actorClerkUserId: getAuth(req).userId ?? null,
          eventType: "speech_generation",
          description: `Generated ${durationSeconds.toFixed(1)} seconds with “${voice.name}” using administrator unlimited access`,
          tokenDelta: 0,
        });
        return { remainingTokens: null as number | null };
      }

      const [updated] = await tx
        .update(voiceStudioUsersTable)
        .set({
          tokenBalance: sql`${voiceStudioUsersTable.tokenBalance} - ${calculatedTokens}`,
        })
        .where(
          and(
            eq(voiceStudioUsersTable.id, account.id),
            gte(voiceStudioUsersTable.tokenBalance, calculatedTokens),
          ),
        )
        .returning({ tokenBalance: voiceStudioUsersTable.tokenBalance });
      if (!updated) return null;

      await tx.insert(voiceStudioEventsTable).values({
        accountId: account.id,
        actorClerkUserId: getAuth(req).userId ?? null,
        eventType: "speech_generation",
        description: `Generated ${durationSeconds.toFixed(1)} seconds (${calculatedTokens} tokens) with “${voice.name}”`,
        tokenDelta: -calculatedTokens,
      });
      return { remainingTokens: updated.tokenBalance };
    });

    if (!billing) {
      res.status(402).json({
        error:
          "There are not enough tokens for this audio. No tokens were charged.",
      });
      return;
    }

    res.json(
      GenerateSpeechResponse.parse({
        audioBase64: audioBytes.toString("base64"),
        mimeType: "audio/mpeg",
        fileName: `voice-studio-${Date.now()}.mp3`,
        charactersUsed,
        durationSeconds,
        tokensUsed,
        remainingTokens: billing.remainingTokens,
      }),
    );
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      respondProviderError(req, res, error, "speech generation");
      return;
    }
    throw error;
  }
});

export default router;