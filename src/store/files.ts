import { isTouch } from '../ui/device';

/** Hand a file to the person: the share sheet on phones (Save to Files), a download elsewhere. */
export async function saveFile(name: string, text: string, type = 'application/json'): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  try {
    const file = new File([text], name, { type });
    if (isTouch() && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}

export const fileSafeName = (name: string) => (name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'house') + '.json';
