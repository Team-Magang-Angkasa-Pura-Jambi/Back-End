export interface PaxPayload {
  date: string | Date;
  pax_count: number;
  location_id?: number | null;
  session_id?: number | null;
}

export interface PaxQuery {
  page?: number;
  limit?: number;
  location_id?: number;
  start_date?: string;
  end_date?: string;
}
