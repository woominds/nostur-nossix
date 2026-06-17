/* =========================================================
   NOSSIX / NOSTUR — Audio Transcode
   Convierte audios grabados por navegador/Electron a MP3
   compatible con WhatsApp Cloud API.

   Entrada típica:
   - audio/webm
   - audio/webm;codecs=opus
   - audio/mp4
   - audio/aac

   Salida:
   - audio/mpeg
   - mono
   - 44.1 kHz
   - 96 kbps
========================================================= */

import { Mp3Encoder } from "@breezystack/lamejs";

const TARGET_SAMPLE_RATE = 44100;
const TARGET_BITRATE_KBPS = 96;

export type AudioTranscodeResult = {
  file: File;
  originalType: string;
  outputType: "audio/mpeg";
  converted: boolean;
};

const WHATSAPP_ACCEPTED_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/amr",
  "audio/ogg",
  "audio/opus"
]);

function normalizeMimeType(value?: string | null): string {
  return String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function getBaseName(filename: string): string {
  const clean = filename.trim() || `audio-${Date.now()}`;
  const lastDot = clean.lastIndexOf(".");

  if (lastDot <= 0) return clean;

  return clean.slice(0, lastDot);
}

function isWhatsappAcceptedAudio(file: File): boolean {
  const type = normalizeMimeType(file.type);

  return WHATSAPP_ACCEPTED_AUDIO_TYPES.has(type);
}

function shouldTranscodeAudio(file: File): boolean {
  const type = normalizeMimeType(file.type);

  if (!type) return true;

  if (type === "audio/webm") return true;

  /*
    Aunque Meta lista audio/mp4 y audio/aac como soportados,
    en la práctica puede rechazar algunos audios grabados por Safari/iOS
    por códec/canales/sample rate. Para estabilidad, normalizamos MP4/AAC.
  */
  if (type === "audio/mp4") return true;
  if (type === "audio/aac") return true;

  return !isWhatsappAcceptedAudio(file);
}

function audioBufferToMonoFloat32(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const length = buffer.length;
  const output = new Float32Array(length);

  for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);

    for (let index = 0; index < length; index += 1) {
      output[index] += channel[index] / buffer.numberOfChannels;
    }
  }

  return output;
}

function resampleLinear(input: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const sourceIndexFloor = Math.floor(sourceIndex);
    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, input.length - 1);
    const weight = sourceIndex - sourceIndexFloor;

    output[index] =
      input[sourceIndexFloor] * (1 - weight) +
      input[sourceIndexCeil] * weight;
  }

  return output;
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));

    output[index] = sample < 0
      ? sample * 0x8000
      : sample * 0x7fff;
  }

  return output;
}

function toBlobPart(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function encodeMp3Mono(samples: Int16Array, sampleRate: number): Blob {
  const encoder = new Mp3Encoder(1, sampleRate, TARGET_BITRATE_KBPS);
  const chunks: ArrayBuffer[] = [];
  const blockSize = 1152;

  for (let index = 0; index < samples.length; index += blockSize) {
    const block = samples.subarray(index, index + blockSize);
    const encoded = encoder.encodeBuffer(block);

    if (encoded.length > 0) {
      chunks.push(toBlobPart(new Uint8Array(encoded)));
    }
  }

  const flushed = encoder.flush();

  if (flushed.length > 0) {
    chunks.push(toBlobPart(new Uint8Array(flushed)));
  }

  return new Blob(chunks, {
    type: "audio/mpeg"
  });
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();

  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("Este entorno no soporta AudioContext para convertir audio.");
  }

  const audioContext = new AudioContextCtor();

  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    return buffer;
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

export async function transcodeAudioToMp3(file: File): Promise<AudioTranscodeResult> {
  const originalType = normalizeMimeType(file.type) || "application/octet-stream";

  if (!shouldTranscodeAudio(file)) {
    return {
      file,
      originalType,
      outputType: "audio/mpeg",
      converted: false
    };
  }

  const audioBuffer = await decodeAudioFile(file);
  const mono = audioBufferToMonoFloat32(audioBuffer);
  const resampled = resampleLinear(mono, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
  const pcm = floatTo16BitPcm(resampled);
  const mp3Blob = encodeMp3Mono(pcm, TARGET_SAMPLE_RATE);

  const outputFile = new globalThis.File(
    [mp3Blob],
    `${getBaseName(file.name)}.mp3`,
    {
      type: "audio/mpeg",
      lastModified: Date.now()
    }
  );

  return {
    file: outputFile,
    originalType,
    outputType: "audio/mpeg",
    converted: true
  };
}

export function isAudioFile(file: File | null | undefined): boolean {
  return Boolean(file?.type?.startsWith("audio/"));
}

export function isAudioTypeAcceptedByWhatsapp(file: File | null | undefined): boolean {
  if (!file) return false;

  return isWhatsappAcceptedAudio(file);
}