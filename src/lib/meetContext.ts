'use client';

export interface MeetRuntimeContext {
  meetingId: string | null;
  displayName: string | null;
  isHostHint: boolean;
}

declare global {
  interface Window {
    meet?: {
      addon?: {
        getContext?: () => Promise<{
          meetingId?: string;
          localParticipant?: { displayName?: string; isHost?: boolean };
          host?: { isHost?: boolean };
        }>;
      };
    };
  }
}

const CACHE_KEY = 'werewolf.meetContext';

function fromQuery(): MeetRuntimeContext {
  if (typeof window === 'undefined') {
    return { meetingId: null, displayName: null, isHostHint: false };
  }

  const p = new URLSearchParams(window.location.search);
  return {
    meetingId: p.get('meetingId') ?? p.get('lobby') ?? null,
    displayName: p.get('displayName') ?? null,
    isHostHint: p.get('role') === 'host'
  };
}

function readCache(): MeetRuntimeContext {
  if (typeof window === 'undefined') {
    return { meetingId: null, displayName: null, isHostHint: false };
  }

  const raw = window.localStorage.getItem(CACHE_KEY);
  if (!raw) return { meetingId: null, displayName: null, isHostHint: false };

  try {
    const parsed = JSON.parse(raw) as MeetRuntimeContext;
    return {
      meetingId: parsed.meetingId ?? null,
      displayName: parsed.displayName ?? null,
      isHostHint: Boolean(parsed.isHostHint)
    };
  } catch {
    return { meetingId: null, displayName: null, isHostHint: false };
  }
}

function writeCache(ctx: MeetRuntimeContext): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(ctx));
}

export async function getMeetRuntimeContext(): Promise<MeetRuntimeContext> {
  const query = fromQuery();
  const cached = readCache();

  let sdkCtx: MeetRuntimeContext = { meetingId: null, displayName: null, isHostHint: false };
  try {
    const context = await window.meet?.addon?.getContext?.();
    sdkCtx = {
      meetingId: context?.meetingId ?? null,
      displayName: context?.localParticipant?.displayName ?? null,
      isHostHint: Boolean(context?.localParticipant?.isHost || context?.host?.isHost)
    };
  } catch {
    // Best effort only.
  }

  const resolved: MeetRuntimeContext = {
    meetingId: sdkCtx.meetingId ?? query.meetingId ?? cached.meetingId,
    displayName: sdkCtx.displayName ?? query.displayName ?? cached.displayName,
    isHostHint: sdkCtx.isHostHint || query.isHostHint || cached.isHostHint
  };

  writeCache(resolved);
  return resolved;
}
