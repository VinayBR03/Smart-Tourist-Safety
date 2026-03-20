// src/types/media.ts

import { MediaType } from './enums';

export interface Media {
  id: number;
  uploaded_by: number;
  incident_id: number | null;
  media_type: MediaType;
  s3_key: string;
  content_type: string;
  file_size_bytes: number;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncidentMediaSummary {
  id: number;
  media_type: MediaType;
  s3_key: string;
  content_type: string;
  created_at: string;
}

export interface MediaUploadRequest {
  media_type: MediaType;
  content_type: string;
  file_size_bytes: number;
  incident_id?: number;
}

export interface MediaUploadResponse {
  upload_url: string;
  s3_key: string;
  expires_in: number;
}

export interface MediaConfirmRequest {
  media_type: MediaType;
  s3_key: string;
  incident_id?: number;
}