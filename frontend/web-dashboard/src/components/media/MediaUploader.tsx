// src/components/media/MediaUploader.tsx

import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, FileImage, FileVideo } from 'lucide-react';
import { Button } from '../common/Button';
import { MediaType } from '../../types/enums';
import type { Media } from '../../types/media';

interface MediaUploaderProps {
  mediaType:    MediaType;
  incidentId?:  number;
  onUpload:     (file: File, mediaType: MediaType, incidentId?: number) => Promise<Media>;
  onSuccess?:   (media: Media) => void;
  accept?:      string;
  maxMB?:       number;
  className?:   string;
}

export function MediaUploader({
  mediaType,
  incidentId,
  onUpload,
  onSuccess,
  accept     = 'image/*,video/*',
  maxMB      = 50,
  className  = '',
}: MediaUploaderProps) {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [file, setFile]     = useState<File | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [progress, setProgress]   = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError]         = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    if (f.size > maxMB * 1024 * 1024) {
      setError(`File size exceeds ${maxMB}MB limit.`);
      return;
    }
    setFile(f);
    setError(null);
    setProgress('idle');
  }, [maxMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setProgress('uploading');
    setError(null);
    try {
      const media = await onUpload(file, mediaType, incidentId);
      setProgress('done');
      setFile(null);
      onSuccess?.(media);
    } catch (err: unknown) {
      setProgress('error');
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const isImage = file?.type.startsWith('image/');

  return (
    <div className={className}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900/50',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Upload size={20} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {file ? file.name : 'Drop file or click to browse'}
          </p>
          <p className="text-[11px] text-slate-400">
            Max {maxMB}MB · {accept.replace(/,/g, ', ')}
          </p>
        </div>
      </div>

      {/* Selected file preview */}
      {file && (
        <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="flex-shrink-0 text-slate-400">
            {isImage ? <FileImage size={18} /> : <FileVideo size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
            <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null); setProgress('idle'); }}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}

      {progress === 'done' && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ Upload successful
        </p>
      )}

      {file && progress !== 'done' && (
        <Button
          variant="primary"
          onClick={handleUpload}
          loading={progress === 'uploading'}
          fullWidth
          className="mt-3"
        >
          Upload
        </Button>
      )}
    </div>
  );
}