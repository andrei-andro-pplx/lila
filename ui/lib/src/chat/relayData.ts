import type { BroadcastContext } from './interfaces';

const relayDataSentinel = '\x01';
const relayDataRegex = /\x01([^\x01]+)\x01$/;

const isRelayChatField = (v: string): boolean => !!v && !v.includes('/') && !v.includes(relayDataSentinel);

export const stripRelayChatData = (text: string): string => text.replace(relayDataRegex, '');

export const parseRelayChatData = (text: string): BroadcastContext | undefined => {
  const data = relayDataRegex.exec(text)?.[1];
  if (!data) return;
  const [roundId, gameId, ply] = data.split('/');
  if (!roundId || !gameId || !ply || !isRelayChatField(roundId) || !isRelayChatField(gameId)) return;
  const parsedPly = parseInt(ply, 10);
  if (!Number.isInteger(parsedPly) || parsedPly < 0) return;
  return {
    roundId,
    gameId,
    ply: parsedPly,
  };
};

export const attachRelayChatData = (text: string, data?: BroadcastContext): string => {
  if (!data || !isRelayChatField(data.roundId) || !isRelayChatField(data.gameId)) return text;
  if (!Number.isInteger(data.ply) || data.ply < 0) return text;
  return `${stripRelayChatData(text)}${relayDataSentinel}${data.roundId}/${data.gameId}/${data.ply}${relayDataSentinel}`;
};
