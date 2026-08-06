import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Link2, Mic, FileImage } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
};

export function LibraryDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<SavedItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getSavedItem(id)
      .then(setItem)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load item"));
  }, [id]);

  useEffect(() => {
    if (!id || !item || item.source_type !== "voice_note") return;
    let objectUrl: string | null = null;
    api
      .getSavedItemAudio(id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      })
      .catch((err) => setAudioError(err instanceof ApiError ? err.message : "Failed to load audio"));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, item]);

  const Icon = item ? TYPE_ICON[item.source_type] ?? FileText : FileText;

  return (
    <div className="max-w-[700px] mx-auto px-6 flex flex-col gap-4">
      <Link to="/library" className="flex items-center gap-1 text-text-secondary hover:text-accent w-fit text-sm">
        <ArrowLeft size={16} />
        Back to Library
      </Link>

      {error && <p className="text-error text-sm">{error}</p>}
      {!item && !error && <p className="text-text-secondary text-sm">Loading...</p>}

      {item && (
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center shrink-0">
              <Icon size={18} className="text-accent" />
            </div>
            <span className="text-[10px] text-text-secondary font-medium uppercase tracking-widest">
              {item.source_type}
            </span>
          </div>

          {item.title && <h2 className="font-heading text-text-primary text-2xl font-bold">{item.title}</h2>}

          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm break-all hover:underline"
            >
              {item.source_url}
            </a>
          )}

          {item.failure_reason && <p className="text-error text-sm">{item.failure_reason}</p>}

          {item.source_type === "voice_note" && (
            audioUrl ? (
              <audio controls src={audioUrl} className="w-full">
                Your browser does not support the audio element.
              </audio>
            ) : audioError ? (
              <p className="text-error text-sm">{audioError}</p>
            ) : (
              <p className="text-text-secondary text-sm">Loading audio...</p>
            )
          )}

          {item.status !== "failed" && (
            item.status !== "ready" ? (
              <p className="text-text-secondary text-sm">Still processing ({item.status})...</p>
            ) : item.transcript ? (
              <p className="font-body text-text-primary whitespace-pre-wrap leading-relaxed">{item.transcript}</p>
            ) : (


              <p className="text-text-secondary text-sm italic">Pepper couldn't find any text in this one.</p>

            )
          )}
        </div>
      )}
    </div>
  );
}
