/**
 * Save a generated file. Inside the Claude artifact viewer, downloads go through its `downloads`
 * capability (the viewer confirms the save); everywhere else this is an ordinary browser download.
 */

export type SaveOutcome = 'saved' | 'declined' | 'failed';

interface DownloadsHost {
  save: (req: { filename: string; data: Blob }) => Promise<{ status: 'saved' | 'delivered' }>;
}

interface ClaudeHost {
  use?: (name: 'downloads') => Promise<DownloadsHost | null>;
}

const browserDownload = (filename: string, data: Blob) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

export async function saveFile(filename: string, data: Blob): Promise<SaveOutcome> {
  const host = (window as Window & { claude?: ClaudeHost }).claude;
  if (host?.use) {
    let downloads: DownloadsHost | null = null;
    try {
      downloads = await host.use('downloads');
    } catch {
      downloads = null;
    }
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        return 'saved';
      } catch (err) {
        return (err as { code?: string })?.code === 'declined' ? 'declined' : 'failed';
      }
    }
  }
  try {
    browserDownload(filename, data);
    return 'saved';
  } catch {
    return 'failed';
  }
}
